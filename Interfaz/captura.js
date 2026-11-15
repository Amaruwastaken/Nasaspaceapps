import {manualMetrics} from './report-data.js';
import {loadMeasurements,saveMeasurements} from './measurement-store.js';
import {supabaseReady,getCurrentUser} from './auth.js';
const form = document.querySelector('#captureForm');
const fields = document.querySelector('#captureFields');
const message = document.querySelector('#captureMessage');
const progress = document.querySelector('#captureProgress');
const progressBar = document.querySelector('#captureProgressBar');
const stepLabel = document.querySelector('#captureStep');
const previous = document.querySelector('#capturePrevious');
const skip = document.querySelector('#captureSkip');
const next = document.querySelector('#captureNext');
let activeUser = null, initialized = false, ready = false, saving = false;
let currentIndex = 0, values = {};
const feedback = (text,error = false) => { message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status'); };

function renderCurrent() {
  const metric = manualMetrics[currentIndex];
  const field = document.createElement('div'); field.className = 'metric-card';
  if (metric.fields) {
    const heading = document.createElement('h2'); heading.textContent = metric.name; field.append(heading);
  }
  const definitions = metric.fields ?? [{id:metric.id,label:metric.name,options:metric.options,unit:metric.unit,min:metric.min,max:metric.max,step:metric.step,example:metric.example}];
  for (const definition of definitions) {
    const label = document.createElement('label'); label.htmlFor = `capture-${metric.id}-${definition.id}`;
    label.textContent = definition.label + (definition.unit ? ` (${definition.unit})` : '');
    const input = document.createElement(definition.options ? 'select' : 'input');
    input.id = label.htmlFor; input.name = definition.id; input.dataset.metricKey = definition.id;
    if (definition.options) { input.add(new Option('Selecciona una opción','')); definition.options.forEach(([value,text]) => input.add(new Option(text,value))); }
    else {
      input.type = 'number';
      input.min = String(definition.min ?? 0);
      if (definition.step) input.step = definition.step;
      input.placeholder = definition.example ? `Ej. ${definition.example}` : 'Ingresa un valor';
      if (definition.max !== undefined) input.max = definition.max;
    }
    input.value = metric.fields ? values[metric.id]?.[definition.id] ?? '' : values[metric.id] ?? '';
    field.append(label,input);
  }
  const help = document.createElement('p'); help.className = 'metric-ranges'; help.id = `capture-range-${metric.id}`;
  help.textContent = `${metric.example ? `Ejemplo de respuesta: ${metric.example}. ` : ''}${metric.ranges}`;
  for (const input of field.querySelectorAll('input,select')) input.setAttribute('aria-describedby',help.id);
  field.append(help);
  fields.replaceChildren(field);
  const percent = Math.round(((currentIndex + 1) / manualMetrics.length) * 100);
  progress.setAttribute('aria-valuenow',String(percent));
  progressBar.style.width = `${percent}%`;
  stepLabel.textContent = `Pregunta ${currentIndex + 1} de ${manualMetrics.length} · ${percent}%`;
  previous.hidden = currentIndex === 0;
  skip.textContent = currentIndex === manualMetrics.length - 1 ? 'Saltar y guardar' : 'Saltar';
  next.textContent = currentIndex === manualMetrics.length - 1 ? 'Guardar y ver reporte' : 'Siguiente';
}

function rememberCurrent() {
  const metric = manualMetrics[currentIndex];
  const inputs = [...fields.querySelectorAll('input,select')];
  if (metric.fields) {
    const result = Object.fromEntries(inputs.map(input => [input.dataset.metricKey,input.value]));
    if (Object.values(result).some(value => value !== '')) values[metric.id] = result;
    else delete values[metric.id];
    return;
  }
  if (inputs[0].value === '') delete values[metric.id];
  else values[metric.id] = inputs[0].value;
}

function saveAndViewReport() {
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  if (saving) return;
  saving = true; next.disabled = true; skip.disabled = true;
  try { saveMeasurements(values,getCurrentUser()?.id); window.location.assign('reporte.html'); }
  catch (error) { feedback(error.message || 'No se pudieron guardar las pruebas.',true); }
  finally { saving = false; next.disabled = false; skip.disabled = false; }
}

function syncUser() {
  const userId = getCurrentUser()?.id ?? null;
  if (initialized && userId === activeUser) return;
  try { values = {...(loadMeasurements(userId)?.values ?? {})}; feedback(''); }
  catch (error) { values = {}; feedback(error.message || 'No se pudieron cargar las pruebas locales.',true); }
  activeUser = userId; initialized = true; currentIndex = 0; renderCurrent();
}

document.addEventListener('sessionchange',syncUser);
form.addEventListener('input',() => { rememberCurrent(); feedback('Cambios sin guardar.'); });
previous.addEventListener('click',() => {
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  rememberCurrent(); currentIndex--; renderCurrent(); feedback('');
});
skip.addEventListener('click',() => {
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  delete values[manualMetrics[currentIndex].id];
  if (currentIndex === manualMetrics.length - 1) { saveAndViewReport(); return; }
  currentIndex++; renderCurrent(); feedback('');
});
form.addEventListener('submit',event => {
  event.preventDefault();
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  const inputs = [...fields.querySelectorAll('input,select')];
  const blank = inputs.find(input => !input.value.trim());
  if (blank) { feedback('Completa esta respuesta o usa “Saltar”.',true); blank.focus(); return; }
  if (inputs.some(input => !input.reportValidity())) return;
  rememberCurrent();
  if (currentIndex < manualMetrics.length - 1) { currentIndex++; renderCurrent(); feedback(''); return; }
  saveAndViewReport();
});
await supabaseReady; ready = true; syncUser();
