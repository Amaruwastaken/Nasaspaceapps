import {metrics,classify} from './report-data.js';
const KEY = 'similunares.measurements.v1';
export function validateValues(values) {
  for (const metric of metrics) {
    if (classify(metric,values[metric.id],values) === 'invalid' ||
      (metric.options && values[metric.id] && !metric.options.some(([key]) => key === values[metric.id]))) {
      throw new Error(`Revisa el dato: ${metric.name}.`);
    }
  }
  if (values.sleepDays !== '' && values.sleepDays !== undefined &&
    (!Number.isInteger(Number(values.sleepDays)) || Number(values.sleepDays) < 0)) {
    throw new Error('Las noches consecutivas deben ser un número entero mayor o igual a cero.');
  }
}
export function loadMeasurements() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const data = JSON.parse(raw);
  if (data.version !== 1 || !data.values || typeof data.values !== 'object' || !Number.isFinite(Date.parse(data.savedAt))) throw new Error('No se pudieron leer las mediciones guardadas.');
  validateValues(data.values);
  return data;
}
export function saveMeasurements(values,example = false) {
  validateValues(values);
  const allowed = [...metrics.map(m => m.id),'sleepDays'];
  const clean = Object.fromEntries(allowed.filter(key => values[key] !== undefined && values[key] !== '').map(key => [key,values[key]]));
  const data = {version:1,values:clean,example,savedAt:new Date().toISOString()};
  localStorage.setItem(KEY,JSON.stringify(data));
  return data;
}
