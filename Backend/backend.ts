import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const supabase = createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_PUBLISHABLE_KEY')
)
const sb = supabase

/* ---------- Tipos ---------- */
type Level = 0 | 1 | 2 | 3;
type Key = 'rad' | 'sleep' | 'tlx' | 'hrv' | 'pvt';

// Pruebas MANUALES (tabla records)
interface DbRecord {
  user_id: string; date: string; env: string | null;
  sleep: number; tlx: number; pvt: number; pvt_max: number; fs: number;
}
interface Rec extends DbRecord { pvtMax: number }
// Resumen diario de los SENSORES (vista daily_sensor)
interface Sensor {
  user_id: string; date: string;
  hr_avg: number | null; hr_max: number | null; temp_avg: number | null; spo2_min: number | null;
  rad_msv: number | null; co2_max: number | null; rmssd: number | null;
}
// Lectura en vivo del traje (tabla telemetry)
interface Telemetry { ts: string; hr: number; rr: number; temp: number; spo2: number; resp: number; rad_rate: number; co2: number }

interface Bundle { R: Rec[]; S: Sensor[] }
interface Item { k: Key; n: string; lv: Level; hp?: number; v: string }
interface Status { r?: Rec; s?: Sensor; tot: number; debt: number; items: Item[] }
interface PvtState { t: number[]; fs: number; on: boolean; ready: boolean; done: boolean; tm: number; st: number }

/* ---------- Utilidades ---------- */
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const num1 = (v: number | null, d = 0, u = ''): string => (v === null ? '—' : v.toFixed(d) + u);

let me: { id: string; name: string } | null = null;
let MISSION = '';
try { MISSION = localStorage.getItem('mision') || ''; } catch { /* sin storage */ }

function go(id: string): void {
  document.querySelectorAll('section').forEach(s => s.classList.remove('on'));
  $(`#${id}`).classList.add('on');
  window.scrollTo(0, 0);
}

/* ---------- 1. Misión ---------- */
$<HTMLInputElement>('#mis').value = MISSION;
$('#patch').textContent = MISSION || 'Misión';
$<HTMLInputElement>('#mis').oninput = e => {
  $('#patch').textContent = (e.target as HTMLInputElement).value || 'Misión';
};
$('#bMis').onclick = () => {
  const v = $<HTMLInputElement>('#mis').value.trim();
  if (!v) { $('#eMis').textContent = 'Escribe el nombre de la misión.'; return; }
  MISSION = v;
  try { localStorage.setItem('mision', v); } catch { /* sin storage */ }
  $('#lMis').textContent = v;
  go('p-login');
};

/* ---------- 2. Login con Supabase Auth ---------- */
const mail = (u: string): string => u.toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@astro.local';

async function auth(create: boolean): Promise<void> {
  const u = $<HTMLInputElement>('#usr').value.trim();
  const p = $<HTMLInputElement>('#pw').value;
  const e = $('#eLog');
  if (!u || p.length < 6) { e.textContent = 'Usuario obligatorio y contraseña de 6+ caracteres.'; return; }
  e.textContent = 'Conectando…';

  let userId: string;
  if (create) {
    const { data, error } = await sb.auth.signUp({ email: mail(u), password: p });
    if (error) { e.textContent = error.message; return; }
    if (!data.session || !data.user) { e.textContent = 'Desactiva «Confirm email» en Supabase → Auth → Providers → Email.'; return; }
    const ins = await sb.from('profiles').insert({ id: data.user.id, username: u, mission: MISSION });
    if (ins.error) { e.textContent = ins.error.message; return; }
    userId = data.user.id;
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email: mail(u), password: p });
    if (error || !data.user) { e.textContent = 'Usuario o contraseña incorrectos.'; return; }
    userId = data.user.id;
  }

  me = { id: userId, name: u };
  const { data: pf } = await sb.from('profiles').select('mission').eq('id', userId).maybeSingle();
  if (pf?.mission) MISSION = pf.mission as string;
  e.textContent = '';
  $<HTMLInputElement>('#pw').value = '';
  $('#dMis').textContent = MISSION;
  $('#dUser').textContent = 'Astronauta: ' + u;
  initReg();
  void startLive();
  go('p-dash');
}
$('#bIn').onclick = () => void auth(false);
$('#bNew').onclick = () => void auth(true);
$('#bOut').onclick = async () => {
  stopLive();
  await sb.auth.signOut();
  me = null;
  $('#lMis').textContent = MISSION;
  go('p-login');
};

