
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
    return { phase: 'No mission start date', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const elapsedDays = (current.getTime() - start.getTime()) / 86400000;
  if (elapsedDays < 0) {
    return { phase: 'Pre-launch preparation', gravity: 1, isOrbit: false, body: 'tierra' };
  }

  const totalDays = travel + stay;
  if (totalDays <= 0) {
    return { phase: 'En el espacio', gravity: 0, isOrbit: false, body: 'espacio' };
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

// Close with Escape.
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    setMenu(false);
  }
});

// Close the menu after selecting a link.
sidebar.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    setMenu(false);
  });
});
// ===== Mission planner (only available on mision.html) =====
(() => {
  // Skip mission setup on pages without the planet selector.
  const space = document.querySelector('#planets');
  if (!space) return;

  const PLANETS = window.missionSolarSystem?.names ?? { tierra: 'Earth', luna: 'Moon', marte: 'Mars' };
  const DIST = { // Approximate average distances in km.
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
  const missionCrew = document.querySelector('#missionCrew');
  const missionCrewMembers = document.querySelector('#missionCrewMembers');
  const crews = {
    artemis: [
      ['Gregory Reid Wiseman', 'Commander', 'reid.wiseman@example.com'],
      ['Christina Hammock Koch', 'Engineer / Mission Specialist', 'christina.koch@example.com'],
      ['Victor Jerome Glover Jr.', 'Pilot', 'victor.glover@example.com'],
      ['Michael Reed Barratt', 'Doctor (alternate)', 'michael.barratt@example.com'],
      ['Jeremy Roger Hansen', 'Scientist / Mission Specialist', 'jeremy.hansen@example.com'],
    ],
    apollo: [
      ['Neil Alden Armstrong', 'Commander', 'neil.armstrong@example.com'],
      ['Edwin Eugene Aldrin Jr. (Buzz Aldrin)', 'Engineer', 'buzz.aldrin@example.com'],
      ['Michael Collins', 'Pilot', 'michael.collins@example.com'],
      ['Joseph Peter Kerwin', 'Doctor (alternate)', 'joseph.kerwin@example.com'],
      ['Harrison Hagan Schmitt', 'Scientist (alternate)', 'harrison.schmitt@example.com'],
    ],
  };
  const presets = {
    artemis: { name: 'Artemis II', travel: 10, stay: 0, info: 'Simplified simulation: Artemis II was an approximately 10-day crewed lunar flyby and return, with no lunar landing. This planner treats the full round trip as transit and does not model the flyby separately.', url: 'https://www.nasa.gov/mission/artemis-ii/' },
    apollo: { name: 'Apollo 11', travel: 4.28, stay: 0.9, info: 'Simplified simulation: 4.28 days to the lunar landing and 0.9 days (21 h 36 min) on the surface. The return trip is not included.', url: 'https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm' }
  };
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({locked:missionLocked,start:savedStart || startInput.value,a,b,name:savedName,draft:nameInput.value,preset,distance:routeDistance,travel:travelInput.value,stay:stayInput.value})); }
    catch { document.querySelector('#missionSaveHint').textContent = 'Your browser does not allow saving; data will only be kept while this page is open.'; }
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
      const legacyArtemis = data.preset === 'artemis' && savedName === 'Artemis I';
      if (legacyArtemis) savedName = 'Artemis II';
      nameInput.value = savedName || (typeof data.draft === 'string' ? data.draft.slice(0,80) : '');
      preset = Object.hasOwn(presets,data.preset) ? data.preset : '';
      routeDistance = Number.isFinite(data.distance) && data.distance > 0 ? data.distance : null;
      travelInput.value = legacyArtemis ? presets.artemis.travel : data.travel ?? '';
      stayInput.value = legacyArtemis ? presets.artemis.stay : data.stay ?? '';
    }
  } catch {}

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
      route.innerHTML = '<p>Enter the travel and stay durations to see the summary.</p>';
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
      <p><strong>Distance:</strong> ${fmt(routeDistance ?? distance(a, b))} km (approx.)</p>
      <p><strong>Arrival at ${PLANETS[b]}:</strong> day ${fmt(travel)}</p>
      <p><strong>Stay at ${PLANETS[b]}:</strong> ${fmt(stay)} days</p>
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
      const link = document.createElement('a'); link.href = presets[preset].url; link.textContent = 'Source: NASA';
      presetInfo.append(presets[preset].info + ' Average Earth-Moon distance: 384,400 km; this does not represent the full route. ',link);
    }
    const crew = crews[preset] || [];
    missionCrew.hidden = crew.length === 0;
    missionCrewMembers.replaceChildren(...crew.map(([name, role, email]) => {
      const row = document.createElement('tr');
      for (const value of [name, role, email]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      return row;
    }));
    buttons.forEach(btn => { btn.disabled = Boolean(b); });
    form.hidden = !(a && b);

    if (!a) {
      hint.textContent = 'Select your departure point (A).';
      chip.textContent = 'Step 1 of 3';
    } else if (!b) {
      hint.textContent = `Departure: ${PLANETS[a]}. Now select your destination (B).`;
      chip.textContent = 'Step 2 of 3';
    } else {
      hint.textContent = 'Now enter your mission duration.';
      chip.textContent = 'Step 3 of 3';
      stayPlace.textContent = PLANETS[b];
    }
    renderSummary();
  }

  window.missionPlan = {
    read() {
      return {
        name: nameInput.value.trim(),
        origin: a,
        dest: b,
        preset,
        transitDays: travelInput.value,
        stayDays: stayInput.value,
        startDate: startInput.value,
        locked: missionLocked,
      };
    },
    restore(mission) {
      if (!mission || typeof mission.name !== 'string') {
        throw new Error('Supabase returned an invalid mission.');
      }
      const start = mission.start_at ? new Date(mission.start_at) : null;
      if (!Object.hasOwn(PLANETS,mission.origin)
          || !Object.hasOwn(PLANETS,mission.dest) || mission.origin === mission.dest
          || !Number.isFinite(mission.transit_days) || mission.transit_days < 0
          || !Number.isFinite(mission.stay_days) || mission.stay_days < 0
          || (mission.start_at && !Number.isFinite(start?.getTime()))) {
        throw new Error('Supabase returned an invalid mission.');
      }
      a = mission.origin; b = mission.dest;
      const legacyArtemis = mission.name === 'Artemis I' && mission.transit_days === 5 && mission.stay_days === 6;
      savedName = legacyArtemis ? 'Artemis II' : mission.name.slice(0,80);
      nameInput.value = savedName;
      preset = ['Artemis I', 'Artemis II'].includes(mission.name) ? 'artemis' : savedName === 'Apollo 11' ? 'apollo' : '';
      routeDistance = distance(a,b);
      travelInput.value = String(legacyArtemis ? presets.artemis.travel : mission.transit_days);
      stayInput.value = String(legacyArtemis ? presets.artemis.stay : mission.stay_days);
      savedStart = start ? start.toISOString().slice(0,10) : '';
      startInput.value = savedStart;
      missionLocked = true;
      persist(); render();
    },
    commit() {
      savedName = nameInput.value.trim();
      nameInput.value = savedName;
      savedStart = startInput.value;
      missionLocked = true;
      try { localStorage.setItem('farmacias-similunares.mission-start',savedStart); } catch {}
      persist(); render();
    },
    reset() {
      a = b = null;
      missionLocked = false; savedStart = '';
      savedName = preset = ''; routeDistance = null; nameInput.value = '';
      startInput.value = '';
      travelInput.value = ''; stayInput.value = '';
      startInput.dataset.missionLocked = 'false';
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem('farmacias-similunares.mission-start');
      } catch {}
      render();
    },
  };
  document.dispatchEvent(new Event('missionplanready'));

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
  presetInput.addEventListener('change', () => {
    if (a || savedName || !Object.hasOwn(presets,presetInput.value)) return;
    preset = presetInput.value;
    const data = presets[preset]; a = 'tierra'; b = 'luna'; routeDistance = 384400;
    savedName = data.name; nameInput.value = savedName;
    travelInput.value = data.travel; stayInput.value = data.stay;
    persist(); render();
  });

  render();
})();
