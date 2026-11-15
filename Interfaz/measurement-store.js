import {manualMetrics,classify} from './report-data.js';

const TABLE = 'manual_measurements';
const COLUMNS = 'id,user_id,measurements,created_at';
const MAX_BYTES = 16384;
const isMissing = value => value === undefined || value === null || value === '';
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
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
  if (['42P01','PGRST205'].includes(error?.code)) return new Error('Falta configurar la tabla manual_measurements en Supabase.');
  return new Error(`No se pudieron ${operation} las pruebas en Supabase. Intenta de nuevo.`);
}
function decode(row,userId) {
  if (!plainObject(row) || row.user_id !== userId || typeof row.id !== 'string' || !row.id || !Number.isFinite(Date.parse(row.created_at))) throw new Error('Supabase devolvió una captura inválida.');
  return {id:row.id,values:validateValues(row.measurements),savedAt:row.created_at};
}
// Complete snapshots are authoritative: omitted/skipped fields remain absent.
export async function loadMeasurements(client,userId) {
  await requireUser(client,userId);
  let result;
  try { result = await client.from(TABLE).select(COLUMNS).eq('user_id',userId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle(); }
  catch (error) { throw databaseError(error,'consultar'); }
  if (result.error) throw databaseError(result.error,'consultar');
  return result.data === null ? null : decode(result.data,userId);
}
export async function saveMeasurements(client,userId,values) {
  await requireUser(client,userId);
  const clean = validateValues(values);
  let result;
  try { result = await client.from(TABLE).insert({user_id:userId,measurements:clean}).select(COLUMNS).single(); }
  catch (error) { throw databaseError(error,'guardar'); }
  if (result.error) throw databaseError(result.error,'guardar');
  return decode(result.data,userId);
}