/* ---------- Umbrales (según el documento) ---------- */
const L: Record<Key, (x: number) => Level> = {
  rad: t => (t >= 600 ? 3 : t >= 480 ? 2 : t >= 300 ? 1 : 0),
  sleep: h => (h >= 7.5 ? 0 : h >= 6 ? 1 : h >= 4.5 ? 2 : 3),
  tlx: v => (v <= 40 ? 0 : v <= 60 ? 1 : v <= 75 ? 2 : 3),
  hrv: r => (r >= 50 ? 0 : r >= 38 ? 1 : r >= 30 ? 2 : 3),
  pvt: m => (m <= 250 ? 0 : m <= 350 ? 1 : m < 500 ? 2 : 3),
};
const HP = [100, 65, 30, 8];
const COL = ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)'];
const LAB = ['NORMAL', 'PRECAUCIÓN', 'ALERTA', 'CRÍTICO'];
const T: Record<Key, [string, string][]> = {
  rad: [['Operación nominal bajo protocolo ALARA', 'Monitoreo pasivo y registro diario.'], ['Fatiga radiológica moderada', 'Restringir EVAs no esenciales y priorizar módulos blindados.'], ['Cerca del límite de carrera o tormenta solar', 'Alarma: ir al Refugio de Tormenta y cancelar toda EVA.'], ['Límite de la NASA superado (≥ 600 mSv)', 'Bloqueo de vuelos, seguimiento hematológico y aviso a Control de Misión.']],
  sleep: [['Sueño óptimo', 'Agenda al 100 % (EVAs permitidas).'], ['Déficit operativo', 'Luz azul LED en cabina por la mañana.'], ['Privación crónica', 'Bloquear EVAs y tareas de precisión; siesta NASA de 26 min.'], ['Colapso circadiano', 'Descanso obligatorio y reasignar guardias.']],
  tlx: [['Energía alta', 'Mantener carga estándar.'], ['Fatiga acumulada', 'Aislamiento acústico y menos tareas administrativas.'], ['Fenómeno del 3er trimestre', 'Tiempo libre protegido y videomensajes familiares.'], ['Agotamiento crítico', 'Suspender agenda no esencial 24 h; soporte psicológico.']],
  hrv: [['Equilibrio parasimpático', 'Apto para tareas de alta demanda.'], ['Tensión adaptativa', '10 min de respiración resonante (6/min) antes de dormir.'], ['Sobrecarga simpática', 'Reducir ejercicio; hidratación y electrolitos.'], ['Bloqueo autonómico', 'Alerta roja al comandante; rotar fuera de operaciones críticas.']],
  pvt: [['Alerta cognitiva plena', 'Autorizado para pilotaje y acoplamiento.'], ['Ralentización leve', 'Verificación cruzada obligatoria.'], ['Deterioro operativo', 'Bloquear comandos irreversibles; delegar a automatización.'], ['Falla cognitiva / micro-sueño', 'Bloqueo de controles críticos y relevo inmediato.']],
};

/* Radiación, HRV y CO₂ salen de los sensores (S); sueño, TLX y PVT de las pruebas manuales (R) */
function status(R: Rec[], S: Sensor[]): Status {
  const r = R[R.length - 1] as Rec | undefined;
  const p = R[R.length - 2] as Rec | undefined;
  const s = S[S.length - 1] as Sensor | undefined;
  const tot = S.reduce((a, x) => a + (x.rad_msv ?? 0), 0);
  const debt = R.slice(-7).reduce((a, x) => a + 8.5 - x.sleep, 0);
  const items: Item[] = [];

  if (s) items.push({ k: 'rad', n: '☢️ Radiación (traje)', lv: L.rad(tot), hp: Math.max(0, 100 - tot / 6), v: `${tot.toFixed(1)} de 600 mSv acumulados` });
  if (r) {
    let sl = L.sleep(r.sleep);
    if (debt > 12) sl = Math.max(sl, 2) as Level;
    items.push({ k: 'sleep', n: '🛌 Sueño', lv: sl, v: `${r.sleep} h anoche · deuda 7 días: ${debt.toFixed(1)} h` + (debt > 12 ? ' (límite de 12 h superado)' : '') });
    let t = L.tlx(r.tlx);
    if (r.tlx > 75 && !(p && p.tlx > 75)) t = Math.min(t, 2) as Level;
    items.push({ k: 'tlx', n: '🔋 Agotamiento', lv: t, v: `NASA-TLX ${r.tlx.toFixed(0)}/100` + (r.tlx > 75 ? (t === 3 ? ' (2 días seguidos)' : ' (1er día sobre 75)') : '') });
  }
  if (s && s.rmssd !== null) items.push({ k: 'hrv', n: '💓 HRV (traje)', lv: L.hrv(s.rmssd), v: `RMSSD ${s.rmssd.toFixed(1)} ms · ${s.date}` });
  if (r) {
    const cg: Level = r.pvtMax >= 500 ? 3 : L.pvt(r.pvt);
    items.push({ k: 'pvt', n: '🧠 Cognitivo', lv: cg, v: `Reacción ${r.pvt.toFixed(0)} ms · ${r.fs} salida(s) en falso` });
  }
  return { r, s, tot, debt, items };
}

