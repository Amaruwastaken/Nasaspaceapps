// JPL mean longitude and rates per Julian century (1800–2050).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
(() => {
  // Build the interactive diagram only on pages that contain its canvas.
  const space = document.querySelector('#planets');
  if (!space) return;

  // Each row contains a planet's label, display color, semi-major axis,
  // mean longitude, longitude rate, and orbital period in Earth days.
  const rows = [
    ['tierra','Tierra','#66b9ed',1.00000261,100.46457166,35999.37244981,365.256],
    ['marte','Marte','#e57f57',1.52371034,-4.55343205,19140.30268499,686.98],
  ];
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180;
  const AU_KM = 149597870.7, ORBIT_SCALE = 290, MOON_ORBIT_RADIUS = 20;
  const date = new Date();
  // Convert the current date to Julian centuries after the J2000 epoch.
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;

  // Return a top-down circular position in the diagram's shared SVG units.
  const position = (p, angle) => [p.radius * Math.cos(angle), p.radius * Math.sin(angle)];
  space.replaceChildren();

  // SVG draws the fixed solar orbits and the lunar orbit, whose center follows Earth.
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 1000 1000');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('solar-orbits'); space.append(svg);
  const moonOrbit = document.createElementNS(svg.namespaceURI,'circle');
  moonOrbit.classList.add('moon-orbit');
  moonOrbit.setAttribute('r',String(MOON_ORBIT_RADIUS));
  svg.append(moonOrbit);

  // Add the Sun and accessible planet buttons over the orbit artwork.
  const sun = document.createElement('div'); sun.className = 'solar-sun';
  sun.setAttribute('role','img');
  sun.setAttribute('aria-label','Sol'); space.append(sun);
  function button(id, name, color) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `planet solar-planet ${id}`;
    el.dataset.planet = id; el.setAttribute('aria-label', name);
    el.style.setProperty('--planet-color',color);
    const label = document.createElement('small'); label.textContent = name; el.append(label);
    space.append(el); return el;
  }

  // Use one shared scale so each planet remains on its matching circular track.
  const planets = rows.map(([id,name,color,a,longitude,longitudeRate,periodDays]) => {
    const p = {id,name,radius:a*ORBIT_SCALE,angle:rad(longitude+longitudeRate*T),periodDays};
    const orbit = document.createElementNS(svg.namespaceURI,'circle');
    orbit.setAttribute('cx','500');
    orbit.setAttribute('cy','500');
    orbit.setAttribute('r',String(p.radius));
    svg.append(orbit);
    return {...p,button:button(id,name,color),initialPosition:position(p,p.angle)};
  });
  const moon = button('luna','Luna','#cfced3');

  // Expose names and approximate route distances to the mission planner.
  window.reportSolarSystem = {
    names:Object.fromEntries([...planets.map(p => [p.id,p.name]),['luna','Luna']]),
    distance(a,b) {
      if ([a,b].includes('luna') && [a,b].includes('tierra')) return 384400;
      const get = id => planets.find(p => p.id === (id === 'luna' ? 'tierra' : id)).initialPosition;
      const x = get(a), y = get(b);
      return Math.hypot(x[0]-y[0],x[1]-y[1])*AU_KM/ORBIT_SCALE;
    },
  };

  // Show the initial date, animation controls, and source/scale disclaimer.
  const controls = document.createElement('div'); controls.className = 'orbit-controls';
  const stamp = document.createElement('p');
  stamp.textContent = `Posiciones iniciales aproximadas: ${date.toLocaleDateString('es-MX')}`;
  const pause = document.createElement('button'); pause.type = 'button';
  controls.append(stamp,pause);
  const note = document.createElement('p'); note.className = 'orbit-note';
  note.innerHTML = 'Órbitas circulares en vista superior, no a escala; la Tierra completa una vuelta en 4 minutos. Movimiento ilustrativo; Luna esquemática alrededor de la Tierra. Fuente: <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener noreferrer">NASA/JPL</a>.';
  space.after(controls,note);

  // Respect reduced-motion preferences and pause animation when the page is hidden.
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches, elapsed = 0, last = null, frame;
  function draw() {
    const earth = planets.find(p => p.id === 'tierra');
    // Scale each planet's speed by its orbital period; one Earth year takes 4 minutes.
    for (const p of planets) {
      const angle = p.angle + elapsed/(240000*p.periodDays/earth.periodDays)*TAU;
      const [x,y] = position(p,angle);
      p.button.style.left = `${50+x/10}%`; p.button.style.top = `${50-y/10}%`;
    }

    // Keep both the lunar track and Moon centered on Earth's current position.
    const earthAngle = earth.angle + elapsed/240000*TAU;
    const [x,y] = position(earth,earthAngle);
    moonOrbit.setAttribute('cx',String(500+x));
    moonOrbit.setAttribute('cy',String(500-y));
    const moonAngle = elapsed/45000*TAU;
    moon.style.left = `${50+(x+MOON_ORBIT_RADIUS*Math.cos(moonAngle))/10}%`;
    moon.style.top = `${50-(y+MOON_ORBIT_RADIUS*Math.sin(moonAngle))/10}%`;
  }

  // Advance the animation using frame timestamps so speed stays consistent.
  function tick(now) {
    if (last !== null) elapsed += now-last;
    last = now; draw(); frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); last = null;
    pause.textContent = paused ? 'Reanudar órbitas' : 'Pausar órbitas';
    pause.setAttribute('aria-pressed',String(paused));
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
  }

  // Keep the control, reduced-motion preference, and page visibility in sync.
  pause.addEventListener('click',() => { paused = !paused; sync(); });
  motion.addEventListener('change',event => { paused = event.matches; sync(); });
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',() => { cancelAnimationFrame(frame); last = null; });
  window.addEventListener('pageshow',sync);
  draw(); sync();
})();
