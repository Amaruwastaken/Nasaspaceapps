import {manualMetrics,metrics,classify} from './report-data.js';

const TABLE = 'telemetry';
const COLUMNS = 'id,user_id,manual_measurements,ts';
const MAX_BYTES = 16384;
const isMissing = value => value === undefined || value === null || value === '';
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const randomInteger = (min,max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min,max,places) => Number((min + Math.random() * (max - min)).toFixed(places));
const simulationWeights = {green:90,yellow:5,red:5};
const simulationRanges = {
  pvt:{green:[240,265],yellow:[266,499],red:[500,700]},
  tlx:{green:[0,45],yellow:[46,74],red:[75,100]},
  amsler:{green:[],yellow:[],red:[]},
  sleep:{green:[7.5,9,1],yellow:[6,7.4,1]},
  hrv:{green:[50,120],yellow:[35,49],red:[0,34]},
  heartRate:{green:[55,85],yellow:[45,54],red:[30,44]},
  co2:{green:[400,1499],yellow:[1500,3500],red:[3501,6000]},
  fluids:{green:[1.8,2.5,1],yellow:[1.5,1.7,1],red:[0.5,1.4,1]},
  radiation:{green:[0.01,0.49,2],yellow:[0.5,1.5,2],red:[1.51,5,2]},
  dose:{green:[5,299],yellow:[300,479],red:[600,1200]},
  gravity:{green:[0.9,1.1,2],yellow:[0.1,0.89,2],red:[0,0,2]},
  pressure:{green:[98,102.5,1],yellow:[95,97.9,1],red:[85,94.9,1]},
  ventilation:{green:[0.08,0.2,3],yellow:[0.05,0.079,3],red:[0.01,0.049,3]},
  bloodPressure:{green:[],yellow:[],red:[]},
  heartRecovery:{green:[20,60],yellow:[12,19],red:[0,11]},
  bloodPressure:{green:[],yellow:[],red:[]},
  arrhythmia:{green:[0,0],yellow:[1,1],red:[2,10]},
  perfusion:{green:[0,1.9,1],red:[2,4,1]},
  glucose:{green:[70,105],yellow:[106,125],red:[126,250]},
  bmr:{green:[0.9,1.2,2],yellow:[0.85,0.899,3],red:[0.5,0.849,3]},
  bodyFat:{green:[],yellow:[],red:[]},
  calories:{green:[90,140],yellow:[75,89],red:[0,74]},
  sodium:{green:[1500,2300],yellow:[2301,3000],red:[3001,5000]},
  calcium:{green:[1000,1200],yellow:[750,999],red:[0,749]},
  vitaminD:{green:[800,1000],yellow:[400,799],red:[0,399]},
  caffeine:{green:[0,200],yellow:[201,400],red:[401,1000]},
  sleepApnea:{green:[0,4],yellow:[5,14],red:[15,40]},
  medication:{green:[],yellow:[],red:[]},
  spo2:{green:[95,100],yellow:[92,94],red:[60,91]},
  oxygen:{green:[20,23,1],yellow:[19.5,19.9,1],red:[15,19.4,1]},
  respiratoryRate:{green:[12,20],yellow:[10,11]},
  temperature:{green:[36.1,37.2,1],yellow:[35.5,36,1],red:[38,42,1]},
  sleepEfficiency:{green:[85,100],yellow:[75,84],red:[0,74]},
  orthostatic:{green:[],yellow:[],red:[]},
  who5:{green:[50,100],yellow:[29,49],red:[0,28]},
  hemoglobin:{green:[],yellow:[],red:[]},
  leanMassChange:{green:[-2,5,1],yellow:[-5,-2.1,1],red:[-10,-5.1,1]},
  boneDensity:{green:[],yellow:[],red:[]},
  alt:{green:[5,40],yellow:[41,120],red:[121,500]},
  ast:{green:[5,40],yellow:[41,120],red:[121,500]},
  bilirubin:{green:[0,1.2],yellow:[1.21,3],red:[3.01,20]},
  nauseaScore:{green:[0,1],yellow:[2,5],red:[6,10]},
  appetite:{green:[7,10],yellow:[4,6],red:[0,3]},
  gastricSymptoms:{green:[],yellow:[],red:[]},
  urineOutput:{green:[1000,2500],yellow:[500,999],red:[0,499]},
  urineSpecificGravity:{green:[1.005,1.02,3],yellow:[1.001,1.004,3],red:[1.021,1.04,3]},
  creatinine:{green:[0.6,1.3,2],yellow:[1.31,2.5,2],red:[2.51,10,2]},
  bun:{green:[7,20],yellow:[21,40],red:[41,100]},
  bowelFrequency:{green:[1,3],yellow:[0,0],red:[4,8]},
  stoolConsistency:{green:[],yellow:[],red:[]},
  fiber:{green:[25,38],yellow:[15,24],red:[0,14]},
};
function simulationState(metricId) {
  const states = Object.keys(simulationRanges[metricId] ?? {});
  if (!states.length) throw new Error(`No simulated ranges are defined for ${metricId}.`);
  const totalWeight = states.reduce((total,state) => total + simulationWeights[state],0);
  let choice = Math.random() * totalWeight;
  for (const state of states) {
    choice -= simulationWeights[state];
    if (choice < 0) return state;
  }
  throw new Error(`Could not select a simulated state for ${metricId}.`);
}
function simulatedValue(metricId,state) {
  switch (metricId) {
    case 'amsler': return state;
    case 'bloodPressure': {
      const ranges = {green:[[100,120],[65,79]],yellow:[[126,139],[81,89]],red:[[140,180],[90,120]]};
      const [[systolicMin,systolicMax],[diastolicMin,diastolicMax]] = ranges[state];
      return {systolic:randomInteger(systolicMin,systolicMax),diastolic:randomInteger(diastolicMin,diastolicMax)};
    }
    case 'bodyFat': return state === 'green' ? randomDecimal(10,18,1) : state === 'yellow' ? randomDecimal(19,23,1) : randomDecimal(24,40,1);
    case 'medication':
      return state === 'green' ? {takenPercent:randomInteger(95,100),doubleDose:'no'}
        : state === 'yellow' ? {takenPercent:randomInteger(80,94),doubleDose:'no'}
          : {takenPercent:randomInteger(80,100),doubleDose:'yes'};
    case 'orthostatic':
      return state === 'green'
        ? {hrRise:randomInteger(5,18),systolicDrop:randomInteger(0,8),diastolicDrop:randomInteger(0,5),symptoms:'none'}
        : state === 'yellow'
          ? {hrRise:randomInteger(20,29),systolicDrop:randomInteger(10,19),diastolicDrop:randomInteger(0,9),symptoms:'dizzy'}
          : {hrRise:randomInteger(30,40),systolicDrop:randomInteger(20,25),diastolicDrop:randomInteger(10,12),symptoms:'syncope'};
    case 'hemoglobin': {
      const ranges = {green:[13,18],yellow:[11,12.9],red:[7,10.9]};
      const [min,max] = ranges[state];
      return randomDecimal(min,max,1);
    }
    case 'boneDensity':
      return state === 'green'
        ? {tScore:randomDecimal(-1,0.5,1),monthlyLoss:randomDecimal(0,0.49,2)}
        : state === 'yellow'
          ? {tScore:randomDecimal(-2,-1.1,1),monthlyLoss:randomDecimal(0.5,1,2)}
          : {tScore:randomDecimal(-3,-2.5,1),monthlyLoss:randomDecimal(1.1,2,2)};
    case 'gastricSymptoms': return state === 'green' ? {bloating:0,indigestion:0,abdominalDiscomfort:0}
      : state === 'yellow' ? {bloating:randomInteger(1,3),indigestion:randomInteger(1,3),abdominalDiscomfort:randomInteger(1,3)}
        : {bloating:randomInteger(4,8),indigestion:randomInteger(4,8),abdominalDiscomfort:randomInteger(4,8)};
    case 'stoolConsistency': return 'type4';
    default: {
      const range = simulationRanges[metricId]?.[state];
      if (!range) throw new Error(`No ${state} simulation range is defined for ${metricId}.`);
      return range.length === 3 ? randomDecimal(...range) : randomInteger(...range);
    }
  }
}
function invalid(name) { throw new Error(`Check this value: ${name}.`); }
function scalar(definition,value,name) {
  if (definition.options) {
    if (typeof value !== 'string' || !definition.options.some(([key]) => key === value)) invalid(name);
    return value;
  }
  if (!['number','string'].includes(typeof value) || (typeof value === 'string' && (!value.trim() || value.length > 128))) invalid(name);
  const number = Number(value);
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER || number < (definition.min ?? 0) || (definition.max !== undefined && number > definition.max)) invalid(name);
  const step = Number(definition.step);
  if (Number.isFinite(step) && step > 0) {
    const steps = (number - (definition.min ?? 0))/step;
    if (Math.abs(steps - Math.round(steps)) > 1e-7) invalid(name);
  }
  return number;
}
// Validate each supplied field, even when the overall questionnaire is incomplete.
export function validateValues(values) {
  if (!plainObject(values)) throw new Error('Measurements must be a data object.');
  const allowed = new Set(manualMetrics.map(metric => metric.id));
  if (Object.keys(values).some(key => !allowed.has(key))) throw new Error('The check-in contains unsupported measurements.');
  const clean = {};
  for (const metric of manualMetrics) {
    const raw = values[metric.id];
    if (isMissing(raw)) continue;
    if (metric.fields) {
      if (!plainObject(raw)) invalid(metric.name);
      const fieldIds = new Set(metric.fields.map(field => field.id));
      if (Object.keys(raw).some(key => !fieldIds.has(key))) invalid(metric.name);
      const fields = {};
      for (const field of metric.fields) if (!isMissing(raw[field.id])) fields[field.id] = scalar(field,raw[field.id],`${metric.name}: ${field.label}`);
      if (Object.keys(fields).length) clean[metric.id] = fields;
    } else clean[metric.id] = scalar(metric,raw,metric.name);
    if (classify(metric,clean[metric.id]) === 'invalid') invalid(metric.name);
  }
  if (new TextEncoder().encode(JSON.stringify(clean)).length > MAX_BYTES) throw new Error('The check-in exceeds the allowed size.');
  return clean;
}
async function requireUser(client,userId,readOnly = false) {
  if (!client || typeof client.from !== 'function' || typeof client.auth?.getUser !== 'function') throw new Error('The Supabase connection is unavailable.');
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Sign in to save and view your tests.');
  let session;
  try { session = await client.auth.getUser(); }
  catch { throw new Error('Could not verify your session. Please try again.'); }
  if (session.error) throw new Error('Could not verify your session. Sign in again.');
  if (!session.data?.user?.id) throw new Error('Sign in to save and view your tests.');
  if (!readOnly && session.data.user.id !== userId) throw new Error('Your session changed. Reload the page before continuing.');
}
function databaseError(error,operation) {
  if (['42P01','42703','PGRST204','PGRST205'].includes(error?.code)) return new Error('The unified telemetry migration has not been applied in Supabase.');
  if (error?.code === '23503') return new Error('Your Supabase account is missing its associated profile. Sign out, then sign in again.');
  if (error?.code === '42501') return new Error('Supabase denied the save due to permissions. Sign in again and retry.');
  const code = error?.code ? ` (code ${error.code})` : '';
  return new Error(`Could not ${operation} your tests in Supabase${code}. Please try again.`);
}
export function generateSimulatedValues() {
  return Object.fromEntries(metrics.map(metric => {
    const state = simulationState(metric.id);
    return [metric.id,simulatedValue(metric.id,state)];
  }));
}
function simulatedTelemetry(manualValues) {
  const simulated = generateSimulatedValues();
  const automatic = {
    hr:simulated.heartRate,
    rr:randomDecimal(0.6,1,2),
    temp:simulated.temperature,
    spo2:simulated.spo2,
    resp:simulated.respiratoryRate,
    rad_rate:randomDecimal(0.01,0.08,3),
    co2:simulated.co2,
    asleep:false,
    phase:'prototipo',
    gravity:simulated.gravity,
    latency_s:randomDecimal(0.15,0.4,2),
    mission_day:1,
  };
  for (const [id,value] of Object.entries(manualValues)) {
    if (plainObject(value) && plainObject(simulated[id])) {
      for (const field of Object.keys(value)) delete simulated[id][field];
      if (!Object.keys(simulated[id]).length) delete simulated[id];
    } else delete simulated[id];
  }
  return {...automatic,automatic_data:automatic,simulated_data:simulated,is_simulated:true};
}
function decode(row,userId) {
  const validId = Number.isSafeInteger(row?.id) || (typeof row?.id === 'string' && /^\d+$/.test(row.id));
  if (!plainObject(row) || row.user_id !== userId || !validId || !Number.isFinite(Date.parse(row.ts))) throw new Error('Supabase returned an invalid check-in.');
  return {id:String(row.id),values:validateValues(row.manual_measurements),savedAt:row.ts};
}
// Complete snapshots are authoritative: omitted/skipped fields remain absent.
export async function loadMeasurements(client,userId,{missionRead = false} = {}) {
  await requireUser(client,userId,missionRead);
  let result;
  try { result = await client.from(TABLE).select(COLUMNS).eq('user_id',userId).not('manual_measurements','is',null).order('ts',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle(); }
  catch (error) { throw databaseError(error,'load'); }
  if (result.error) throw databaseError(result.error,'load');
  return result.data === null ? null : decode(result.data,userId);
}
export async function saveMeasurements(client,userId,values) {
  await requireUser(client,userId);
  const clean = validateValues(values);
  let result;
  try {
    const automatic = simulatedTelemetry(clean);
    result = await client.from(TABLE).insert({
      user_id:userId,
      ...automatic,
      manual_measurements:clean,
    }).select(COLUMNS).single();
  }
  catch (error) { throw databaseError(error,'save'); }
  if (result.error) throw databaseError(result.error,'save');
  return decode(result.data,userId);
}
