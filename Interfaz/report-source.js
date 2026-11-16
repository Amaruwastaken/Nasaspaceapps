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
    throw new Error('Supabase returned invalid simulated data.');
  }
  const manualIds = new Set(manualMetrics.map(metric => metric.id));
  const manualPayload = Object.fromEntries(Object.entries(payload).filter(([id]) => manualIds.has(id)));
  if (typeof manualPayload.bodyFat === 'object' && manualPayload.bodyFat !== null) manualPayload.bodyFat = manualPayload.bodyFat.value;
  if (typeof manualPayload.hemoglobin === 'object' && manualPayload.hemoglobin !== null) manualPayload.hemoglobin = manualPayload.hemoglobin.value;
  if (typeof manualPayload.bloodPressure === 'string') {
    const match = manualPayload.bloodPressure.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
    if (match) manualPayload.bloodPressure = {systolic:Number(match[1]),diastolic:Number(match[2])};
  }
  const values = validateValues(manualPayload);
  for (const metric of metrics) {
    if (manualIds.has(metric.id) || !Object.hasOwn(payload,metric.id)) continue;
    const value = payload[metric.id];
    if (['invalid','missing'].includes(classify(metric,value))) throw new Error('Supabase returned invalid simulated data.');
    values[metric.id] = value;
  }
  return values;
}

async function fetchAllRows(client,table,columns,userId,orderColumn = 'date',manualOnly = false,secondaryOrderColumn) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from(table).select(columns).eq('user_id',userId);
    if (manualOnly) query = query.not('manual_measurements','is',null);
    query = query.order(orderColumn,{ascending:false});
    if (secondaryOrderColumn) query = query.order(secondaryOrderColumn,{ascending:false});
    const {data,error} = await query.range(offset,offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

function validDateKey(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) === date;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

async function fetchManualCheckins(client,userId) {
  const rows = await fetchAllRows(client,'telemetry','user_id,recorded_date,ts,manual_measurements',userId,'recorded_date',true,'id');
  return rows.map(row => {
    if (row.user_id !== userId || !Number.isFinite(Date.parse(row.ts))) {
      throw new Error('Supabase returned an invalid check-in history row.');
    }
    const savedDate = localDateKey(new Date(row.ts));
    const recordedDate = row.recorded_date ?? savedDate;
    const date = recordedDate > savedDate ? savedDate : recordedDate;
    if (!validDateKey(date)) throw new Error('Supabase returned an invalid check-in date.');
    const values = validateValues(row.manual_measurements);
    return {
      date,values,pvt:values.pvt,tlx:values.tlx,who5:values.who5,
      hrRise:values.orthostatic?.hrRise,perfusion:values.perfusion,
      medicationPercent:values.medication?.takenPercent,
    };
  });
}

async function fetchLatestTelemetry(client,userId) {
  const [latest,simulation] = await Promise.all([
    client.from('telemetry').select('ts,hr,temp,spo2,resp,co2,gravity,rad_rate,is_simulated')
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

async function fetchMissionStart(client,userId,missionRead) {
  try {
    const {data,error} = await (missionRead ? client.rpc('get_report_mission_start',{p_user_id:userId}) : client.rpc('get_mission_start_at_for_user'));
    if (!error) {
      if (data === null) return null;
      if (typeof data !== 'string' || !Number.isFinite(Date.parse(data))) {
        throw new Error('Supabase returned an invalid mission start date.');
      }
      return new Date(data).toISOString().slice(0,10);
    }
    const message = String(error?.message ?? '');
    const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.get_mission_start_at_for_user');
    if (!missingFunction) throw error;
  } catch (error) {
    const message = String(error?.message ?? '');
    const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.get_mission_start_at_for_user');
    if (!missingFunction) throw error;
  }

  const {data,error} = await client.from('profiles').select('mission_start_at').eq('id',userId).maybeSingle();
  if (error) throw error;
  if (!data?.mission_start_at) return null;
  if (typeof data.mission_start_at !== 'string' || !Number.isFinite(Date.parse(data.mission_start_at))) {
    throw new Error('Supabase returned an invalid mission start date.');
  }
  return new Date(data.mission_start_at).toISOString().slice(0,10);
}

export async function fetchDatabaseMeasurements(client,userId,{missionRead = false} = {}) {
  const values = {}, dates = {}, warnings = [];
  let simulatedValues = {}, simulatedAt = null;
  const history = {records:[],sensors:[],checkins:[],recordsLoaded:false,sensorsLoaded:false,checkinsLoaded:false,telemetrySimulated:false};
  if (!client || !userId) return {values,dates,warnings,history,simulatedValues,simulatedAt};
  const results = await Promise.allSettled([
    fetchAllRows(client,'daily_sensor','date,hr_avg,hr_max,temp_avg,spo2_min,rad_msv,co2_max,rmssd',userId),
    fetchAllRows(client,'records','date,env,sleep,tlx,pvt,pvt_max,fs',userId),
    fetchLatestTelemetry(client,userId),
    fetchMissionStart(client,userId,missionRead),
    fetchManualCheckins(client,userId),
  ]);
  const sources = [
    {key:'sensors',warning:'Could not load all sensor data.',mapping:{hrv:'rmssd',co2:'co2_max'}},
    {key:'records',warning:'Could not load all logs.',mapping:{sleep:'sleep',pvt:'pvt',tlx:'tlx'}},
    {key:'telemetry',warning:'Could not load automatic telemetry readings.',mapping:{heartRate:'hr',temperature:'temp',spo2:'spo2',respiratoryRate:'resp',co2:'co2',gravity:'gravity',radiation:'rad_rate'}},
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
          dates[id] = row.date ?? new Date(row.ts).toLocaleDateString('en-US');
        }
      }
    }
  });
  const sensorResult = results[0];
  const missionStartResult = results[3];
  if (missionStartResult.status === 'rejected') {
    warnings.push('Could not load the mission start date; cumulative dose was not calculated.');
  } else if (!missionStartResult.value) {
    warnings.push('Set a mission start date to calculate cumulative dose.');
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
  const checkinsResult = results[4];
  if (checkinsResult.status === 'fulfilled') {
    history.checkins = checkinsResult.value;
    history.checkinsLoaded = true;
  } else {
    const code = checkinsResult.reason?.code;
    warnings.push(['42703','PGRST204'].includes(code)
      ? 'The Supabase check-in history schema is outdated. Run supabase db push to apply 20261115150000_allow_backdated_checkins.sql.'
      : 'Could not load check-in history.');
  }
  // Daily radiation is accumulated from the stored current-mission start; hr_avg is not resting heart rate.
  return {values,dates,warnings,history,simulatedValues,simulatedAt};
}
