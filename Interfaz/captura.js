import {manualMetrics} from './report-data.js';
import {loadMeasurements,saveMeasurements} from './measurement-store.js';
import {supabaseReady,getCurrentUser} from './auth.js';
import {mountDigitalTest} from './digital-tests.js';
const form = document.querySelector('#captureForm');
const fields = document.querySelector('#captureFields');
const message = document.querySelector('#captureMessage');
const progress = document.querySelector('#captureProgress');
const progressBar = document.querySelector('#captureProgressBar');
const stepLabel = document.querySelector('#captureStep');
const previous = document.querySelector('#capturePrevious');
const skip = document.querySelector('#captureSkip');
const next = document.querySelector('#captureNext');
const questions = manualMetrics.flatMap(metric => (metric.fields ?? [{
  id:metric.id,label:metric.name,options:metric.options,unit:metric.unit,min:metric.min,max:metric.max,step:metric.step,example:metric.example,
}]).map(definition => ({metric,definition})));
let activeUser = null, initialized = false, ready = false, saving = false;
let currentIndex = 0, values = {};
let digital = null;
let testDrafts = {};
const digitalIds = new Set(['pvt','tlx','amsler']);
const feedback = (text,error = false) => { message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status'); };

function renderCurrent() {
  digital?.destroy(); digital = null;
  const {metric,definition} = questions[currentIndex];
  const field = document.createElement('div'); field.className = 'metric-card';
  if (digitalIds.has(metric.id)) {
    field.append(Object.assign(document.createElement('h2'),{textContent:metric.name}));
    fields.replaceChildren(field);
    testDrafts[metric.id] ??= {result:values[metric.id] ?? null};
    digital = mountDigitalTest(metric.id,field,testDrafts[metric.id],() => feedback('Resultado sin guardar.'));
    updateProgress(); return;
  }
  if (metric.fields) {
    const heading = document.createElement('h2'); heading.textContent = metric.name; field.append(heading);
  }
  const label = document.createElement('label'); label.htmlFor = `capture-${metric.id}-${definition.id}`;
  label.textContent = definition.label + (definition.unit ? ` (${definition.unit})` : '');
  const inputOptions = definition.options ?? (!metric.fields ? metric.options : undefined);
  const input = document.createElement(inputOptions ? 'select' : 'input');
  input.id = label.htmlFor; input.name = definition.id;
  if (inputOptions) { input.add(new Option('Selecciona una opción','')); inputOptions.forEach(([value,text]) => input.add(new Option(text,value))); }
  else {
    input.type = 'number';
    input.min = String(definition.min ?? 0);
    if (definition.step) input.step = definition.step;
    const example = definition.example ?? metric.example;
    input.placeholder = example ? `Ej. ${example}` : 'Ingresa un valor';
    if (definition.max !== undefined) input.max = definition.max;
  }
  input.value = metric.fields ? values[metric.id]?.[definition.id] ?? '' : values[metric.id] ?? '';
  field.append(label,input);
  const help = document.createElement('p'); help.className = 'metric-ranges'; help.id = `capture-range-${metric.id}`;
  const example = definition.example ?? metric.example;
  help.textContent = `${example ? `Ejemplo de respuesta: ${example}. ` : ''}${metric.ranges}`;
  input.setAttribute('aria-describedby',help.id);
  field.append(help);
  fields.replaceChildren(field);
  updateProgress();
}

function updateProgress() {
  const percent = Math.round(((currentIndex + 1) / questions.length) * 100);
  progress.setAttribute('aria-valuenow',String(percent));
  progressBar.style.width = `${percent}%`;
  stepLabel.textContent = `Pregunta ${currentIndex + 1} de ${questions.length} · ${percent}%`;
  previous.hidden = currentIndex === 0;
  skip.textContent = currentIndex === questions.length - 1 ? 'Saltar y guardar' : 'Saltar';
  next.textContent = currentIndex === questions.length - 1 ? 'Guardar y ver reporte' : 'Siguiente';
}

function rememberCurrent() {
  const {metric,definition} = questions[currentIndex];
  if (digital) {
    const result = digital.read();
    if (result === null || result === undefined) delete values[metric.id];
    else values[metric.id] = result;
    return;
  }
  const input = fields.querySelector('input,select');
  if (metric.fields) {
    const result = {...(values[metric.id] ?? {})};
    if (input.value === '') delete result[definition.id];
    else result[definition.id] = input.value;
    if (Object.keys(result).length) values[metric.id] = result;
    else delete values[metric.id];
    return;
  }
  if (input.value === '') delete values[metric.id];
  else values[metric.id] = input.value;
}

function skipCurrent() {
  const {metric,definition} = questions[currentIndex];
  if (digitalIds.has(metric.id)) delete testDrafts[metric.id];
  if (metric.fields) {
    const result = {...(values[metric.id] ?? {})};
    delete result[definition.id];
    if (Object.keys(result).length) values[metric.id] = result;
    else delete values[metric.id];
  } else delete values[metric.id];
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
  activeUser = userId; initialized = true; currentIndex = 0; testDrafts = {}; renderCurrent();
}

document.addEventListener('sessionchange',syncUser);
form.addEventListener('input',() => { rememberCurrent(); feedback('Cambios sin guardar.'); });
previous.addEventListener('click',() => {
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  rememberCurrent(); currentIndex--; renderCurrent(); feedback('');
});
skip.addEventListener('click',() => {
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  skipCurrent();
  if (currentIndex === questions.length - 1) { saveAndViewReport(); return; }
  currentIndex++; renderCurrent(); feedback('');
});
form.addEventListener('submit',event => {
  event.preventDefault();
  if (!ready) { feedback('Espera a que termine de comprobarse la sesión.'); return; }
  if (digital) {
    if (!digital.validate()) { feedback('Completa la prueba o usa “Saltar”.',true); return; }
    rememberCurrent();
    if (currentIndex < questions.length - 1) { currentIndex++; renderCurrent(); feedback(''); return; }
    saveAndViewReport(); return;
  }
  const input = fields.querySelector('input,select');
  if (!input.value.trim()) { feedback('Completa esta respuesta o usa “Saltar”.',true); input.focus(); return; }
  if (!input.reportValidity()) return;
  rememberCurrent();
  if (currentIndex < questions.length - 1) { currentIndex++; renderCurrent(); feedback(''); return; }
  saveAndViewReport();
});
await supabaseReady; ready = true; syncUser();
window.addEventListener('pagehide',() => digital?.destroy());
window.addEventListener('pageshow',event => { if (event.persisted) renderCurrent(); });
