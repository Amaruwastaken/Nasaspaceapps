import {metrics,affectedOrgans,classify,emergencyScore} from './report-data.js';
import {loadMeasurements} from './measurement-store.js';
import {fetchDatabaseMeasurements} from './report-source.js';
import {supabaseReady,getCurrentUser} from './auth.js';
import {createAnatomyView} from './body-anatomy.js';
const bodyOverview = document.querySelector('#bodyOverview');
const message = document.querySelector('#reportMessage');
const allMeasurements = document.querySelector('#allMeasurements');
const measurementHistory = document.querySelector('#measurementHistory');
const historyTrends = document.querySelector('#historyTrends');
const historyPeriod = document.querySelector('#historyPeriod');
const historyCategoriesList = document.querySelector('#historyCategories');
const reportDetails = document.querySelector('#reportDetails');
const statusNames = {green:'Green · Normal',yellow:'Yellow · Caution',red:'Red · Alert',missing:'No data',unknown:'Unclassified',invalid:'Invalid data'};
const historyCategoryDefinitions = [
  {id:'brain',name:'Brain and focus',series:[
    {id:'sleep',name:'Sleep duration',source:'records',key:'sleep',unit:'h/night',aggregate:'average'},
    {id:'pvt',name:'Reaction time (PVT)',source:'checkins',fallbackSource:'records',key:'pvt',unit:'ms',aggregate:'average'},
    {id:'tlx',name:'NASA-TLX workload',source:'checkins',fallbackSource:'records',key:'tlx',unit:'points / 100',aggregate:'average'},
    {id:'who5',name:'Psychological well-being (WHO-5)',source:'checkins',key:'who5',unit:'points / 100',aggregate:'average'},
  ]},
  {id:'heart',name:'Heart',series:[
    {id:'hr-average',name:'Average heart rate',source:'sensors',key:'hr_avg',unit:'bpm',aggregate:'average'},
    {id:'hr-maximum',name:'Maximum heart rate',source:'sensors',key:'hr_max',unit:'bpm',aggregate:'maximum'},
    {id:'hrv',name:'Heart rate variability (RMSSD)',source:'sensors',key:'rmssd',unit:'ms',aggregate:'average'},
    {id:'orthostatic-hr',name:'Standing heart-rate increase',source:'checkins',key:'hrRise',unit:'bpm',aggregate:'average'},
  ]},
  {id:'lungs',name:'Lungs',series:[
    {id:'spo2',name:'Minimum oxygen saturation (SpO₂)',source:'sensors',key:'spo2_min',unit:'%',aggregate:'minimum'},
    {id:'co2',name:'Maximum CO₂',source:'sensors',key:'co2_max',unit:'ppm',aggregate:'maximum'},
  ]},
  {id:'body',name:'Body and mission',series:[
    {id:'temperature',name:'Average temperature',source:'sensors',key:'temp_avg',unit:'°C',aggregate:'average'},
    {id:'radiation',name:'Daily radiation',source:'sensors',key:'rad_msv',unit:'mSv',aggregate:'sum'},
    {id:'perfusion',name:'Peripheral perfusion',source:'checkins',key:'perfusion',unit:'seconds',aggregate:'average'},
    {id:'medication',name:'Medication adherence',source:'checkins',key:'medicationPercent',unit:'%',aggregate:'average'},
  ]},
];
const historyColors = {brain:'#5867c7',heart:'#c5443d',lungs:'#168078',body:'#b17b16'};
const svgNamespace = 'http://www.w3.org/2000/svg';
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function recentHistoryDates() {
  const today = new Date();
  today.setHours(12,0,0,0);
  return Array.from({length:7},(_,index) => {
    const date = new Date(today);
    date.setDate(today.getDate()-6+index);
    return dateKey(date);
  });
}
function historyDateLabel(key,options = {month:'numeric',day:'numeric'}) {
  const [year,month,day] = key.split('-').map(Number);
  return new Date(year,month-1,day,12).toLocaleDateString('en-US',options);
}
function historyNumber(value) {
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
}
function historyPoints(rows,series,dates) {
  const allowedDates = new Set(dates);
  const byDate = new Map(dates.map(date => [date,[]]));
  for (const row of rows) {
    if (!allowedDates.has(row.date)) continue;
    const value = row[series.key];
    if (typeof value === 'number' && Number.isFinite(value)) byDate.get(row.date).push(value);
  }
  return dates.map(date => {
    const values = byDate.get(date);
    if (!values.length) return {date,value:null};
    const value = series.aggregate === 'maximum' ? Math.max(...values)
      : series.aggregate === 'minimum' ? Math.min(...values)
        : series.aggregate === 'sum' ? values.reduce((total,item) => total+item,0)
          : values.reduce((total,item) => total+item,0)/values.length;
    return {date,value};
  });
}
function historySeriesRows(history,series) {
  const rows = history[series.source] ?? [];
  if (!series.fallbackSource) return rows;
  const primaryDates = new Set(rows.filter(row => typeof row[series.key] === 'number' && Number.isFinite(row[series.key])).map(row => row.date));
  return [...rows,...(history[series.fallbackSource] ?? []).filter(row => !primaryDates.has(row.date))];
}
function svgElement(name,attributes = {}) {
  const element = document.createElementNS(svgNamespace,name);
  for (const [attribute,value] of Object.entries(attributes)) element.setAttribute(attribute,String(value));
  return element;
}
function historyChart(category,series,points) {
  const figure = document.createElement('figure'); figure.className = 'history-chart';
  const caption = document.createElement('figcaption'); caption.className = 'history-chart-heading';
  const title = document.createElement('h4'); title.textContent = series.name;
  const unit = document.createElement('span'); unit.textContent = series.unit;
  caption.append(title,unit);
  const available = points.filter(point => point.value !== null);
  const range = document.createElement('p'); range.className = 'history-chart-range';
  range.textContent = `${available.length} of 7 days with readings`;
  const svg = svgElement('svg',{viewBox:'0 0 600 230',role:'img'});
  const titleId = `history-${category.id}-${series.id}-title`;
  const descriptionId = `history-${category.id}-${series.id}-description`;
  svg.setAttribute('aria-labelledby',`${titleId} ${descriptionId}`);
  const svgTitle = svgElement('title',{id:titleId});
  svgTitle.textContent = `${series.name}, 7-day history`;
  const svgDescription = svgElement('desc',{id:descriptionId});
  svgDescription.textContent = available.map(point => `${historyDateLabel(point.date,{month:'long',day:'numeric'})}: ${historyNumber(point.value)} ${series.unit}`).join('. ');
  svg.append(svgTitle,svgDescription);

  const plot = {left:52,right:586,top:18,bottom:178};
  const numbers = available.map(point => point.value);
  const rawMin = Math.min(...numbers), rawMax = Math.max(...numbers);
  const padding = (rawMax-rawMin)*0.12 || Math.max(Math.abs(rawMax)*0.12,1);
  const min = rawMin-padding, max = rawMax+padding;
  for (let index=0;index<=4;index++) {
    const fraction = index/4;
    const y = plot.bottom-fraction*(plot.bottom-plot.top);
    const grid = svgElement('line',{x1:plot.left,x2:plot.right,y1:y,y2:y,class:'history-gridline'});
    const label = svgElement('text',{x:plot.left-8,y:y+4,'text-anchor':'end',class:'history-axis-label'});
    label.textContent = historyNumber(min+fraction*(max-min));
    svg.append(grid,label);
  }
  const coordinates = points.map((point,index) => ({
    ...point,
    x:plot.left+index*(plot.right-plot.left)/(points.length-1),
    y:point.value === null ? null : plot.bottom-(point.value-min)/(max-min)*(plot.bottom-plot.top),
  }));
  const linePoints = coordinates.filter(point => point.value !== null);
  if (linePoints.length > 1) {
    const path = svgElement('path',{
      d:linePoints.map((point,index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' '),
      class:'history-line',
      stroke:historyColors[category.id],
    });
    svg.append(path);
  }
  for (const point of coordinates) {
    const label = svgElement('text',{x:point.x,y:205,'text-anchor':'middle',class:'history-axis-label'});
    label.textContent = historyDateLabel(point.date);
    svg.append(label);
    if (point.value === null) continue;
    const circle = svgElement('circle',{cx:point.x,cy:point.y,r:4.5,class:'history-point',fill:historyColors[category.id]});
    const pointTitle = svgElement('title');
    pointTitle.textContent = `${historyDateLabel(point.date,{month:'long',day:'numeric'})}: ${historyNumber(point.value)} ${series.unit}`;
    circle.append(pointTitle); svg.append(circle);
  }
  figure.append(caption,range,svg);
  return figure;
}
function renderHistoryTrends(history,userId) {
  historyCategoriesList.replaceChildren();
  historyTrends.hidden = false;
  const dates = recentHistoryDates();
  historyPeriod.textContent = `${historyDateLabel(dates[0],{month:'short',day:'numeric'})} – ${historyDateLabel(dates.at(-1),{month:'short',day:'numeric'})}`;
  let categoryCount = 0;
  for (const category of historyCategoryDefinitions) {
    const charts = category.series.map(series => ({
      series,
      points:historyPoints(historySeriesRows(history,series),series,dates),
    })).filter(chart => chart.points.some(point => point.value !== null));
    if (!charts.length) continue;
    const details = document.createElement('details'); details.className = 'history-category';
    details.id = `history-category-${category.id}`;
    details.open = categoryCount === 0;
    const summary = document.createElement('summary'); summary.className = 'history-category-summary';
    const mark = document.createElement('span'); mark.className = 'history-category-mark';
    mark.setAttribute('aria-hidden','true'); mark.textContent = String(categoryCount+1).padStart(2,'0');
    const name = document.createElement('span'); name.className = 'history-category-name'; name.textContent = category.name;
    const count = document.createElement('span'); count.className = 'history-category-count';
    count.textContent = `${charts.length} ${charts.length === 1 ? 'chart' : 'charts'}`;
    const chevron = document.createElement('span'); chevron.className = 'history-category-chevron';
    chevron.setAttribute('aria-hidden','true'); chevron.textContent = '⌄';
    summary.append(mark,name,count,chevron);
    const grid = document.createElement('div'); grid.className = 'history-chart-grid';
    for (const chart of charts) grid.append(historyChart(category,chart.series,chart.points));
    details.append(summary,grid); historyCategoriesList.append(details);
    categoryCount++;
  }
  if (categoryCount) return;
  const empty = document.createElement('div'); empty.className = 'history-empty';
  const title = document.createElement('h3');
  const description = document.createElement('p');
  if (!userId) {
    title.textContent = 'Sign in to view your history';
    description.textContent = 'Your saved check-ins, daily records, and sensor trends will appear here.';
  } else if (!history.recordsLoaded && !history.sensorsLoaded && !history.checkinsLoaded) {
    title.textContent = 'History could not be loaded';
    description.textContent = 'The report could not retrieve daily records, check-ins, or sensor readings. Check the connection and try again.';
  } else if (!history.recordsLoaded || !history.sensorsLoaded || !history.checkinsLoaded) {
    title.textContent = 'Some history sources are unavailable';
    description.textContent = 'Available seven-day charts appear by category when readings can be loaded.';
  } else {
    title.textContent = 'No history to chart yet';
    description.textContent = 'Check-ins, daily records, and sensor readings from the last seven days will appear here when available.';
  }
  empty.append(title,description); historyCategoriesList.append(empty);
}
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
const attentionSection = document.querySelector('#attentionAreas');
const attentionCount = document.querySelector('#attentionCount');
const attentionList = document.querySelector('#affectedOrgans');
function renderAttentionAreas(organs,dates,classified,totalMetrics) {
  attentionList.replaceChildren();
  attentionSection.hidden = false;
  const priority = {red:0,yellow:1};
  const ranked = [...organs].sort((a,b) => {
    const stateOrder = priority[a.state]-priority[b.state];
    if (stateOrder) return stateOrder;
    const redDifference = b.items.filter(item => item.state === 'red').length-a.items.filter(item => item.state === 'red').length;
    return redDifference || b.items.length-a.items.length;
  });
  attentionCount.textContent = ranked.length
    ? `${ranked.length} ${ranked.length === 1 ? 'area' : 'areas'} flagged`
    : classified === totalMetrics ? 'No active alerts' : 'Partial assessment';

  if (!ranked.length) {
    const empty = document.createElement('div'); empty.className = 'attention-empty';
    empty.dataset.state = classified === totalMetrics ? 'green' : 'unknown';
    const icon = document.createElement('span'); icon.className = 'attention-empty-icon';
    icon.setAttribute('aria-hidden','true'); icon.textContent = classified === totalMetrics ? '✓' : '…';
    const content = document.createElement('div');
    const title = document.createElement('h3');
    const description = document.createElement('p');
    if (!classified) {
      title.textContent = 'Not enough data to rank areas';
      description.textContent = 'No classifiable measurements are available yet.';
    } else if (classified < totalMetrics) {
      title.textContent = 'No alerts in the available readings';
      description.textContent = 'This is a partial assessment; some indicators still need readings.';
    } else {
      title.textContent = 'No areas currently need attention';
      description.textContent = 'All assessed indicators are within their green ranges.';
    }
    content.append(title,description); empty.append(icon,content); attentionList.append(empty);
    return;
  }

  for (const [index,organ] of ranked.entries()) {
    const card = document.createElement('article'); card.className = 'attention-card';
    card.dataset.state = organ.state; card.dataset.organ = organ.id;
    const header = document.createElement('div'); header.className = 'attention-card-header';
    const rank = document.createElement('span'); rank.className = 'attention-rank';
    rank.textContent = `Priority ${index+1}`;
    const badge = document.createElement('span'); badge.className = 'attention-status';
    badge.textContent = organ.state === 'red' ? 'Red alert' : 'Caution';
    header.append(rank,badge);
    const title = document.createElement('h3'); title.textContent = organ.name;
    const count = document.createElement('p'); count.className = 'attention-metric-count';
    count.textContent = `${organ.items.length} flagged ${organ.items.length === 1 ? 'indicator' : 'indicators'}`;
    const readings = document.createElement('ul'); readings.className = 'attention-readings';
    const items = [...organ.items].sort((a,b) => priority[a.state]-priority[b.state]);
    for (const {metric,value,state} of items) {
      const item = document.createElement('li'); item.dataset.state = state;
      const name = document.createElement('strong'); name.textContent = metric.name;
      const reading = document.createElement('span'); reading.className = 'attention-reading-value';
      const formatted = metricValue(metric,value);
      reading.textContent = `${formatted} · ${statusNames[state] ?? state}${dates[metric.id] ? ` · ${dates[metric.id]}` : ''}`;
      item.append(name,reading); readings.append(item);
    }
    card.append(header,title,count,readings); attentionList.append(card);
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

  const checkins = detailSection('Check-in history');
  if (!history.checkinsLoaded) {
    const note = document.createElement('p'); note.className = 'report-detail-note';
    note.textContent = 'Could not load check-in history.';
    checkins.append(note);
  } else {
    const visualResults = {green:'No visual distortion',yellow:'Wavy lines / eye strain',red:'Blurred spot / severe distortion'};
    renderTable(checkins,'All saved check-ins',[
      'Date','Reaction time (ms)','NASA-TLX (/100)','Amsler result','Perfusion (s)',
      'Medication on time (%)','Double dose','Standing HR rise (bpm)','WHO-5 (/100)',
    ],history.checkins.map(row => [
      row.date,row.values.pvt,row.values.tlx,visualResults[row.values.amsler] ?? row.values.amsler,
      row.values.perfusion,row.values.medication?.takenPercent,row.values.medication?.doubleDose,
      row.values.orthostatic?.hrRise,row.values.who5,
    ]),'No check-ins have been saved yet.');
  }
  measurementHistory.append(checkins);
}
const crewPage = document.querySelector('[data-crew-report]');
const crewSelect = document.querySelector('#crewMember');
let version = 0;
crewSelect?.addEventListener('change',render);
async function render() {
  const request = ++version;
  anatomyView.update({},{}); message.textContent = 'Loading data\u2026';
  allMeasurements.replaceChildren(); measurementHistory.replaceChildren(); historyCategoriesList.replaceChildren(); historyTrends.hidden = true;
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
  if (manual) {
    const manualDate = manual.recordedDate
      ? new Date(`${manual.recordedDate}T12:00:00`).toLocaleDateString('en-US')
      : new Date(manual.savedAt).toLocaleDateString('en-US');
    for (const id of Object.keys(manual.values)) dates[id] = manualDate;
  }
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
  renderHistoryTrends(database.history,userId);
  // Show the same completed data set as the details panel; simulated values remain excluded from alerts.
  anatomyView.update(values,dates,simulatedMetrics,partiallySimulatedMetrics);
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
  renderAttentionAreas(organs,dates,classified,applicable.length);
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
