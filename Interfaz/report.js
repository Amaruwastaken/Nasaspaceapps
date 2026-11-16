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
const statusNames = {green:'Green · Normal',yellow:'Yellow · Caution',red:'Red · Alert',missing:'No data',unknown:'Unclassified',invalid:'Invalid data'};
function metricValue(metric,value) {
  if (value === undefined || value === null || value === '') return 'No data';
  if (metric.fields && typeof value === 'object' && !Array.isArray(value)) {
    return metric.fields.map(field => {
      const raw = value[field.id];
      const formatted = raw === undefined || raw === '' ? 'No data' :
        field.options ? field.options.find(([key]) => key === raw)?.[1] ?? String(raw) : `${raw}${field.unit ? ` ${field.unit}` : ''}`;
      return `${field.label}: ${formatted}`;
    }).join(' · ');
  }
  if (metric.id === 'bodyFat' || metric.id === 'hemoglobin') {
    if (typeof value === 'object' && !Array.isArray(value)) return `${value.value}${metric.unit ? ` ${metric.unit}` : ''}`;
  }
  if (metric.id === 'boneDensity' && typeof value === 'object' && !Array.isArray(value)) {
    return `T-score ${value.tScore} · loss ${value.monthlyLoss}%/month`;
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

  const current = detailSection('Available measurements');
  renderTable(current,'Latest known value for each indicator',['Measurement','Value','Status','Date','Source'],
    metrics.map(metric => {
      const state = classify(metric,values[metric.id],values);
      const origin = partiallySimulatedMetrics.has(metric.id) ? 'Includes simulated data'
        : simulatedMetrics.has(metric.id) ? 'Simulated (prototype)'
          : metric.source === 'manual' ? 'Check-in / daily log' : 'Sensors';
      return [metric.name,metricValue(metric,values[metric.id]),statusNames[state] ?? state,dates[metric.id] ?? '—',
        origin];
    }),
    'No measurements are available yet.');
  allMeasurements.append(current);

  if (!userId) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'Sign in to view the full history saved in the database.';
    measurementHistory.append(note);
    return;
  }

  const records = detailSection('Daily log history');
  if (!history.recordsLoaded) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'Could not load the full log history.';
    records.append(note);
  } else {
    renderTable(records,'All daily logs',['Date','Environment','Sleep (h)','NASA-TLX (/100)','Average reaction time (ms)','Slowest reaction time (ms)','False starts'],
      history.records.map(row => [row.date,row.env,row.sleep,row.tlx,row.pvt,row.pvt_max,row.fs]),
      'No daily logs have been saved yet.');
  }
  measurementHistory.append(records);

  const sensors = detailSection('Sensor history');
  if (!history.sensorsLoaded) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'Could not load the full sensor history.';
    sensors.append(note);
  } else {
    renderTable(sensors,'All daily sensor summaries',['Date','Average heart rate (bpm)','Maximum heart rate (bpm)','Average temperature (C)','Minimum SpO2 (%)','Daily radiation (mSv)','Maximum CO2 (ppm)','HRV RMSSD (ms)'],
      history.sensors.map(row => [row.date,row.hr_avg,row.hr_max,row.temp_avg,row.spo2_min,row.rad_msv,row.co2_max,row.rmssd]),
      'No sensor data has been saved yet.');
  }
  measurementHistory.append(sensors);
}
const crewPage = document.querySelector('[data-crew-report]');
const crewSelect = document.querySelector('#crewMember');
let version = 0;
crewSelect?.addEventListener('change',render);
async function render() {
  const request = ++version;
  anatomyView.update({},{}); message.textContent = 'Loading data\u2026';
  allMeasurements.replaceChildren(); measurementHistory.replaceChildren();
  const client = await supabaseReady;
  const viewerId = getCurrentUser()?.id;
  let userId = viewerId;
  if (crewPage) {
    const controls = document.querySelector('.crew-controls'); controls.hidden = true;
    if (!client || !viewerId) { message.textContent = 'Sign in as a doctor or commander to view mission reports.'; return; }
    const {data:members,error} = await client.rpc('get_mission_report_members');
    if (request !== version || viewerId !== getCurrentUser()?.id) return;
    if (error || !members?.length) {
      crewSelect.replaceChildren();
      message.textContent = error?.code === '42501'
        ? 'Only doctor or commander accounts can view reports. If you have the right role, ask an administrator to grant access.'
        : error ? 'Could not load crew members. Check the connection and Supabase migrations.' : 'There are no crew members on this mission.';
      return;
    }
    const selected = crewSelect.value;
    crewSelect.replaceChildren(...members.map(member => {
      const option = document.createElement('option'); option.value = member.id; // Profiles append the first 12 UUID characters to names for uniqueness.
      // Keep that identifier as the option value, never in the visible label.
      const suffix = '-' + member.id.replaceAll('-','').slice(0,12);
      const name = member.username ?? '';
      option.textContent = (name.endsWith(suffix) ? name.slice(0,-suffix.length) : name).trim() || 'Crew member'; return option;
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
  if (manual) for (const id of Object.keys(manual.values)) dates[id] = new Date(manual.savedAt).toLocaleDateString('en-US');
  const values = {...actualValues};
  const simulatedMetrics = new Set(), partiallySimulatedMetrics = new Set();
  const simulatedDate = database.simulatedAt ? new Date(database.simulatedAt).toLocaleDateString('en-US') : null;
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
      if (error) emergencyError = ' Could not send the alert to registered accounts.';
      else document.dispatchEvent(new Event('healthstatuschange'));
    } catch {
      emergencyError = ' Could not send the alert to registered accounts.';
    }
  }
  if (request !== version || viewerId !== getCurrentUser()?.id) return;
  const organs = affectedOrgans(actualValues);
  const missingAutomatic = metrics.filter(m => m.source !== 'manual' && classify(m,actualValues[m.id],actualValues) === 'missing');
  const simulatedCount = simulatedMetrics.size + partiallySimulatedMetrics.size;
  const parts = [];
  if (!classified) parts.push('There is not enough data to assess the body regions.');
  else if (!organs.length) parts.push('No body regions are in caution or alert status in the available data.');
  else parts.push(`${organs.length} ${organs.length === 1 ? 'region needs' : 'regions need'} attention.`);
  if (missingAutomatic.length) parts.push(`There is not enough real sensor data for ${missingAutomatic.length} ${missingAutomatic.length === 1 ? 'measurement' : 'measurements'}; simulated data is for reference only.`);
  if (database.history.telemetrySimulated) parts.push('The latest automatic reading is generic and simulated for this prototype.');
  if (simulatedCount) parts.push(`${simulatedCount} ${simulatedCount === 1 ? 'measurement is completed' : 'measurements are completed'} with simulated data; these are not used for alerts.`);
  if (classified < applicable.length) parts.push('Partial assessment: some measurements are missing or not connected.');
  if (!userId) parts.push('Sign in to view database measurements.');
  if (manualResult.error) parts.push(manualResult.error.message || 'Could not load check-in tests from Supabase.');
  if (emergencyError) parts.push(emergencyError);
  parts.push(...database.warnings); message.textContent = parts.join(' ');
}
// Clear/reload on account changes; stale responses cannot show another user's data.
document.addEventListener('sessionchange',render);
void render();
