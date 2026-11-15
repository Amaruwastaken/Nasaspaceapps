import {metrics,affectedOrgans,classify,emergencyScore} from './report-data.js';
import {loadMeasurements} from './measurement-store.js';
import {fetchDatabaseMeasurements} from './report-source.js';
import {supabaseReady,getCurrentUser} from './auth.js';
const list = document.querySelector('#affectedOrgans');
const bodyIndicatorsLeft = document.querySelector('#bodyIndicatorsLeft');
const bodyIndicatorsRight = document.querySelector('#bodyIndicatorsRight');
const message = document.querySelector('#reportMessage');
const allMeasurements = document.querySelector('#allMeasurements');
const measurementHistory = document.querySelector('#measurementHistory');
const reportDetails = document.querySelector('#reportDetails');
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
    const formatted = metricValue(metric,value);
    line.textContent = `${metric.name}: ${formatted}`;
    if (dates[metric.id]) { const date = document.createElement('small'); date.textContent = ` · ${dates[metric.id]}`; line.append(date); }
    content.append(line);
  }
  card.append(svg,content); return card;
}
const statusNames = {green:'Verde · Normal',yellow:'Amarillo · Atención',red:'Rojo · Alerta',missing:'Sin datos',unknown:'Sin clasificar',invalid:'Dato inválido'};
const bodyAreas = [
  {id:'brain',name:'Cerebro',side:'left'},
  {id:'eyes',name:'Ojos',side:'left'},
  {id:'heart',name:'Corazón',side:'right'},
  {id:'stomach',name:'Estómago y riñones',side:'right'},
  {id:'body',name:'Cuerpo',side:'right'},
];
const bodyStateNames = {green:'Bien',yellow:'Atención',red:'Mal',unknown:'Sin clasificar',missing:'Sin datos'};
function metricValue(metric,value) {
  if (value === undefined || value === null || value === '') return 'Sin datos';
  if (metric.fields && typeof value === 'object' && !Array.isArray(value)) {
    return metric.fields.map(field => {
      const raw = value[field.id];
      const formatted = raw === undefined || raw === '' ? 'Sin datos' :
        field.options ? field.options.find(([key]) => key === raw)?.[1] ?? String(raw) : `${raw}${field.unit ? ` ${field.unit}` : ''}`;
      return `${field.label}: ${formatted}`;
    }).join(' · ');
  }
  if (metric.id === 'bodyFat' || metric.id === 'hemoglobin') {
    if (typeof value === 'object' && !Array.isArray(value)) return `${value.value}${metric.unit ? ` ${metric.unit}` : ''}`;
  }
  if (metric.id === 'boneDensity' && typeof value === 'object' && !Array.isArray(value)) {
    return `T-score ${value.tScore} · pérdida ${value.monthlyLoss}%/mes`;
  }
  if (metric.options) return metric.options.find(([key]) => key === value)?.[1] ?? String(value);
  return `${value}${metric.unit ? ` ${metric.unit}` : ''}`;
}
function bodyAreaState(states) {
  if (states.includes('red')) return 'red';
  if (states.includes('yellow')) return 'yellow';
  if (states.includes('green')) return 'green';
  if (states.includes('unknown') || states.includes('invalid')) return 'unknown';
  return 'missing';
}
function bodyIndicatorCard(area,values,dates) {
  const areaMetrics = metrics.filter(metric => metric.group === area.id || metric.organs?.includes(area.id));
  const states = areaMetrics.map(metric => classify(metric,values[metric.id],values));
  const state = bodyAreaState(states);
  const counts = Object.fromEntries(['green','yellow','red','missing'].map(name => [name,states.filter(item => item === name).length]));
  counts.unclassified = states.filter(item => item === 'unknown' || item === 'invalid').length;
  const card = document.createElement('article'); card.className = 'body-stat-card'; card.dataset.state = state;
  const heading = document.createElement('div'); heading.className = 'body-stat-heading';
  const dot = document.createElement('span'); dot.className = 'body-stat-dot'; dot.dataset.state = state; dot.setAttribute('aria-hidden','true');
  const title = document.createElement('h3'); title.textContent = area.name;
  const label = document.createElement('span'); label.className = 'body-stat-state';
  label.textContent = state === 'green' && (counts.missing || counts.unclassified) ? 'Bien · parcial' : bodyStateNames[state];
  heading.append(dot,title,label);
  const summary = document.createElement('p'); summary.className = 'body-stat-counts';
  summary.textContent = `${counts.green} verde · ${counts.yellow} atención · ${counts.red} rojo · ${counts.missing} sin datos · ${counts.unclassified} sin clasificar`;
  card.append(heading,summary);

  const priority = {red:0,yellow:1,green:2,unknown:3,invalid:4};
  const available = areaMetrics.map(metric => ({metric,state:classify(metric,values[metric.id],values)}))
    .filter(item => item.state !== 'missing')
    .sort((a,b) => priority[a.state] - priority[b.state])
    .slice(0,3);
  if (available.length) {
    const readings = document.createElement('ul'); readings.className = 'body-stat-readings';
    for (const {metric,state:metricState} of available) {
      const item = document.createElement('li'); item.className = 'body-stat-reading'; item.dataset.state = metricState;
      const readingDot = document.createElement('span'); readingDot.className = 'body-reading-dot'; readingDot.dataset.state = metricState; readingDot.setAttribute('aria-hidden','true');
      const reading = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = metric.name;
      const value = document.createElement('small'); value.textContent = `${metricValue(metric,values[metric.id])} · ${statusNames[metricState] ?? metricState}${dates[metric.id] ? ` · ${dates[metric.id]}` : ''}`;
      reading.append(name,value); item.append(readingDot,reading); readings.append(item);
    }
    card.append(readings);
  } else {
    const empty = document.createElement('p'); empty.className = 'body-stat-empty'; empty.textContent = 'Todavía no hay mediciones disponibles.';
    card.append(empty);
  }
  return {card,state,name:area.name};
}
function renderBodyOverview(values,dates) {
  bodyIndicatorsLeft.replaceChildren(); bodyIndicatorsRight.replaceChildren();
  for (const area of bodyAreas) {
    const {card,state,name} = bodyIndicatorCard(area,values,dates);
    (area.side === 'left' ? bodyIndicatorsLeft : bodyIndicatorsRight).append(card);
    const marker = document.querySelector(`[data-body-marker="${area.id}"]`);
    marker.dataset.state = state;
    marker.setAttribute('aria-label',`${name}: ${bodyStateNames[state]}`);
    marker.querySelector('title').textContent = `${name}: ${bodyStateNames[state]}`;
  }
}
function detailSection(title) {
  const section = document.createElement('section'); section.className = 'report-detail-section';
  const heading = document.createElement('h2'); heading.textContent = title; section.append(heading);
  return section;
}
function renderTable(section,captionText,headers,rows,emptyMessage) {
  if (!rows.length) {
    const note = document.createElement('p'); note.className = 'report-detail-note'; note.textContent = emptyMessage; section.append(note); return;
  }
  const wrap = document.createElement('div'); wrap.className = 'report-table-wrap';
  const table = document.createElement('table');
  const caption = table.createCaption(); caption.textContent = captionText;
  const header = table.createTHead().insertRow();
  for (const title of headers) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; header.append(cell); }
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const value of row) tr.insertCell().textContent = value === null || value === undefined || value === '' ? '—' : String(value);
  }
  wrap.append(table); section.append(wrap);
}
function renderDetails(values,dates,history,userId,simulatedMetrics,partiallySimulatedMetrics) {
  allMeasurements.replaceChildren(); measurementHistory.replaceChildren();
  reportDetails.open = false;

  const current = detailSection('Mediciones disponibles');
  renderTable(current,'Último valor conocido de cada indicador',['Medición','Valor','Estado','Fecha','Origen'],
    metrics.map(metric => {
      const state = classify(metric,values[metric.id],values);
      const origin = partiallySimulatedMetrics.has(metric.id) ? 'Incluye datos simulados'
        : simulatedMetrics.has(metric.id) ? 'Simulado (prototipo)'
          : metric.source === 'manual' ? 'Captura / registro diario' : 'Sensores';
      return [metric.name,metricValue(metric,values[metric.id]),statusNames[state] ?? state,dates[metric.id] ?? '—',
        origin];
    }),
    'Todavía no hay mediciones disponibles.');
  allMeasurements.append(current);

  if (!userId) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'Inicia sesión para consultar el historial completo guardado en la base de datos.';
    measurementHistory.append(note);
    return;
  }

  const records = detailSection('Historial de registros diarios');
  if (!history.recordsLoaded) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'No se pudo cargar el historial completo de registros.';
    records.append(note);
  } else {
    renderTable(records,'Todos los registros diarios',['Fecha','Entorno','Sueño (h)','NASA-TLX (/100)','Reacción promedio (ms)','Reacción máxima (ms)','Salidas en falso'],
      history.records.map(row => [row.date,row.env,row.sleep,row.tlx,row.pvt,row.pvt_max,row.fs]),
      'Aún no hay registros diarios guardados.');
  }
  measurementHistory.append(records);

  const sensors = detailSection('Historial de sensores');
  if (!history.sensorsLoaded) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'No se pudo cargar el historial completo de sensores.';
    sensors.append(note);
  } else {
    renderTable(sensors,'Todos los resúmenes diarios de sensores',['Fecha','Pulso medio (lpm)','Pulso máximo (lpm)','Temperatura media (°C)','SpO₂ mínima (%)','Radiación diaria (mSv)','CO₂ máximo (ppm)','HRV RMSSD (ms)'],
      history.sensors.map(row => [row.date,row.hr_avg,row.hr_max,row.temp_avg,row.spo2_min,row.rad_msv,row.co2_max,row.rmssd]),
      'Aún no hay datos de sensores guardados.');
  }
  measurementHistory.append(sensors);
}
let version = 0;
async function render() {
  const request = ++version;
  list.replaceChildren(); message.textContent = 'Consultando datos…';
  allMeasurements.replaceChildren(); measurementHistory.replaceChildren();
  const client = await supabaseReady;
  const userId = getCurrentUser()?.id;
  const [manualResult,database] = await Promise.all([
    client && userId ? loadMeasurements(client,userId).then(data => ({data,error:null}),error => ({data:null,error})) : Promise.resolve({data:null,error:null}),
    fetchDatabaseMeasurements(client,userId),
  ]);
  if (request !== version || userId !== getCurrentUser()?.id) return;
  const manual = manualResult.data;
  const actualValues = {...database.values};
  const dates = {...database.dates};
  // A saved snapshot is authoritative: skipped tests must not resurrect older records.
  if (manual || manualResult.error) for (const metric of metrics.filter(m => m.source === 'manual')) {
    delete actualValues[metric.id]; delete dates[metric.id];
  }
  Object.assign(actualValues,manual?.values);
  if (manual) for (const id of Object.keys(manual.values)) dates[id] = new Date(manual.savedAt).toLocaleDateString('es-MX');
  const values = {...actualValues};
  const simulatedMetrics = new Set(), partiallySimulatedMetrics = new Set();
  const simulatedDate = database.simulatedAt ? new Date(database.simulatedAt).toLocaleDateString('es-MX') : null;
  for (const [id,simulated] of Object.entries(database.simulatedValues ?? {})) {
    const actual = values[id];
    if (actual === undefined || actual === null || actual === '') {
      values[id] = simulated;
      simulatedMetrics.add(id);
      if (simulatedDate) dates[id] = simulatedDate;
    } else if (actual && simulated && typeof actual === 'object' && typeof simulated === 'object' && !Array.isArray(actual) && !Array.isArray(simulated)) {
      const combined = {...simulated,...actual};
      let completedMissingField = false;
      for (const [field,value] of Object.entries(simulated)) {
        if (actual[field] === undefined || actual[field] === null || actual[field] === '') {
          combined[field] = value;
          completedMissingField = true;
        }
      }
      if (completedMissingField) {
        values[id] = combined;
        partiallySimulatedMetrics.add(id);
        if (simulatedDate) dates[id] ??= simulatedDate;
      }
    }
  }
  renderDetails(values,dates,database.history,userId,simulatedMetrics,partiallySimulatedMetrics);
  renderBodyOverview(actualValues,dates);
  const applicable = metrics.filter(m => m.group !== 'environment');
  const classified = applicable.filter(m => ['green','yellow','red'].includes(classify(m,actualValues[m.id],actualValues))).length;
  const score = emergencyScore(actualValues);
  const canClearEmergency = !manualResult.error && !database.warnings.length && classified === applicable.length;
  const shouldSyncEmergency = score > 10 || canClearEmergency;
  let emergencyError = '';
  if (client && userId && shouldSyncEmergency) {
    try {
      const {error} = await client.rpc('sync_health_emergency_for_user',{p_user_id:userId,p_score:score});
      if (error) emergencyError = ' No se pudo enviar la alerta a las cuentas registradas.';
      else document.dispatchEvent(new Event('healthstatuschange'));
    } catch {
      emergencyError = ' No se pudo enviar la alerta a las cuentas registradas.';
    }
  }
  if (request !== version || userId !== getCurrentUser()?.id) return;
  const organs = affectedOrgans(actualValues);
  list.replaceChildren(...organs.map(organ => organCard(organ,dates)));
  const missingAutomatic = metrics.filter(m => m.source !== 'manual' && classify(m,actualValues[m.id],actualValues) === 'missing');
  const simulatedCount = simulatedMetrics.size + partiallySimulatedMetrics.size;
  const parts = [];
  if (!classified) parts.push('No hay datos suficientes para evaluar los órganos.');
  else if (!organs.length) parts.push('Sin órganos en atención o alerta en los datos disponibles.');
  else parts.push(`${organs.length} ${organs.length === 1 ? 'región requiere' : 'regiones requieren'} atención.`);
  if (missingAutomatic.length) parts.push(`No hay suficiente información automática real para ${missingAutomatic.length} ${missingAutomatic.length === 1 ? 'medición' : 'mediciones'}; los datos simulados solo sirven como referencia.`);
  if (database.history.telemetrySimulated) parts.push('La última lectura automática es genérica y simulada para el prototipo.');
  if (simulatedCount) parts.push(`${simulatedCount} ${simulatedCount === 1 ? 'medición se completa' : 'mediciones se completan'} con datos simulados; no se usan para alertas.`);
  if (classified < applicable.length) parts.push('Evaluación parcial: hay mediciones sin datos o pendientes de conexión.');
  if (!userId) parts.push('Inicia sesión para consultar las mediciones de la base de datos.');
  if (manualResult.error) parts.push(manualResult.error.message || 'No se pudieron consultar las pruebas de Captura en Supabase.');
  if (emergencyError) parts.push(emergencyError);
  parts.push(...database.warnings); message.textContent = parts.join(' ');
}
// Clear/reload on account changes; stale responses cannot show another user's data.
document.addEventListener('sessionchange',render);
void render();