/* ---------- Registro diario (solo lo manual: sueño, TLX, PVT) ---------- */
([['sM', 'vM'], ['sP', 'vP'], ['sF', 'vF']] as const).forEach(([a, b]) => {
  $<HTMLInputElement>(`#${a}`).oninput = e => { $(`#${b}`).textContent = (e.target as HTMLInputElement).value; };
});

let pv: PvtState = { t: [], fs: 0, on: false, ready: false, done: false, tm: 0, st: 0 };

/* Oculta del formulario lo que ahora mide el traje (radiación, CO₂ y RR) */
function hideSensorFields(): void {
  (['#fRad', '#fCo2'] as const).forEach(id => {
    const box = $(id)?.parentElement;
    if (box) box.style.display = 'none';
  });
  const rrCard = $('#fRR')?.closest<HTMLElement>('.card');
  if (rrCard) rrCard.style.display = 'none';
}

function initReg(): void {
  hideSensorFields();
  $<HTMLInputElement>('#fDate').value = new Date().toISOString().slice(0, 10);
  pv = { t: [], fs: 0, on: false, ready: false, done: false, tm: 0, st: 0 };
  $('#pvt').className = 'pvt';
  $('#pvt').textContent = 'Toca para comenzar';
  $('#pvtRes').textContent = '';
  $('#eReg').textContent = '';
}

function pvtNext(): void {
  const b = $('#pvt');
  b.className = 'pvt red';
  b.textContent = 'Espera al verde…';
  pv.on = true;
  pv.ready = false;
  pv.tm = window.setTimeout(() => {
    b.className = 'pvt green';
    b.textContent = '¡AHORA!';
    pv.st = performance.now();
    pv.ready = true;
  }, 2000 + Math.random() * 3000);
}

function pvtClick(): void {
  const b = $('#pvt');
  if (pv.done) { initReg(); return; }
  if (!pv.on && !pv.t.length && !pv.fs) { pvtNext(); return; }
  if (!pv.on) return;
  if (!pv.ready) {
    clearTimeout(pv.tm);
    pv.fs++;
    pv.on = false;
    b.className = 'pvt';
    b.textContent = 'Muy pronto (impulsividad). Repite…';
    setTimeout(pvtNext, 900);
    return;
  }
  const rt = performance.now() - pv.st;
  pv.t.push(rt);
  pv.on = false;
  pv.ready = false;
  $('#pvtRes').textContent = 'Intentos: ' + pv.t.map(x => x.toFixed(0) + ' ms').join(' · ');
  if (pv.t.length < 3) {
    b.className = 'pvt';
    b.textContent = rt.toFixed(0) + ' ms';
    setTimeout(pvtNext, 900);
  } else {
    pv.done = true;
    b.className = 'pvt';
    b.textContent = 'Promedio ' + (pv.t.reduce((a, x) => a + x) / 3).toFixed(0) + ' ms · toca para repetir';
  }
}
$('#pvt').onclick = pvtClick;
$('#pvt').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pvtClick(); } };

$('#bSave').onclick = async () => {
  if (!me) return;
  const e = $('#eReg');
  const sleep = parseFloat($<HTMLInputElement>('#fSleep').value);
  if (!$<HTMLInputElement>('#fDate').value || isNaN(sleep)) { e.textContent = 'Completa la fecha y las horas de sueño.'; return; }
  if (!pv.done) { e.textContent = 'Completa los 3 intentos de la prueba PVT.'; return; }

  const m = +$<HTMLInputElement>('#sM').value;
  const p = +$<HTMLInputElement>('#sP').value;
  const f = +$<HTMLInputElement>('#sF').value;
  const rec: DbRecord = {
    user_id: me.id,
    date: $<HTMLInputElement>('#fDate').value,
    env: $<HTMLSelectElement>('#fEnv').value,
    sleep,
    tlx: ((m + p + f) / 3) * 10,
    pvt: pv.t.reduce((a, x) => a + x) / 3,
    pvt_max: Math.max(...pv.t),
    fs: pv.fs,
  };
  e.textContent = 'Guardando…';
  const { error } = await sb.from('records').upsert(rec, { onConflict: 'user_id,date' });
  if (error) { e.textContent = 'Error: ' + error.message; return; }
  initReg();
  await renderMine();
  go('p-viz');
};

