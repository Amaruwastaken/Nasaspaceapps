// Existing schema is documented in Backend/backend.ts. Unmapped metrics stay missing.
export const pendingConnections = ['fluids','gravity','pressure','ventilation','sleepDays','heartRate','dose'];
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

export async function fetchDatabaseMeasurements(client,userId) {
  const values = {}, dates = {}, warnings = [];
  const history = {records:[],sensors:[],recordsLoaded:false,sensorsLoaded:false};
  if (!client || !userId) return {values,dates,warnings,history};
  const results = await Promise.allSettled([
    fetchAllRows(client,'daily_sensor','date,hr_avg,hr_max,temp_avg,spo2_min,rad_msv,co2_max,rmssd',userId),
    fetchAllRows(client,'records','date,env,sleep,tlx,pvt,pvt_max,fs',userId),
  ]);
  const sources = [
    {key:'sensors',warning:'No se pudieron cargar todos los sensores.',mapping:{hrv:'rmssd',co2:'co2_max',radiation:'rad_msv'}},
    {key:'records',warning:'No se pudieron cargar todos los registros.',mapping:{sleep:'sleep',pvt:'pvt',tlx:'tlx'}},
  ];
  results.forEach((result,index) => {
    const source = sources[index];
    if (result.status === 'rejected') { warnings.push(source.warning); return; }
    history[source.key] = result.value;
    history[`${source.key}Loaded`] = true;
    const row = result.value[0];
    if (!row) return;
    for (const [id,column] of Object.entries(source.mapping)) {
      const value = row[column];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        values[id] = value;
        dates[id] = row.date;
      }
    }
  });
  // rad_msv is a daily dose, not lifetime exposure; hr_avg is not resting heart rate.
  return {values,dates,warnings,history};
}
