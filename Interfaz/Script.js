
// Shared elements used to open, close, and label the navigation drawer.
const app = document.querySelector('#app');
const menuToggle = document.querySelector('#menuToggle');
const sidebar = document.querySelector('#sidebar');
const sidebarClose = document.querySelector('#sidebarClose');
const overlay = document.querySelector('#overlay');

const PLANET_GRAVITY = { tierra: 1, luna: 0.165, marte: 0.38 };

function getMissionState({ missionStartDate, travelDays = 0, stayDays = 0, destination = null, planetNames = {}, today = new Date() } = {}) {
  const start = missionStartDate ? new Date(missionStartDate) : null;
  const current = new Date(today);
  const travel = Number(travelDays) || 0;
  const stay = Number(stayDays) || 0;

  if (!start || Number.isNaN(start.getTime())) {
    return { phase: 'Sin fecha de misión', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const elapsedDays = (current.getTime() - start.getTime()) / 86400000;
  if (elapsedDays < 0) {
    return { phase: 'Preparación previa al lanzamiento', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const totalDays = travel + stay;
  if (totalDays <= 0) {
    return { phase: 'En el espacio', gravity: 0, isOrbit: false, body: 'espacio' };
  }

  if (elapsedDays <= travel) {
    return { phase: destination ? `En tránsito hacia ${planetNames[destination] ?? destination}` : 'En el espacio', gravity: 0, isOrbit: false, body: 'espacio' };
  }

  if (elapsedDays <= travel + stay) {
    const body = destination && Object.prototype.hasOwnProperty.call(PLANET_GRAVITY, destination) ? destination : 'tierra';
    const gravity = PLANET_GRAVITY[body] * 0.01;
    return { phase: destination ? `En órbita de ${planetNames[destination] ?? destination}` : 'En órbita de un cuerpo celeste', gravity, isOrbit: true, body };
  }

  return { phase: 'Misión completada / fuera de órbita', gravity: 0, isOrbit: false, body: 'espacio' };
}

function setMenu(open) {
  app.classList.toggle('menu-open', open);

  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute(
    'aria-label',
    open ? 'Cerrar menú' : 'Abrir menú'
  );

  sidebar.setAttribute('aria-hidden', String(!open));
  sidebar.inert = !open;
  if (open) sidebarClose.focus();

  if (!open && sidebar.contains(document.activeElement)) {
    menuToggle.focus();
  }
}

// Mark the current link and expose it to assistive technology.
const currentPage = (window.location.pathname.split('/').pop() || 'Index.html').toLowerCase();
sidebar.querySelectorAll('a').forEach(link => {
  const active = link.getAttribute('href')?.toLowerCase() === currentPage;
  link.classList.toggle('is-active', active);
  if (active) link.setAttribute('aria-current', 'page');
  else link.removeAttribute('aria-current');
});
// Trap keyboard focus in the drawer while it is open.
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || !app.classList.contains('menu-open')) return;
  const controls = [menuToggle, ...sidebar.querySelectorAll('button:not([disabled]), a[href]')]
    .filter(el => !el.hidden && el.getClientRects().length);
  const index = controls.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && (index === controls.length - 1 || index === -1)) {
    event.preventDefault(); controls[0].focus();
  }
});
// Wire up mouse, touch, and Escape-key actions for the drawer.
menuToggle.addEventListener('click', () => {
  setMenu(!app.classList.contains('menu-open'));
});

sidebarClose.addEventListener('click', () => {
  setMenu(false);
});

overlay.addEventListener('click', () => {
  setMenu(false);
});

// Cerrar con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    setMenu(false);
  }
});

