import {metrics,affectedOrgans,classify,emergencyScore} from './report-data.js';
import {loadMeasurements} from './measurement-store.js';
import {fetchDatabaseMeasurements} from './report-source.js';
import {supabaseReady,getCurrentUser} from './auth.js';
import {createAnatomyView} from './body-anatomy.js';
const bodyOverview = document.querySelector('#bodyOverview');
const message = document.querySelector('#reportMessage');
const allMeasurements = document.querySelector('#allMeasurements');
const measurementHistory = document.querySelector('#measurementHistory');
const reportDetails = document.querySelector('#reportDetails');
const statusNames = {green:'Verde · Normal',yellow:'Amarillo · Atención',red:'Rojo · Alerta',missing:'Sin datos',unknown:'Sin clasificar',invalid:'Dato inválido'};
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
const anatomyView = createAnatomyView(bodyOverview,metricValue);
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
const crewPage = document.querySelector('[data-crew-report]');
const crewSelect = document.querySelector('#crewMember');
let version = 0;
crewSelect?.addEventListener('change',render);
async function render() {
  const request = ++version;
  anatomyView.update({},{}); message.textContent = 'Consultando datos\u2026';
  allMeasurements.replaceChildren(); measurementHistory.replaceChildren();
  const client = await supabaseReady;
  const viewerId = getCurrentUser()?.id;
  let userId = viewerId;
  if (crewPage) {
    const controls = document.querySelector('.crew-controls'); controls.hidden = true;
    if (!client || !viewerId) { message.textContent = 'Inicia sesión con una cuenta cuyo rol sea doctor o capitán para consultar los reportes.'; return; }
    const {data:members,error} = await client.rpc('get_mission_report_members');
    if (request !== version || viewerId !== getCurrentUser()?.id) return;
    if (error || !members?.length) {
      crewSelect.replaceChildren();
      message.textContent = error?.code === '42501'
        ? 'Solo las cuentas con rol doctor o capitán pueden consultar los reportes.'
        : error ? 'No se pudieron consultar los integrantes. Revisa la conexión y las migraciones de Supabase.' : 'No hay integrantes en esta misión.';
      return;
    }
    const selected = crewSelect.value;
    crewSelect.replaceChildren(...members.map(member => {
      const option = document.createElement('option'); option.value = member.id; option.textContent = member.username; return option;
    }));
    crewSelect.value = members.some(member => member.id === selected) ? selected : members[0].id;
    userId = crewSelect.value; controls.hidden = false;
  }
  const [manualResult,database] = await Promise.all([
    client && userId ? loadMeasurements(client,userId,{missionRead:Boolean(crewPage)}).then(data => ({data,error:null}),error => ({data:null,error})) : Promise.resolve({data:null,error:null}),
    fetchDatabaseMeasurements(client,userId,{missionRead:Boolean(crewPage)}),
  ]);
  if (request !== version || viewerId !== getCurrentUser()?.id) return;
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
  anatomyView.update(actualValues,dates);
  const applicable = metrics.filter(m => m.group !== 'environment');
  const classified = applicable.filter(m => ['green','yellow','red'].includes(classify(m,actualValues[m.id],actualValues))).length;
  const score = emergencyScore(actualValues);
  const canClearEmergency = !manualResult.error && !database.warnings.length && classified === applicable.length;
  const shouldSyncEmergency = score > 10 || canClearEmergency;
  let emergencyError = '';
  if (!crewPage && client && userId && shouldSyncEmergency) {
    try {
      const {error} = await client.rpc('sync_health_emergency_for_user',{p_user_id:userId,p_score:score});
      if (error) emergencyError = ' No se pudo enviar la alerta a las cuentas registradas.';
      else document.dispatchEvent(new Event('healthstatuschange'));
    } catch {
      emergencyError = ' No se pudo enviar la alerta a las cuentas registradas.';
    }
  }
  if (request !== version || viewerId !== getCurrentUser()?.id) return;
  const organs = affectedOrgans(actualValues);
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
