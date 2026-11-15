import { supabaseReady, getCurrentUser } from './auth.js';

// Form and report controls are optional because this module serves two pages.
const form = document.querySelector('#recordForm');
const refresh = document.querySelector('#refreshRecords');
const test = document.querySelector('#reactionTest');
let attempts = [], falseStarts = 0, state = 'idle', timer, started;
// Write accessible feedback as text instead of interpreting it as HTML.
const setMessage = (id, text, error = false) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-error', error);
  el.setAttribute('role', error ? 'alert' : 'status');
};
function resetTest() {
  clearTimeout(timer);
  attempts = []; falseStarts = 0; state = 'idle';
  if (test) { test.className = 'pvt'; test.textContent = 'Toca para comenzar'; }
}
// Start one reaction-time attempt after a random delay.
function nextAttempt() {
  state = 'waiting';
  test.className = 'pvt waiting'; test.textContent = 'Espera al verde…';
  timer = setTimeout(() => {
    state = 'ready'; test.className = 'pvt ready'; test.textContent = '¡AHORA!';
    started = performance.now();
  }, 2000 + Math.random() * 3000);
}
if (form) {
  // Initialize today's date and keep each range value visible beside its slider.
  const date = new Date();
  document.querySelector('#recordDate').value = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  for (const id of ['mental', 'physical', 'frustration']) {
    document.getElementById(id).addEventListener('input', event => {
      document.getElementById(`${id}Value`).value = event.target.value;
    });
  }
  // Track early clicks and collect three valid reaction-time measurements.
  test.addEventListener('click', () => {
    if (state === 'idle' || state === 'done') { resetTest(); nextAttempt(); return; }
    if (state === 'waiting') {
      clearTimeout(timer); falseStarts++; state = 'idle';
      test.className = 'pvt'; test.textContent = 'Muy pronto. Toca para reiniciar';
      setMessage('reactionMessage', `Salida en falso. Total: ${falseStarts}.`);
      // Keep previous attempts and false-start count for this test.
      state = 'retry'; return;
    }
    if (state === 'retry') { nextAttempt(); return; }
    if (state !== 'ready') return;
    attempts.push(performance.now() - started);
    setMessage('reactionMessage', `Intentos: ${attempts.map(x => `${Math.round(x)} ms`).join(' · ')}. Salidas en falso: ${falseStarts}.`);
    test.className = 'pvt';
    if (attempts.length === 3) { state = 'done'; test.textContent = 'Prueba completa. Toca para repetir'; }
    else { state = 'between'; test.textContent = 'Prepárate para el siguiente intento…'; timer = setTimeout(nextAttempt, 900); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state !== 'done') { resetTest(); setMessage('reactionMessage', 'Prueba pausada. Comienza de nuevo al volver.'); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (state !== 'done') { setMessage('recordMessage', 'Completa los 3 intentos de reacción.', true); return; }
    // Validate the reaction test before calculating and saving a daily record.
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    setMessage('recordMessage', 'Guardando…');
    try {
      const client = await supabaseReady;
      const user = getCurrentUser();
      if (!client || !user) throw new Error('Inicia sesión para guardar.');
      const fields = new FormData(form);
      const record = {
        user_id: user.id, date: fields.get('date'), env: fields.get('env').trim() || null,
        sleep: Number(fields.get('sleep')),
        tlx: ['mental','physical','frustration'].reduce((total,key) => total + Number(fields.get(key)),0) / 3 * 10,
        pvt: attempts.reduce((a,b) => a+b,0)/attempts.length,
        pvt_max: Math.max(...attempts), fs: falseStarts,
      };
      const { error } = await client.from('records').upsert(record, { onConflict:'user_id,date' });
      if (error) throw error;
      window.location.assign('reporte.html');
    } catch (error) { setMessage('recordMessage', error.message || 'No se pudo guardar.', true); }
    finally { button.disabled = !getCurrentUser(); }
  });
}
let request = 0;
// Load the signed-in user's recent records and ignore stale responses.
async function loadRecords() {
  const client = await supabaseReady;
  const user = getCurrentUser();
  const tableBox = document.querySelector('#recordsTable');
  if (!tableBox) return;
  const version = ++request;
  tableBox.replaceChildren();
  if (!client || !user) return;
  refresh.disabled = true;
  setMessage('recordsMessage', 'Cargando registros…');
  try {
    const { data, error } = await client.from('records').select('date,env,sleep,tlx,pvt,pvt_max,fs').eq('user_id', user.id).order('date', { ascending:false }).limit(90);
    if (version !== request || getCurrentUser()?.id !== user.id) return;
    if (error) throw error;
    if (!data?.length) { setMessage('recordsMessage', 'Aún no hay registros. Agrega uno desde Registro.'); return; }
    setMessage('recordsMessage', `${data.length} registro(s). Se muestran los 90 más recientes.`);
    // Build the report with text nodes so database values are not interpreted as markup.
    const table = document.createElement('table'); table.className = 'report-table';
    const caption = table.createCaption(); caption.textContent = 'Historial de registros diarios';
    const row = table.createTHead().insertRow();
    for (const title of ['Fecha','Entorno','Sueño (h)','Carga /100','Reacción (ms)','Máxima (ms)','Salidas en falso']) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; row.append(th);
    }
    const body = table.createTBody();
    for (const record of data) {
      const tr = body.insertRow();
      for (const key of ['date','env','sleep','tlx','pvt','pvt_max','fs']) {
        const value = record[key]; tr.insertCell().textContent = typeof value === 'number' ? String(Math.round(value*10)/10) : value ?? '—';
      }
    }
    tableBox.append(table);
  } catch (error) { if (version === request) setMessage('recordsMessage', error.message || 'No se pudieron cargar los registros.', true); }
  finally { if (version === request) refresh.disabled = false; }
}
function updateSession() {
  if (form) {
    form.querySelector('[type=submit]').disabled = !getCurrentUser();
    if (!getCurrentUser()) resetTest();
  }
  if (refresh) void loadRecords();
}
// Refresh protected controls whenever authentication state changes.
document.addEventListener('sessionchange', updateSession);
refresh?.addEventListener('click', loadRecords);
await supabaseReady;
updateSession();
window.addEventListener('pagehide', () => clearTimeout(timer));