// Cerrar menú al seleccionar un enlace
sidebar.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    setMenu(false);
  });
});
// ===== Misiones (solo existe en mision.html) =====
(() => {
  // Skip mission setup on pages without the planet selector.
  const space = document.querySelector('#planets');
  if (!space) return;

  const PLANETS = window.missionSolarSystem?.names ?? { tierra: 'Tierra', luna: 'Luna', marte: 'Marte' };
  const DIST = { // km promedio aproximados
    'tierra-luna': 384400,
    'tierra-marte': 225e6,
    'luna-marte': 225e6,
  };

  const hint = document.querySelector('#missionsHint');
  const chip = document.querySelector('#missionsChip');
  const nameA = document.querySelector('#slotAName');
  const nameB = document.querySelector('#slotBName');
  const form = document.querySelector('#missionForm');
  const travelInput = document.querySelector('#travelDays');
  const stayInput = document.querySelector('#stayDays');
  const stayPlace = document.querySelector('#stayPlace');
  const route = document.querySelector('#route');
  const resetBtn = document.querySelector('#missionsReset');
  const buttons = space.querySelectorAll('.planet');

  // Keep the selected departure (A) and destination (B) between renders.
  let a = null, b = null, savedName = '', preset = '', routeDistance = null;
  let missionLocked = false, savedStart = '';
  const startInput = document.querySelector('#missionStartDate');
  const storageKey = 'farmacias-similunares.mission-plan';
  const nameInput = document.querySelector('#missionName');
  const saveName = document.querySelector('#saveMissionName');
  const presetInput = document.querySelector('#missionPreset');
  const presetInfo = document.querySelector('#missionPresetInfo');
  const presets = {
    artemis: { name: 'Artemis I', travel: 5, stay: 6, info: 'Simulación simplificada: 5 días hasta el primer sobrevuelo y 6 días en órbita lunar distante; sin alunizaje. No incluye las demás maniobras ni el regreso.', url: 'https://www.nasa.gov/reference/artemis-i-mission-timeline/' },
    apollo: { name: 'Apollo 11', travel: 4.28, stay: 0.9, info: 'Simulación simplificada: 4.28 días hasta el alunizaje y 0.9 días (21 h 36 min) en la superficie. No incluye el regreso.', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm' }
  };
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({locked:missionLocked,start:savedStart || startInput.value,a,b,name:savedName,draft:nameInput.value,preset,distance:routeDistance,travel:travelInput.value,stay:stayInput.value})); }
    catch { document.querySelector('#missionSaveHint').textContent = 'El navegador no permite guardar; los datos solo se conservarán mientras esta página est? abierta.'; }
  }
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (data && (!data.a || Object.hasOwn(PLANETS,data.a)) && (!data.b || (data.a && data.b !== data.a && Object.hasOwn(PLANETS,data.b)))) {
      a = data.a; b = data.b;
      missionLocked = data.locked === true; savedStart = typeof data.start === 'string' ? data.start : '';
      if (missionLocked && savedStart) startInput.value = savedStart;
      startInput.dataset.missionLocked = String(missionLocked);
      startInput.readOnly = missionLocked;
      savedName = typeof data.name === 'string' ? data.name.slice(0,80) : '';
      nameInput.value = savedName || (typeof data.draft === 'string' ? data.draft.slice(0,80) : '');
      preset = Object.hasOwn(presets,data.preset) ? data.preset : '';
      routeDistance = Number.isFinite(data.distance) && data.distance > 0 ? data.distance : null;
      travelInput.value = data.travel ?? ''; stayInput.value = data.stay ?? '';
    }
  } catch {}

  const distance = (x, y) => window.missionSolarSystem?.distance(x, y) ?? DIST[`${x}-${y}`] ?? DIST[`${y}-${x}`];
  const fmt = n => n.toLocaleString('es-MX', { maximumFractionDigits: 2 });

  // Show the summary after both locations and day counts are available.
  function renderSummary() {
    if (!a || !b) { route.hidden = true; return; }

    const travel = parseFloat(travelInput.value);
    const stay = parseFloat(stayInput.value);
    const valid = !isNaN(travel) && travel >= 0 && !isNaN(stay) && stay >= 0;

    route.hidden = false;
    if (!valid) {
      chip.textContent = 'Paso 3 de 3';
      route.innerHTML = '<p>Escribe los días de viaje y los días de estancia para ver el resumen.</p>';
      return;
    }

    const total = travel + stay;
    const missionStartValue = document.querySelector('#missionStartDate')?.value || new Date().toISOString().slice(0,10);
    const missionState = getMissionState({
      missionStartDate: missionStartValue,
      travelDays: travel,
      stayDays: stay,
      destination: b,
      planetNames: PLANETS,
      today: new Date(),
    });

    route.innerHTML = `
      <h3>${PLANETS[a]} (A) ➔ ${PLANETS[b]} (B)</h3>
      <p><strong>Distancia:</strong> ${fmt(routeDistance ?? distance(a, b))} km (aprox.)</p>
      <p><strong>Llegada a ${PLANETS[b]}:</strong> día ${fmt(travel)}</p>
      <p><strong>Estancia en ${PLANETS[b]}:</strong> ${fmt(stay)} días</p>
      <p><strong>Salida de ${PLANETS[b]}:</strong> día ${fmt(total)}</p>
      <p><strong>Duración total:</strong> ${fmt(total)} días (${fmt(total * 24)} horas)</p>
      <p><strong>Estado actual:</strong> ${missionState.phase} · ${missionState.isOrbit ? `${missionState.gravity.toFixed(2)} G (microgravedad)` : `${missionState.gravity.toFixed(2)} G`}</p>`;
  }

  // Update planet highlights, progress text, fields, and summary together.
  function render() {
    buttons.forEach(btn => {
      btn.classList.toggle('is-a', btn.dataset.planet === a);
      btn.classList.toggle('is-b', btn.dataset.planet === b);
      btn.setAttribute('aria-pressed', String(btn.dataset.planet === a || btn.dataset.planet === b));
    });

    nameA.textContent = a ? PLANETS[a] : '—';
    nameB.textContent = b ? PLANETS[b] : '—';
    resetBtn.hidden = !a && !nameInput.value;
    nameInput.readOnly = Boolean(savedName);
    saveName.disabled = missionLocked;
    travelInput.readOnly = stayInput.readOnly = missionLocked;
    startInput.readOnly = missionLocked;
    startInput.dataset.missionLocked = String(missionLocked);
    presetInput.value = preset;
    presetInput.disabled = Boolean(a || savedName);
    presetInfo.hidden = !preset;
    presetInfo.replaceChildren();
    if (preset) {
      const link = document.createElement('a'); link.href = presets[preset].url; link.textContent = 'Fuente: NASA';
      presetInfo.append(presets[preset].info + ' Distancia media Tierra-Luna: 384,400 km; no representa la trayectoria total. ',link);
    }
    buttons.forEach(btn => { btn.disabled = Boolean(b); });
    form.hidden = !(a && b);

    if (!a) {
      hint.textContent = 'Toca tu punto de partida (A).';
      chip.textContent = 'Paso 1 de 3';
    } else if (!b) {
      hint.textContent = `Partida: ${PLANETS[a]}. Ahora toca tu destino (B).`;
      chip.textContent = 'Paso 2 de 3';
    } else {
      hint.textContent = 'Ahora escribe los días de tu misión.';
      stayPlace.textContent = PLANETS[b];
    }
    renderSummary();
  }

  // Keep the completed route locked until Reset.
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const p = btn.dataset.planet;
    if (b) return;
    if (!a) a = p;
    else if (p !== a) { b = p; routeDistance = distance(a,b); }
    persist();
    render();
  }));

  // Keep the summary current as travel and stay durations change.
  [travelInput,stayInput].forEach(input => input.addEventListener('input', () => { persist(); renderSummary(); }));
  nameInput.addEventListener('input', () => { persist(); resetBtn.hidden = !a && !nameInput.value; });
  saveName.addEventListener('click', () => {
    if (missionLocked) return;
    const value = nameInput.value.trim();
    if (!value) { nameInput.setCustomValidity('Escribe el nombre.'); nameInput.reportValidity(); nameInput.setCustomValidity(''); return; }
    if (!a || !b) { hint.textContent = 'Selecciona partida y destino antes de guardar.'; return; }
    for (const input of [travelInput, stayInput, startInput]) {
      if (!input.value || !input.checkValidity()) { input.setCustomValidity('Completa este dato con un valor valido.'); input.reportValidity(); input.setCustomValidity(''); return; }
    }
    routeDistance ??= distance(a,b);
    savedName = value; nameInput.value = value;
    savedStart = startInput.value; missionLocked = true;
    try { localStorage.setItem('farmacias-similunares.mission-start', savedStart); } catch {}
    document.querySelector('#saveMissionStart').click();
    persist(); render();
    document.querySelector('#missionSaveHint').textContent = 'Datos guardados: nombre, ruta, distancia, tiempos y fecha. Pulsa Reiniciar para editar.';
  });
  presetInput.addEventListener('change', () => {
    if (a || savedName || !Object.hasOwn(presets,presetInput.value)) return;
    preset = presetInput.value;
    const data = presets[preset]; a = 'tierra'; b = 'luna'; routeDistance = 384400;
    savedName = data.name; nameInput.value = savedName;
    travelInput.value = data.travel; stayInput.value = data.stay;
    persist(); render();
  });

  // Clear the route and day counts to begin another mission.
  resetBtn.addEventListener('click', () => {
    a = b = null;
    missionLocked = false; savedStart = '';
    savedName = preset = ''; routeDistance = null; nameInput.value = '';
    document.querySelector('#missionSaveHint').textContent = 'Completa los datos y pulsa Guardar.';
    try { localStorage.removeItem(storageKey); } catch {}
    travelInput.value = '';
    stayInput.value = '';
    render();
  });

  render();
})();