/* ---------- Traje en vivo (Supabase Realtime sobre telemetry) ---------- */
let channel: ReturnType<typeof sb.channel> | null = null;
let liveTimer = 0;
let lastReading: Telemetry | null = null;

function liveBox(): HTMLElement {
  let b = document.getElementById('live');
  if (!b) {
    b = document.createElement('div');
    b.id = 'live';
    b.className = 'card';
    b.style.marginTop = '18px';
    $('#p-dash').appendChild(b);
  }
  return b;
}

function paintLive(t: Telemetry): void {
  lastReading = t;
  const stale = (Date.now() - new Date(t.ts).getTime()) / 1000 > 60;
  const cell = (l: string, v: string): string =>
    `<div><div class="mu">${l}</div><b style="font-size:1.3rem">${v}</b></div>`;
  liveBox().innerHTML = `
    <h3>🛰️ Traje en vivo <span class="badge" style="background:${stale ? COL[1] : COL[0]}">${stale ? 'SIN SEÑAL RECIENTE' : 'EN LÍNEA'}</span></h3>
    ${t.rad_rate > 5 ? `<div class="alert"><b>Tormenta solar: ${t.rad_rate.toFixed(1)} mSv/h.</b> Ir al Refugio de Tormenta y cancelar toda actividad extravehicular.</div>` : ''}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      ${cell('❤️ Pulso', `${t.hr} lpm`)}${cell('🌡️ Temperatura', `${t.temp.toFixed(1)} °C`)}${cell('🫁 SpO₂', `${t.spo2.toFixed(0)} %`)}
      ${cell('💨 Respiración', `${t.resp}/min`)}${cell('☢️ Radiación', `${t.rad_rate.toFixed(3)} mSv/h`)}${cell('🌫️ CO₂', `${t.co2} ppm`)}
    </div>
    <small class="mu">Última lectura: ${new Date(t.ts).toLocaleTimeString()}</small>`;
}

async function startLive(): Promise<void> {
  stopLive();
  if (!me) return;
  const uid = me.id;
  liveBox().innerHTML = '<h3>🛰️ Traje en vivo</h3><p class="mu">Esperando datos del traje…</p>';

  const { data } = await sb.from('telemetry').select('*').eq('user_id', uid).order('ts', { ascending: false }).limit(1);
  if (data && data.length) paintLive(data[0] as Telemetry);

  channel = sb.channel('telemetry-' + uid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'telemetry', filter: `user_id=eq.${uid}` },
      payload => paintLive(payload.new as Telemetry))
    .subscribe();
  liveTimer = window.setInterval(() => { if (lastReading) paintLive(lastReading); }, 5000); // refresca el aviso de «sin señal»
}

function stopLive(): void {
  if (channel) { void sb.removeChannel(channel); channel = null; }
  clearInterval(liveTimer);
  lastReading = null;
}

/* ---------- Visualización ---------- */
function viz(B: Bundle, el: HTMLElement): void {
  if (!B.R.length && !B.S.length) {
    el.innerHTML = '<div class="card mu">Aún no hay datos. Completa el «Registro diario» o inicia el simulador del traje.</div>';
    return;
  }
  const St = status(B.R, B.S);
  const { r, s } = St;
  let h = `<p class="mu">Pruebas: ${r ? `${r.date} · ${esc(r.env ?? '')}` : 'sin registro manual'} · Traje: ${s ? s.date : 'sin datos'}</p>`;

  if (r && s && s.co2_max !== null && r.pvt > 250 && s.co2_max > 3500) {
    h += `<div class="alert"><b>Falla cognitiva por hipercapnia ambiental, no por falta de sueño.</b><br>CO₂ máximo de ${s.co2_max.toFixed(0)} ppm con reacción lenta: purgar los filtros de aire de inmediato.</div>`;
  }
  if (s) {
    h += `<div class="card"><h3>🧥 Resumen del traje (${s.date})</h3><div class="mu">Pulso medio ${num1(s.hr_avg, 0, ' lpm')} (máx. ${num1(s.hr_max, 0)}) · Temp. media ${num1(s.temp_avg, 1, ' °C')} · SpO₂ mín. ${num1(s.spo2_min, 0, ' %')} · CO₂ máx. ${num1(s.co2_max, 0, ' ppm')}</div></div>`;
  }
  h += '<div class="grid">' + St.items.map(i => `<div class="card"><h3>${i.n}<span class="badge" style="background:${COL[i.lv]}">${LAB[i.lv]}</span></h3>
    <div class="bar"><i style="width:${i.hp ?? HP[i.lv]}%;background:${COL[i.lv]}"></i></div><div class="mu">${i.v}</div>
    <p><b>Estado:</b> ${T[i.k][i.lv][0]}<br><b>Acción:</b> ${T[i.k][i.lv][1]}</p></div>`).join('') + '</div>';

  if (B.R.length) {
    const w = B.R.slice(-7);
    h += `<div class="card"><h3>Sueño de los últimos ${w.length} días</h3><div class="mu">Meta: 8.5 h · deuda acumulada: ${St.debt.toFixed(1)} h</div>
     <div class="chart">${w.map(x => `<div style="height:${Math.min(100, x.sleep / 8.5 * 100)}%;background:${COL[L.sleep(x.sleep)]}"><small>${x.sleep}</small></div>`).join('')}</div>
     <div class="chart" style="height:auto;border:0;gap:8px;margin-top:4px">${w.map(x => `<span class="mu" style="flex:1;text-align:center;font-size:.8rem">${x.date.slice(5)}</span>`).join('')}</div></div>`;
  }
  el.innerHTML = h;
}

