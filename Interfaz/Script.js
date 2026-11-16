
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
    return { phase: 'No mission date', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const elapsedDays = (current.getTime() - start.getTime()) / 86400000;
  if (elapsedDays < 0) {
    return { phase: 'Pre-launch preparation', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const totalDays = travel + stay;
  if (totalDays <= 0) {
    return { phase: 'In space', gravity: 0, isOrbit: false, body: 'espacio' };
  }

  if (elapsedDays <= travel) {
    return { phase: destination ? `In transit to ${planetNames[destination] ?? destination}` : 'In space', gravity: 0, isOrbit: false, body: 'espacio' };
  }

  if (elapsedDays <= travel + stay) {
    const body = destination && Object.prototype.hasOwnProperty.call(PLANET_GRAVITY, destination) ? destination : 'tierra';
    const gravity = PLANET_GRAVITY[body] * 0.01;
    return { phase: destination ? `Orbiting ${planetNames[destination] ?? destination}` : 'Orbiting a celestial body', gravity, isOrbit: true, body };
  }

  return { phase: 'Mission complete / out of orbit', gravity: 0, isOrbit: false, body: 'espacio' };
}

function setMenu(open) {
  app.classList.toggle('menu-open', open);

  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute(
    'aria-label',
    open ? 'Close menu' : 'Open menu'
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

// Close the menu with Escape.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    setMenu(false);
  }
});

// Close menu al seleccionar un enlace
sidebar.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    setMenu(false);
  });
});
// ===== Mission planner (only on mision.html) =====
(() => {
  // Skip mission setup on pages without the planet selector.
  const space = document.querySelector('#planets');
  if (!space) return;

  const PLANETS = window.missionSolarSystem?.names ?? { tierra: 'Earth', luna: 'Moon', marte: 'Mars' };
  const DIST = { // approximate average distance in km
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
  const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

  // Show the summary after both locations and day counts are available.
  function renderSummary() {
    if (!a || !b) { route.hidden = true; return; }

    const travel = parseFloat(travelInput.value);
    const stay = parseFloat(stayInput.value);
    const valid = !isNaN(travel) && travel >= 0 && !isNaN(stay) && stay >= 0;

    route.hidden = false;
    if (!valid) {
      chip.textContent = 'Step 3 of 3';
      route.innerHTML = '<p>Enter travel and stay durations to see the summary.</p>';
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
      <p><strong>Distance:</strong> ${fmt(distance(a, b))} km (approx.)</p>
      <p><strong>Arrival at ${PLANETS[b]}:</strong> day ${fmt(travel)}</p>
      <p><strong>Stay on ${PLANETS[b]}:</strong> ${fmt(stay)} days</p>
      <p><strong>Departure from ${PLANETS[b]}:</strong> day ${fmt(total)}</p>
      <p><strong>Total duration:</strong> ${fmt(total)} days (${fmt(total * 24)} hours)</p>
      <p><strong>Current status:</strong> ${missionState.phase} · ${missionState.isOrbit ? `${missionState.gravity.toFixed(2)} G (microgravity)` : `${missionState.gravity.toFixed(2)} G`}</p>`;
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
      hint.textContent = 'Select your starting point (A).';
      chip.textContent = 'Step 1 of 3';
    } else if (!b) {
      hint.textContent = `Origin: ${PLANETS[a]}. Now select your destination (B).`;
      chip.textContent = 'Step 2 of 3';
    } else {
      hint.textContent = 'Now enter the number of mission days.';
      stayPlace.textContent = PLANETS[b];
    }
    renderSummary();
  }

  // First click selects A, second selects B; a later click starts a new route.
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const p = btn.dataset.planet;
    if (!a || b) { a = p; b = null; }   // Start or restart with a new origin.
    else if (p === a) { a = null; }     // Select the origin again to clear it.
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
