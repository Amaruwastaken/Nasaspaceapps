import {metrics,affectedOrgans,classify} from './report-data.js';
import {loadMeasurements} from './measurement-store.js';
import {fetchDatabaseMeasurements} from './report-source.js';
import {supabaseReady,getCurrentUser} from './auth.js';
const list = document.querySelector('#affectedOrgans');
const message = document.querySelector('#reportMessage');
const drawings = {
  brain:'M50 20C35 6 13 20 17 36C4 46 14 66 30 64Q38 78 50 65Q62 78 70 64C86 66 96 46 83 36C87 20 65 6 50 20ZM50 23V63M29 28Q45 30 35 46M70 28Q55 30 65 46M20 48L31 53M69 53L80 48',
  heart:'M50 80C39 68 10 50 13 30C15 10 41 9 50 28C59 9 85 10 87 30C90 50 61 68 50 80Z',
  eyes:'M5 48Q25 18 47 48Q25 78 5 48ZM53 48Q75 18 95 48Q75 78 53 48ZM26 39A9 9 0 1 0 26 57A9 9 0 1 0 26 39M74 39A9 9 0 1 0 74 57A9 9 0 1 0 74 39',
  stomach:'M49 10L49 33Q85 19 84 50C83 77 52 88 28 71Q13 59 25 46Q35 38 40 51Q53 56 58 43L39 35 39 10Z',
  kidneys:'M33 18C5 15 6 75 29 77Q46 77 41 59L31 48Q47 30 33 18ZM67 18C95 15 94 75 71 77Q54 77 59 59L69 48Q53 30 67 18Z',
  body:'M50 7A11 11 0 1 0 50 29A11 11 0 1 0 50 7M36 34L24 64 32 68 40 49 39 69 35 91 45 91 50 72 55 91 65 91 61 69 60 49 68 68 76 64 64 34Z',
};
function organCard(organ,dates) {
  const card = document.createElement('article'); card.className = 'organ-alert'; card.dataset.organ = organ.id; card.dataset.state = organ.state;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 100 100'); svg.setAttribute('aria-hidden','true');
  const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',drawings[organ.id]); svg.append(path);
  const content = document.createElement('div');
  const heading = document.createElement('h2'); heading.textContent = organ.name;
  const badge = document.createElement('span'); badge.className = 'organ-status'; badge.textContent = organ.state === 'red' ? 'Alerta' : 'Atención';
  content.append(heading,badge);
  for (const {metric,value,state} of organ.items) {
    const line = document.createElement('p'); line.className = 'organ-reading'; line.dataset.state = state;
    const formatted = metric.options ? metric.options.find(([key]) => key === value)?.[1] : `${value} ${metric.unit ?? ''}`;
    line.textContent = `${metric.name}: ${formatted}`;
    if (dates[metric.id]) { const date = document.createElement('small'); date.textContent = ` · ${dates[metric.id]}`; line.append(date); }
    content.append(line);
  }
  card.append(svg,content); return card;
}
let version = 0;
async function render() {
  const request = ++version;
  list.replaceChildren(); message.textContent = 'Consultando datos…';
  const client = await supabaseReady;
  const userId = getCurrentUser()?.id;
  let manual = null, localError = false;
  try { manual = loadMeasurements(userId); } catch { localError = true; }
  const database = await fetchDatabaseMeasurements(client,userId);
  if (request !== version || userId !== getCurrentUser()?.id) return;
  const values = {...database.values,...manual?.values};
  const dates = {...database.dates};
  if (manual) for (const id of Object.keys(manual.values)) dates[id] = new Date(manual.savedAt).toLocaleDateString('es-MX');
  const organs = affectedOrgans(values);
  list.replaceChildren(...organs.map(organ => organCard(organ,dates)));
  const applicable = metrics.filter(m => m.group !== 'environment');
  const classified = applicable.filter(m => ['green','yellow','red'].includes(classify(m,values[m.id],values))).length;
  const parts = [];
  if (!classified) parts.push('No hay datos suficientes para evaluar los órganos.');
  else if (!organs.length) parts.push('Sin órganos en atención o alerta en los datos disponibles.');
  else parts.push(`${organs.length} ${organs.length === 1 ? 'región requiere' : 'regiones requieren'} atención.`);
  if (classified < applicable.length) parts.push('Evaluación parcial: hay mediciones sin datos o pendientes de conexión.');
  if (!userId) parts.push('Inicia sesión para consultar las mediciones de la base de datos.');
  if (localError) parts.push('No se pudieron leer las pruebas de Captura.');
  parts.push(...database.warnings); message.textContent = parts.join(' ');
}
// Clear/reload on account changes; stale responses cannot show another user's data.
document.addEventListener('sessionchange',render);
void render();
