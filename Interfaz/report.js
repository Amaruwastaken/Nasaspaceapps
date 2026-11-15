import {metrics,groups,classify,summarize} from './report-data.js';
const values = {};
const labels = {green:'En rango',yellow:'Atención',red:'Alerta',missing:'Sin datos',unknown:'Sin umbral definido',invalid:'Valor inválido'};
let current = 'brain';
const stage = document.querySelector('#anatomyStage');
function markEdited() {
  document.querySelector('#reportMode').textContent = 'Datos editados en esta sesión · No guardados';
}
function metricCard(metric) {
  const card = document.createElement('div'); card.className = 'metric-card'; card.dataset.metric = metric.id;
  const label = document.createElement('label'); label.htmlFor = `metric-${metric.id}`;
  label.textContent = metric.name + (metric.unit ? ` (${metric.unit})` : '');
  const input = document.createElement(metric.options ? 'select' : 'input'); input.id = label.htmlFor;
  if (metric.options) {
    input.add(new Option('Selecciona un resultado',''));
    metric.options.forEach(([key,text]) => input.add(new Option(text,key)));
  } else { input.type = 'number'; input.min = '0'; input.step = metric.step; input.placeholder = 'Sin datos'; if (metric.max !== undefined) input.max = metric.max; }
  input.value = values[metric.id] ?? '';
  input.setAttribute('aria-describedby',`status-${metric.id} ranges-${metric.id}`);
  const status = document.createElement('span'); status.className = 'metric-status'; status.id = `status-${metric.id}`;
  const ranges = document.createElement('p'); ranges.className = 'metric-ranges'; ranges.id = `ranges-${metric.id}`; ranges.textContent = metric.ranges;
  const note = document.createElement('p'); note.className = 'metric-note'; note.textContent = metric.note;
  input.addEventListener('input',() => { values[metric.id] = input.value; markEdited(); update(); });
  card.append(label,input,status,ranges,note);
  if (metric.id === 'sleep') {
    const nightsLabel = document.createElement('label'); nightsLabel.htmlFor = 'sleepDays'; nightsLabel.textContent = 'Noches consecutivas con menos de 6 h';
    const nights = document.createElement('input'); nights.type = 'number'; nights.id = 'sleepDays'; nights.min = '0'; nights.step = '1'; nights.placeholder = 'Sin datos'; nights.value = values.sleepDays ?? '';
    nights.addEventListener('input',() => { values.sleepDays = nights.value; markEdited(); update(); }); card.append(nightsLabel,nights);
  }
  return card;
}
function selectRegion(region, emphasize = true) {
  current = region;
  document.querySelector('#organTitle').textContent = groups[region].name;
  document.querySelector('#organDescription').textContent = groups[region].description;
  document.querySelector('#organMetrics').replaceChildren(...metrics.filter(m => m.group === region).map(metricCard));
  stage.classList.toggle('is-focused',emphasize);
  document.querySelectorAll('[data-region]').forEach(el => {
    el.classList.toggle('is-active',el.dataset.region === region);
    el.setAttribute('aria-pressed',String(el.dataset.region === region));
  });
  document.querySelectorAll('[data-select-region]').forEach(el => el.setAttribute('aria-pressed',String(el.dataset.selectRegion === region)));
  update();
}
function update() {
  for (const metric of metrics) {
    const state = classify(metric,values[metric.id],values);
    const card = document.querySelector(`[data-metric="${metric.id}"]`);
    if (card) {
      card.dataset.state = state; card.querySelector('.metric-status').textContent = labels[state];
      card.querySelector('input,select').setAttribute('aria-invalid',String(state === 'invalid'));
    }
  }
  const summary = summarize(values);
  document.querySelector('#healthScore').textContent = summary.score === null ? 'Sin datos' : `${summary.score} / 100`;
  const meter = document.querySelector('#healthMeter');
  if (summary.score === null) meter.removeAttribute('aria-valuenow');
  else meter.setAttribute('aria-valuenow',String(summary.score));
  meter.setAttribute('aria-valuetext',summary.score === null ? 'Sin datos clasificados' : `${summary.score} de 100; ${summary.count} de ${summary.total} indicadores clasificados`);
  document.querySelector('#healthFill').style.width = `${summary.score ?? 0}%`;
  document.querySelector('#healthCoverage').textContent = `${summary.count} de ${summary.total} indicadores clasificados · ${summary.total-summary.count} sin clasificar · ${summary.alerts} en alerta.`;
}
document.querySelector('#environmentMetrics').replaceChildren(...metrics.filter(m => m.group === 'environment').map(metricCard));
document.querySelectorAll('[data-region]').forEach(el => {
  const select = () => selectRegion(el.dataset.region);
  el.addEventListener('pointerenter',event => {
    if (event.pointerType !== 'touch' && !stage.contains(document.activeElement)) select();
  });
  el.addEventListener('focus',select); el.addEventListener('click',select);
  el.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
});
stage.addEventListener('pointerleave',() => { if (!stage.contains(document.activeElement)) stage.classList.remove('is-focused'); });
stage.addEventListener('focusout',event => { if (!stage.contains(event.relatedTarget)) stage.classList.remove('is-focused'); });
document.addEventListener('keydown',event => { if (event.key === 'Escape') stage.classList.remove('is-focused'); });
document.querySelectorAll('[data-select-region]').forEach(el => el.addEventListener('click',() => selectRegion(el.dataset.selectRegion)));
function reloadInputs() {
  document.querySelector('#environmentMetrics').replaceChildren(...metrics.filter(m => m.group === 'environment').map(metricCard));
  selectRegion(current,false);
}
document.querySelector('#reportDemo').addEventListener('click',() => {
  Object.assign(values,{sleep:6.1,sleepDays:0,pvt:265,hrv:42,amsler:'green',co2:2850,fluids:2,tlx:60,calcium:280,radiation:.43,dose:146,gravity:'red',pressure:101.3,ventilation:.12});
  document.querySelector('#reportMode').textContent = 'EJEMPLO ILUSTRATIVO · Datos simulados, no personales'; reloadInputs();
});
document.querySelector('#reportClear').addEventListener('click',() => {
  Object.keys(values).forEach(key => delete values[key]);
  document.querySelector('#reportMode').textContent = 'Sin mediciones personales'; reloadInputs();
});
selectRegion(current,false);
