import {manualMetrics} from './report-data.js';
import {loadMeasurements,saveMeasurements,localDateString} from './measurement-store.js';
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
const captureDate = document.querySelector('#captureDate');
const questions = manualMetrics.flatMap(metric => (metric.fields ?? [{
  id:metric.id,label:metric.name,options:metric.options,unit:metric.unit,min:metric.min,max:metric.max,step:metric.step,example:metric.example,
}]).map(definition => ({metric,definition})));
let activeUser = null, initialized = false, ready = false, saving = false;
let currentIndex = 0, values = {};
let selectedDate = captureDate.value = localDateString();
captureDate.max = selectedDate;
let loadRequest = 0;
let digital = null;
let testDrafts = {};
let hasUnsavedChanges = false;
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
    digital = mountDigitalTest(metric.id,field,testDrafts[metric.id],() => {
      hasUnsavedChanges = true;
      feedback('Unsaved changes.');
    });
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
  if (inputOptions) { input.add(new Option('Select an option','')); inputOptions.forEach(([value,text]) => input.add(new Option(text,value))); }
  else {
    input.type = 'number';
    input.min = String(definition.min ?? 0);
    if (definition.step) input.step = definition.step;
    const example = definition.example ?? metric.example;
    input.placeholder = example ? `E.g. ${example}` : 'Enter a value';
    if (definition.max !== undefined) input.max = definition.max;
  }
  input.value = metric.fields ? values[metric.id]?.[definition.id] ?? '' : values[metric.id] ?? '';
  field.append(label,input);
  const help = document.createElement('p'); help.className = 'metric-ranges'; help.id = `capture-range-${metric.id}`;
  const example = definition.example ?? metric.example;
  help.textContent = `${example ? `Example answer: ${example}. ` : ''}${metric.ranges}`;
  input.setAttribute('aria-describedby',help.id);
  field.append(help);
  fields.replaceChildren(field);
  updateProgress();
}

