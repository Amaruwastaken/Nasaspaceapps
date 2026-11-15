import {manualMetrics,classify} from './report-data.js';
// Sensors never come from local storage. Manual tests are isolated per account.
const key = userId => `similunares.manual.v2.${userId || 'guest'}`;
export function validateValues(values) {
  for (const metric of manualMetrics) if (classify(metric,values[metric.id]) === 'invalid') throw new Error(`Revisa el dato: ${metric.name}.`);
}
export function loadMeasurements(userId = null) {
  const raw = localStorage.getItem(key(userId));
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.version !== 2 || !data.values || typeof data.values !== 'object' || !Number.isFinite(Date.parse(data.savedAt))) throw new Error('No se pudieron leer las pruebas guardadas.');
  validateValues(data.values);
  data.values = Object.fromEntries(manualMetrics.filter(m => data.values[m.id] !== undefined).map(m => [m.id,data.values[m.id]]));
  return data;
}
export function saveMeasurements(values,userId = null) {
  validateValues(values);
  const clean = Object.fromEntries(manualMetrics.filter(m => values[m.id] !== undefined && values[m.id] !== '').map(m => [m.id,values[m.id]]));
  const data = {version:2,values:clean,savedAt:new Date().toISOString()};
  localStorage.setItem(key(userId),JSON.stringify(data));
  return data;
}