/* ---------- Lectura de datos ---------- */
const rows = (a: DbRecord[]): Rec[] => a.map(x => ({ ...x, pvtMax: x.pvt_max }));

async function getData(uids: string[]): Promise<Record<string, Bundle>> {
  const [a, b] = await Promise.all([
    sb.from('records').select('*').in('user_id', uids).order('date'),
    sb.from('daily_sensor').select('*').in('user_id', uids).order('date'),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  const out: Record<string, Bundle> = {};
  uids.forEach(u => { out[u] = { R: [], S: [] }; });
  rows((a.data ?? []) as DbRecord[]).forEach(x => out[x.user_id]?.R.push(x));
  ((b.data ?? []) as Sensor[]).forEach(x => out[x.user_id]?.S.push(x));
  return out;
}

async function renderMine(): Promise<void> {
  if (!me) return;
  const b = $('#vizBox');
  b.innerHTML = '<p class="mu">Cargando…</p>';
  try { viz((await getData([me.id]))[me.id], b); }
  catch (e) { b.innerHTML = '<div class="alert">' + esc(errMsg(e)) + '</div>'; }
}

/* ---------- Ver astronautas (misma misión) ---------- */
async function renderCrew(): Promise<void> {
  if (!me) return;
  const t = $('#crewTbl');
  $('#crewDetail').innerHTML = '';
  t.innerHTML = '<tr><td class="mu">Cargando…</td></tr>';

  const { data: pData, error } = await sb.from('profiles').select('id,username')
    .eq('mission', MISSION).neq('id', me.id).order('username');
  if (error) { t.innerHTML = '<tr><td>' + esc(error.message) + '</td></tr>'; return; }
  const P = (pData ?? []) as { id: string; username: string }[];
  if (!P.length) { t.innerHTML = '<tr><td class="mu">Todavía no hay otros astronautas en esta misión.</td></tr>'; return; }

  let by: Record<string, Bundle>;
  try { by = await getData(P.map(p => p.id)); }
  catch (e) { t.innerHTML = '<tr><td>' + esc(errMsg(e)) + '</td></tr>'; return; }

  t.innerHTML = '<tr><th>Astronauta</th><th>Último dato</th><th>Estado</th><th></th></tr>' + P.map(p => {
    const B = by[p.id];
    const items = status(B.R, B.S).items;
    const last = [B.R[B.R.length - 1]?.date, B.S[B.S.length - 1]?.date].filter(Boolean).sort().pop();
    const dots = items.length
      ? items.map(i => `<span class="dot" title="${i.n}: ${LAB[i.lv]}" style="background:${COL[i.lv]}"></span>`).join('')
      : '<span class="mu">Sin datos</span>';
    return `<tr><td>${esc(p.username)}</td><td>${last ?? '—'}</td><td>${dots}</td>
      <td><button class="ghost" data-id="${p.id}" data-u="${esc(p.username)}">Ver datos</button></td></tr>`;
  }).join('');

  t.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
    b.onclick = () => {
      const d = $('#crewDetail');
      d.innerHTML = `<h2>${b.dataset.u}</h2><div id="cd"></div>`;
      viz(by[b.dataset.id as string], $('#cd'));
      d.scrollIntoView({ behavior: 'smooth' });
    };
  });
}

/* Los botones del HTML usan onclick="go(...)": en un módulo hay que exponerlos */
Object.assign(window, { go, renderMine, renderCrew });
