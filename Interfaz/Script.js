
// Shared elements used to open, close, and label the navigation drawer.
const app = document.querySelector('#app');
const menuToggle = document.querySelector('#menuToggle');
const sidebar = document.querySelector('#sidebar');
const sidebarClose = document.querySelector('#sidebarClose');
const overlay = document.querySelector('#overlay');

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
  let a = null, b = null;

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
    route.innerHTML = `
      <h3>${PLANETS[a]} (A) ➔ ${PLANETS[b]} (B)</h3>
      <p><strong>Distancia:</strong> ${fmt(distance(a, b))} km (aprox.)</p>
      <p><strong>Llegada a ${PLANETS[b]}:</strong> día ${fmt(travel)}</p>
      <p><strong>Estancia en ${PLANETS[b]}:</strong> ${fmt(stay)} días</p>
      <p><strong>Salida de ${PLANETS[b]}:</strong> día ${fmt(total)}</p>
      <p><strong>Duración total:</strong> ${fmt(total)} días (${fmt(total * 24)} horas)</p>`;
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
    resetBtn.hidden = !a;
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

  // First click selects A, second selects B; a later click starts a new route.
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const p = btn.dataset.planet;
    if (!a || b) { a = p; b = null; }   // empezar o reiniciar con nuevo A
    else if (p === a) { a = null; }     // tocar A otra vez lo quita
    else { b = p; }
    render();
  }));

  // Keep the summary current as travel and stay durations change.
  travelInput.addEventListener('input', renderSummary);
  stayInput.addEventListener('input', renderSummary);

  // Clear the route and day counts to begin another mission.
  resetBtn.addEventListener('click', () => {
    a = b = null;
    travelInput.value = '';
    stayInput.value = '';
    render();
  });

  render();
})();
