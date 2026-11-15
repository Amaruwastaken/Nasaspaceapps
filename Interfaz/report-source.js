// Metrics without a column in the current schema remain missing in the report.
export const pendingConnections = ['fluids','pressure','ventilation','bloodPressure','heartRecovery','arrhythmia','glucose','bmr','bodyFat','calories','sodium','calcium','vitaminD','caffeine','sleepApnea','oxygen','sleepEfficiency','hemoglobin','leanMassChange','boneDensity'];
const pageSize = 1000;

async function fetchAllRows(client,table,columns,userId) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const {data,error} = await client.from(table).select(columns).eq('user_id',userId)
      .order('date',{ascending:false}).range(offset,offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function fetchLatestTelemetry(client,userId) {
  const {data,error} = await client.from('telemetry').select('ts,hr,temp,spo2,resp,co2,gravity')
    .eq('user_id',userId).order('ts',{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDatabaseMeasurements(client,userId) {
  const values = {}, dates = {}, warnings = [];
  const history = {records:[],sensors:[],recordsLoaded:false,sensorsLoaded:false};
  if (!client || !userId) return {values,dates,warnings,history};
  const results = await Promise.allSettled([
    fetchAllRows(client,'daily_sensor','date,hr_avg,hr_max,temp_avg,spo2_min,rad_msv,co2_max,rmssd',userId),
    fetchAllRows(client,'records','date,env,sleep,tlx,pvt,pvt_max,fs',userId),
    fetchLatestTelemetry(client,userId),
  ]);
  const sources = [
    {key:'sensors',warning:'No se pudieron cargar todos los sensores.',mapping:{hrv:'rmssd',co2:'co2_max',radiation:'rad_msv'}},
    {key:'records',warning:'No se pudieron cargar todos los registros.',mapping:{sleep:'sleep',pvt:'pvt',tlx:'tlx'}},
    {key:'telemetry',warning:'No se pudieron consultar las lecturas automáticas de telemetry.',mapping:{heartRate:'hr',temperature:'temp',spo2:'spo2',respiratoryRate:'resp',co2:'co2',gravity:'gravity'}},
  ];
  results.forEach((result,index) => {
    const source = sources[index];
    if (result.status === 'rejected') { warnings.push(source.warning); return; }
    if (source.key !== 'telemetry') {
      history[source.key] = result.value;
      history[`${source.key}Loaded`] = true;
    }
    const row = source.key === 'telemetry' ? result.value : result.value[0];
    if (!row) return;
    for (const [id,column] of Object.entries(source.mapping)) {
      const value = row[column];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        values[id] = value;
        dates[id] = row.date ?? new Date(row.ts).toLocaleDateString('es-MX');
      }
    }
  });
  const sensorResult = results[0];
  if (sensorResult.status === 'fulfilled') {
    const doseRows = sensorResult.value.filter(row => typeof row.rad_msv === 'number' && Number.isFinite(row.rad_msv) && row.rad_msv >= 0);
    if (doseRows.length) {
      values.dose = doseRows.reduce((total,row) => total + row.rad_msv,0);
      dates.dose = doseRows[0].date;
    }
  }
  // rad_msv is a daily dose, not lifetime exposure; hr_avg is not resting heart rate.
  return {values,dates,warnings,history};
}