function updateProgress() {
  const percent = Math.round(((currentIndex + 1) / questions.length) * 100);
  progress.setAttribute('aria-valuenow',String(percent));
  progressBar.style.width = `${percent}%`;
  stepLabel.textContent = `Question ${currentIndex + 1} of ${questions.length} · ${percent}%`;
  previous.hidden = currentIndex === 0;
  skip.textContent = currentIndex === questions.length - 1 ? 'Skip and save' : 'Skip';
  next.textContent = currentIndex === questions.length - 1 ? 'Save and view report' : 'Next';
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

async function saveAndViewReport() {
  if (!ready) { feedback('Wait for the session check to finish.'); return; }
  if (saving) return;
  if (!captureDate.value || captureDate.value !== selectedDate) { feedback('Choose a valid check-in date.',true); return; }
  const userId = getCurrentUser()?.id;
  if (!userId) { feedback('Sign in to save your tests to Supabase.',true); return; }
  const request = loadRequest;
  const snapshot = structuredClone(values);
  saving = true; next.disabled = true; skip.disabled = true; previous.disabled = true;
  captureDate.disabled = true;
  fields.inert = true;
  feedback('Saving your tests to Supabase…');
  try {
    const client = await supabaseReady;
    if (getCurrentUser()?.id !== userId || request !== loadRequest) return;
    await saveMeasurements(client,userId,snapshot,{date:selectedDate});
    if (getCurrentUser()?.id !== userId || request !== loadRequest) return;
    window.location.assign('reporte.html');
  } catch (error) {
    if (request === loadRequest) feedback(error.message || 'Could not save your tests. Your answers are still on this page.',true);
  } finally {
    saving = false;
    if (request === loadRequest) { fields.inert = false; captureDate.disabled = !ready; next.disabled = !ready; skip.disabled = !ready; previous.disabled = !ready; }
  }
}

async function syncUser() {
  const userId = getCurrentUser()?.id ?? null;
  if (initialized && userId === activeUser) return;
  const request = ++loadRequest;
  activeUser = userId; initialized = true; ready = false;
  selectedDate = captureDate.value = localDateString();
  captureDate.max = selectedDate; captureDate.disabled = true;
  values = {}; testDrafts = {}; currentIndex = 0;
  hasUnsavedChanges = false;
  digital?.destroy(); digital = null; fields.replaceChildren(); fields.inert = false;
  next.disabled = true; skip.disabled = true; previous.disabled = true;
  feedback('Loading your tests from Supabase…');
  const client = await supabaseReady;
  if (request !== loadRequest || userId !== (getCurrentUser()?.id ?? null)) return;
  if (!userId || !client) {
    feedback(!userId ? 'Sign in to complete and save your tests.' : 'No connection to Supabase. Try reloading the page.',true);
    return;
  }
  try {
    const saved = await loadMeasurements(client,userId);
    if (request !== loadRequest || userId !== getCurrentUser()?.id) return;
    const savedDate = saved?.recordedDate ?? (saved?.savedAt ? localDateString(new Date(saved.savedAt)) : null);
    values = savedDate === selectedDate ? {...(saved?.values ?? {})} : {};
    ready = true; captureDate.disabled = false;
    next.disabled = false; skip.disabled = false; previous.disabled = false;
    renderCurrent(); feedback('');
  } catch (error) {
    if (request !== loadRequest) return;
    feedback(error.message || 'Could not load your tests from Supabase.',true);
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'capture-secondary'; retry.textContent = 'Retry connection';
    retry.addEventListener('click',() => { initialized = false; void syncUser(); }); fields.append(retry);
  }
}

captureDate.addEventListener('change',() => {
  const date = captureDate.value;
  if (!date) { captureDate.value = selectedDate; return; }
  if (date === selectedDate) return;
  if (hasUnsavedChanges && !window.confirm('Changing the date clears this unsaved check-in. Continue?')) {
    captureDate.value = selectedDate;
    return;
  }
  selectedDate = date;
  values = {}; testDrafts = {}; currentIndex = 0; hasUnsavedChanges = false;
  digital?.destroy(); digital = null;
  if (ready) { renderCurrent(); feedback('Date updated. Start a new check-in for this day.'); }
});
document.addEventListener('sessionchange',syncUser);
form.addEventListener('input',event => {
  if (event.target === captureDate) return;
  hasUnsavedChanges = true;
  rememberCurrent(); feedback('Unsaved changes.');
});
previous.addEventListener('click',() => {
  if (!ready) { feedback('Wait for the session check to finish.'); return; }
  if (saving) return;
  rememberCurrent(); currentIndex--; renderCurrent(); feedback('');
});
skip.addEventListener('click',() => {
  if (!ready) { feedback('Wait for the session check to finish.'); return; }
  if (saving) return;
  hasUnsavedChanges = true;
  skipCurrent();
  if (currentIndex === questions.length - 1) { saveAndViewReport(); return; }
  currentIndex++; renderCurrent(); feedback('');
});
form.addEventListener('submit',event => {
  event.preventDefault();
  if (saving) return;
  if (!ready) { feedback('Wait for the session check to finish.'); return; }
  if (digital) {
    if (!digital.validate()) { feedback('Complete the test or choose “Skip”.',true); return; }
    rememberCurrent();
    if (currentIndex < questions.length - 1) { currentIndex++; renderCurrent(); feedback(''); return; }
    saveAndViewReport(); return;
  }
  const input = fields.querySelector('input,select');
  if (!input.value.trim()) { feedback('Complete this answer or choose “Skip”.',true); input.focus(); return; }
  if (!input.reportValidity()) return;
  rememberCurrent();
  if (currentIndex < questions.length - 1) { currentIndex++; renderCurrent(); feedback(''); return; }
  saveAndViewReport();
});
await supabaseReady; void syncUser();
window.addEventListener('pagehide',() => digital?.destroy());
window.addEventListener('pageshow',event => { if (event.persisted) renderCurrent(); });
