import {manualMetrics,classify} from './report-data.js';

const TABLE = 'telemetry';
const COLUMNS = 'id,user_id,manual_measurements,ts';
const MAX_BYTES = 16384;
const isMissing = value => value === undefined || value === null || value === '';
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const randomInteger = (min,max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDecimal = (min,max,places) => Number((min + Math.random() * (max - min)).toFixed(places));
const option = values => values[randomInteger(0,values.length - 1)];
function invalid(name) { throw new Error(`Revisa el dato: ${name}.`); }
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
  if (!plainObject(values)) throw new Error('Las mediciones deben ser un objeto de datos.');
  const allowed = new Set(manualMetrics.map(metric => metric.id));
  if (Object.keys(values).some(key => !allowed.has(key))) throw new Error('La captura contiene mediciones no permitidas.');
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
  if (new TextEncoder().encode(JSON.stringify(clean)).length > MAX_BYTES) throw new Error('La captura supera el tamaño permitido.');
  return clean;
}
async function requireUser(client,userId) {
  if (!client || typeof client.from !== 'function' || typeof client.auth?.getUser !== 'function') throw new Error('La conexión con Supabase no está disponible.');
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('Inicia sesión para guardar y consultar tus pruebas.');
  let session;
  try { session = await client.auth.getUser(); }
  catch { throw new Error('No se pudo verificar tu sesión. Intenta de nuevo.'); }
  if (session.error) throw new Error('No se pudo verificar tu sesión. Inicia sesión de nuevo.');
  if (!session.data?.user?.id) throw new Error('Inicia sesión para guardar y consultar tus pruebas.');
  if (session.data.user.id !== userId) throw new Error('La sesión cambió. Recarga la página antes de continuar.');
}
function databaseError(error,operation) {
  if (['42P01','42703','PGRST204','PGRST205'].includes(error?.code)) return new Error('Falta aplicar la migración de telemetría unificada en Supabase.');
  if (error?.code === '23503') return new Error('Falta el perfil asociado a tu cuenta en Supabase. Cierra sesión y vuelve a iniciar sesión.');
  if (error?.code === '42501') return new Error('Supabase rechazó el guardado por permisos. Inicia sesión de nuevo e inténtalo otra vez.');
  const code = error?.code ? ` (código ${error.code})` : '';
  return new Error(`No se pudieron ${operation} las pruebas en Supabase${code}. Intenta de nuevo.`);
}
export function generateSimulatedValues(automatic) {
  return {
    pvt:randomInteger(240,420),
    tlx:randomInteger(30,70),
    amsler:option(['green','yellow','red']),
    sleep:randomDecimal(6.5,8.5,1),
    hrv:randomInteger(40,70),
    heartRate:automatic.hr,
    co2:automatic.co2,
    fluids:randomDecimal(1.6,2.4,1),
    radiation:randomDecimal(0.1,0.45,2),
    dose:randomDecimal(5,30,1),
    gravity:automatic.gravity,
    pressure:randomDecimal(97,102,1),
    ventilation:randomDecimal(0.08,0.16,2),
    bloodPressure:`${randomInteger(105,125)}/${randomInteger(65,80)}`,
    heartRecovery:randomInteger(20,35),
    arrhythmia:0,
    perfusion:randomDecimal(1,1.9,1),
    glucose:randomInteger(80,100),
    bmr:randomDecimal(0.95,1.05,2),
    bodyFat:{value:randomInteger(12,18),sex:'male'},
    calories:randomInteger(90,110),
    sodium:randomInteger(1600,2200),
    calcium:randomInteger(1000,1200),
    vitaminD:randomInteger(800,1000),
    caffeine:randomInteger(0,200),
    sleepApnea:randomInteger(0,4),
    medication:{takenPercent:randomInteger(95,100),doubleDose:'no'},
    spo2:automatic.spo2,
    oxygen:randomDecimal(20.5,22,1),
    respiratoryRate:automatic.resp,
    temperature:automatic.temp,
    sleepEfficiency:randomInteger(85,95),
    orthostatic:{hrRise:randomInteger(5,18),systolicDrop:randomInteger(0,8),diastolicDrop:randomInteger(0,5),symptoms:'none'},
    who5:randomInteger(50,85),
    hemoglobin:{value:randomDecimal(13,16,1),sex:'male'},
    leanMassChange:randomDecimal(-1,2,1),
    boneDensity:{tScore:randomDecimal(-0.8,0.5,1),monthlyLoss:randomDecimal(0,0.3,2)},
  };
}
function simulatedTelemetry(manualValues) {
  const automatic = {
    hr:randomInteger(60,90),
    rr:randomDecimal(0.6,1,2),
    temp:randomDecimal(36.3,37.1,1),
    spo2:randomInteger(95,99),
    resp:randomInteger(12,20),
    rad_rate:randomDecimal(0.01,0.08,3),
    co2:randomInteger(450,1000),
    asleep:false,
    phase:'prototipo',
    gravity:0.38,
    latency_s:randomDecimal(0.15,0.4,2),
    mission_day:1,
  };
  const simulated = generateSimulatedValues(automatic);
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
  if (!plainObject(row) || row.user_id !== userId || !validId || !Number.isFinite(Date.parse(row.ts))) throw new Error('Supabase devolvió una captura inválida.');
  return {id:String(row.id),values:validateValues(row.manual_measurements),savedAt:row.ts};
}
// Complete snapshots are authoritative: omitted/skipped fields remain absent.
export async function loadMeasurements(client,userId) {
  await requireUser(client,userId);
  let result;
  try { result = await client.from(TABLE).select(COLUMNS).eq('user_id',userId).not('manual_measurements','is',null).order('ts',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle(); }
  catch (error) { throw databaseError(error,'consultar'); }
  if (result.error) throw databaseError(result.error,'consultar');
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
  catch (error) { throw databaseError(error,'guardar'); }
  if (result.error) throw databaseError(result.error,'guardar');
  return decode(result.data,userId);
}
