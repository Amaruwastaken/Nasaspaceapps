import {metrics,groups,classify,summarize} from './report-data.js';
import {loadMeasurements} from './measurement-store.js';
let values = {};
try {
  const saved = loadMeasurements();
  if (saved) {
    values = saved.values;
    document.querySelector('#reportMode').textContent = (saved.example ? 'EJEMPLO ILUSTRATIVO | ' : 'Mediciones guardadas | ') + new Date(saved.savedAt).toLocaleString('es-MX');
  }
} catch { document.querySelector('#reportMode').textContent = 'No se pudieron cargar las mediciones. Abre Captura para guardarlas de nuevo.'; }
const labels = {green:'En rango',yellow:'Atención',red:'Alerta',missing:'Sin datos',unknown:'Sin umbral definido',invalid:'Valor inválido'};
let current = 'brain';
const stage = document.querySelector('#anatomyStage');
function metricCard(metric) {
  const card = document.createElement('div'); card.className = 'metric-card'; card.dataset.metric = metric.id;
  const label = document.createElement('strong'); label.className = 'metric-label';
  label.textContent = metric.name;
  const value = document.createElement('p'); value.className = 'metric-value';
  const raw = values[metric.id];
  value.textContent = raw === undefined || raw === '' ? 'Sin datos' : metric.options ? metric.options.find(([key]) => key === raw)?.[1] ?? 'Sin datos' : String(raw) + (metric.unit ? ' ' + metric.unit : '');
  const status = document.createElement('span'); status.className = 'metric-status';
  const ranges = document.createElement('p'); ranges.className = 'metric-ranges'; ranges.textContent = metric.ranges;
  const note = document.createElement('p'); note.className = 'metric-note'; note.textContent = metric.note;
  card.append(label,value,status,ranges,note);
  if (metric.id === 'sleep') {
    const nights = document.createElement('p'); nights.className = 'metric-note';
    nights.textContent = 'Noches consecutivas con menos de 6 h: ' + (values.sleepDays ?? 'Sin datos'); card.append(nights);
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
selectRegion(current,false);
