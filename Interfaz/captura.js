import {manualMetrics} from './report-data.js';
import {loadMeasurements,saveMeasurements} from './measurement-store.js';
import {supabaseReady,getCurrentUser} from './auth.js';
const form = document.querySelector('#captureForm');
const message = document.querySelector('#captureMessage');
let activeUser = null, initialized = false, dirty = false;
const feedback = (text,error = false) => { message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status'); };
for (const metric of manualMetrics) {
  const field = document.createElement('div'); field.className = 'metric-card';
  const label = document.createElement('label'); label.htmlFor = `capture-${metric.id}`;
  label.textContent = metric.name + (metric.unit ? ` (${metric.unit})` : '');
  const input = document.createElement(metric.options ? 'select' : 'input'); input.id = label.htmlFor; input.name = metric.id;
  if (metric.options) { input.add(new Option('Sin datos','')); metric.options.forEach(([value,text]) => input.add(new Option(text,value))); }
  else { input.type = 'number'; input.min = '0'; input.step = metric.step; input.placeholder = 'Sin datos'; if (metric.max !== undefined) input.max = metric.max; }
  const help = document.createElement('p'); help.className = 'metric-ranges'; help.id = `capture-range-${metric.id}`; help.textContent = metric.ranges;
  input.setAttribute('aria-describedby',help.id); field.append(label,input,help);
  document.querySelector('#captureFields').append(field);
}
function fill(values) { for (const input of form.querySelectorAll('input,select')) input.value = values[input.name] ?? ''; }
function syncUser() {
  const userId = getCurrentUser()?.id ?? null;
  if (initialized && userId === activeUser) return;
  if (initialized || !dirty) {
    try { fill(loadMeasurements(userId)?.values ?? {}); feedback(''); }
    catch { fill({}); feedback('No se pudieron cargar las pruebas locales.',true); }
  }
  activeUser = userId; initialized = true;
}
let ready = false;
document.addEventListener('sessionchange',syncUser);
form.addEventListener('input',() => { dirty = true; feedback('Cambios sin guardar.'); });
form.addEventListener('submit',event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  try { saveMeasurements(Object.fromEntries(new FormData(form)),getCurrentUser()?.id); window.location.assign('reporte.html'); }
  catch (error) { feedback(error.message || 'No se pudieron guardar las pruebas.',true); }
});
await supabaseReady; ready = true; syncUser();
