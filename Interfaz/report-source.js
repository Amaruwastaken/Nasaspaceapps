import {metrics,manualMetrics,classify} from './report-data.js';
import {validateValues} from './measurement-store.js';

const pageSize = 1000;
const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));

export function consecutiveShortSleepDays(records) {
  let count = 0, previousDay = null;
  for (const row of records) {
    if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? '') || typeof row.sleep !== 'number' || row.sleep >= 6) break;
    const day = Date.parse(`${row.date}T00:00:00.000Z`);
    if (!Number.isFinite(day) || (previousDay !== null && previousDay - day !== 86400000)) break;
    count++;
    previousDay = day;
  }
  return count;
}

function decodeSimulatedValues(payload) {
  if (!isPlainObject(payload) || Object.keys(payload).some(id => !metrics.some(metric => metric.id === id))) {
    throw new Error('Supabase devolvió datos simulados inválidos.');
  }
  const manualIds = new Set(manualMetrics.map(metric => metric.id));
  const manualPayload = Object.fromEntries(Object.entries(payload).filter(([id]) => manualIds.has(id)));
  const values = validateValues(manualPayload);
  for (const metric of metrics) {
    if (manualIds.has(metric.id) || !Object.hasOwn(payload,metric.id)) continue;
    const value = payload[metric.id];
    if (['invalid','missing'].includes(classify(metric,value))) throw new Error('Supabase devolvió datos simulados inválidos.');
    values[metric.id] = value;
  }
  return values;
}

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
  const [latest,simulation] = await Promise.all([
    client.from('telemetry').select('ts,hr,temp,spo2,resp,co2,gravity,is_simulated')
      .eq('user_id',userId).order('ts',{ascending:false}).limit(1).maybeSingle(),
    client.from('telemetry').select('ts,simulated_data').eq('user_id',userId)
      .not('simulated_data','is',null).order('ts',{ascending:false}).limit(1).maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  if (simulation.error) throw simulation.error;
  return {
    latest:latest.data,
    simulatedValues:simulation.data ? decodeSimulatedValues(simulation.data.simulated_data) : {},
    simulatedAt:simulation.data?.ts ?? null,
  };
}

async function fetchMissionStart(client,userId) {
  const {data,error} = await client.rpc('get_mission_start_at_for_user');
  if (error) throw error;
  if (data === null) return null;
  if (typeof data !== 'string' || !Number.isFinite(Date.parse(data))) {
    throw new Error('Supabase devolvió una fecha de inicio de misión inválida.');
  }
  return new Date(data).toISOString().slice(0,10);
}

export async function fetchDatabaseMeasurements(client,userId) {
  const values = {}, dates = {}, warnings = [];
  let simulatedValues = {}, simulatedAt = null;
  const history = {records:[],sensors:[],recordsLoaded:false,sensorsLoaded:false,telemetrySimulated:false};
  if (!client || !userId) return {values,dates,warnings,history,simulatedValues,simulatedAt};
  const results = await Promise.allSettled([
    fetchAllRows(client,'daily_sensor','date,hr_avg,hr_max,temp_avg,spo2_min,rad_msv,co2_max,rmssd',userId),
    fetchAllRows(client,'records','date,env,sleep,tlx,pvt,pvt_max,fs',userId),
    fetchLatestTelemetry(client,userId),
    fetchMissionStart(client,userId),
  ]);
  const sources = [
    {key:'sensors',warning:'No se pudieron cargar todos los sensores.',mapping:{hrv:'rmssd',co2:'co2_max',radiation:'rad_msv'}},
    {key:'records',warning:'No se pudieron cargar todos los registros.',mapping:{sleep:'sleep',pvt:'pvt',tlx:'tlx'}},
    {key:'telemetry',warning:'No se pudieron consultar las lecturas automáticas de telemetry.',mapping:{heartRate:'hr',temperature:'temp',spo2:'spo2',respiratoryRate:'resp',co2:'co2',gravity:'gravity'}},
  ];
  results.slice(0,3).forEach((result,index) => {
    const source = sources[index];
    if (result.status === 'rejected') { warnings.push(source.warning); return; }
    if (source.key !== 'telemetry') {
      history[source.key] = result.value;
      history[`${source.key}Loaded`] = true;
    }
    const row = source.key === 'telemetry' ? result.value.latest : result.value[0];
    if (source.key === 'telemetry') {
      simulatedValues = result.value.simulatedValues;
      simulatedAt = result.value.simulatedAt;
    }
    if (!row) return;
    if (source.key === 'telemetry') history.telemetrySimulated = row.is_simulated === true;
    if (source.key !== 'telemetry' || !row.is_simulated) {
      for (const [id,column] of Object.entries(source.mapping)) {
        const value = row[column];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          values[id] = value;
          dates[id] = row.date ?? new Date(row.ts).toLocaleDateString('es-MX');
        }
      }
    }
  });
  const sensorResult = results[0];
  const missionStartResult = results[3];
  if (missionStartResult.status === 'rejected') {
    warnings.push('No se pudo consultar la fecha de inicio de misión; no se calculó la dosis acumulada.');
  } else if (!missionStartResult.value) {
    warnings.push('Configura la fecha de inicio de misión para calcular la dosis acumulada.');
  } else if (sensorResult.status === 'fulfilled') {
    const missionStart = missionStartResult.value;
    const doseRows = sensorResult.value.filter(row =>
      typeof row.rad_msv === 'number' && Number.isFinite(row.rad_msv) && row.rad_msv >= 0 && row.date >= missionStart
    );
    if (doseRows.length) {
      values.dose = doseRows.reduce((total,row) => total + row.rad_msv,0);
      const latestDate = doseRows[0].date;
      dates.dose = missionStart === latestDate ? latestDate : `${missionStart} – ${latestDate}`;
    }
  }
  const recordsResult = results[1];
  if (recordsResult.status === 'fulfilled') {
    values.sleepDays = consecutiveShortSleepDays(recordsResult.value);
  }
  // Daily radiation is accumulated from the stored current-mission start; hr_avg is not resting heart rate.
  return {values,dates,warnings,history,simulatedValues,simulatedAt};
}
