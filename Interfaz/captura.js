import {metrics,groups} from './report-data.js';
import {loadMeasurements,saveMeasurements} from './measurement-store.js';
const form = document.querySelector('#captureForm');
const message = document.querySelector('#captureMessage');
let example = false;
function feedback(text,error = false) { message.textContent = text; message.setAttribute('role',error ? 'alert' : 'status'); }
const sections = {...groups,environment:{name:'Entorno de misión'}};
for (const [key,group] of Object.entries(sections)) {
  const fieldset = document.createElement('fieldset'); fieldset.className = 'capture-section';
  const legend = document.createElement('legend'); legend.textContent = group.name; fieldset.append(legend);
  for (const metric of metrics.filter(m => m.group === key)) {
    const field = document.createElement('div'); field.className = 'metric-card';
    const label = document.createElement('label'); label.htmlFor = `capture-${metric.id}`;
    label.textContent = metric.name + (metric.unit ? ` (${metric.unit})` : '');
    const input = document.createElement(metric.options ? 'select' : 'input'); input.id = label.htmlFor; input.name = metric.id;
    if (metric.options) { input.add(new Option('Sin datos','')); metric.options.forEach(([value,text]) => input.add(new Option(text,value))); }
    else { input.type = 'number'; input.min = '0'; input.step = metric.step; input.placeholder = 'Sin datos'; if (metric.max !== undefined) input.max = metric.max; }
    const ranges = document.createElement('p'); ranges.id = `capture-range-${metric.id}`; ranges.className = 'metric-ranges'; ranges.textContent = metric.ranges; input.setAttribute('aria-describedby',ranges.id);
    field.append(label,input,ranges); fieldset.append(field);
    if (metric.id === 'sleep') {
      const label = document.createElement('label'); label.htmlFor = 'capture-sleepDays'; label.textContent = 'Noches consecutivas con menos de 6 h';
      const nights = document.createElement('input'); nights.type = 'number'; nights.name = 'sleepDays'; nights.id = label.htmlFor; nights.min = '0'; nights.step = '1'; nights.placeholder = 'Sin datos'; field.append(label,nights);
    }
  }
  document.querySelector('#captureFields').append(fieldset);
}
function fill(values) { for (const input of form.querySelectorAll('input,select')) input.value = values[input.name] ?? ''; }
try {
  const saved = loadMeasurements();
  if (saved) { fill(saved.values); example = saved.example; feedback(example ? 'Ejemplo guardado cargado. No son mediciones personales.' : 'Mediciones guardadas cargadas. Puedes actualizarlas.'); }
} catch { feedback('No se pudieron cargar los datos locales. Puedes capturar y guardar nuevos datos.',true); }
form.addEventListener('input',() => feedback(example ? 'Ejemplo editado, sin guardar. Sigue identificado como ejemplo.' : 'Cambios sin guardar.'));
document.querySelector('#captureExample').addEventListener('click',() => {
  fill({sleep:6.1,sleepDays:0,pvt:265,hrv:42,amsler:'green',co2:2850,fluids:2,tlx:60,calcium:280,radiation:.43,dose:146,gravity:'red',pressure:101.3,ventilation:.12});
  example = true; feedback('Ejemplo ilustrativo cargado. Guarda para consultarlo en Reporte.');
});
document.querySelector('#captureClear').addEventListener('click',() => { fill({}); example = false; feedback('Formulario vacío. Guarda para reemplazar los datos anteriores.'); });
form.addEventListener('submit',event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  try {
    const values = Object.fromEntries(new FormData(form));
    saveMeasurements(values,example);
    window.location.assign('reporte.html');
  } catch (error) { feedback(error.message || 'No se pudieron guardar los datos en este navegador.',true); }
});
