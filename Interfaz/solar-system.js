// JPL Table 1, J2000 elements and rates per Julian century (1800–2050).
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
(() => {
  const space = document.querySelector('#planets');
  if (!space) return;
  const rows = [
    ['tierra','Tierra','#66b9ed',[1.00000261,.01671123,-.00001531,100.46457166,102.93768193,0],[.00000562,-.00004392,-.01294668,35999.37244981,.32327364,0]],
    ['marte','Marte','#e57f57',[1.52371034,.0933941,1.84969142,-4.55343205,-23.94362959,49.55953891],[.00001847,.00007882,-.00813131,19140.30268499,.44441088,-.29257343]],
  ];
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180;
  const date = new Date();
  const T = (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  function position(p, mean, scale = p.a) {
    const M = mean % TAU;
    let E = M;
    for (let k = 0; k < 12; k++) {
      const delta = (E - p.e * Math.sin(E) - M) / (1 - p.e * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-10) break;
    }
    const x = scale * (Math.cos(E) - p.e), y = scale * Math.sqrt(1 - p.e ** 2) * Math.sin(E);
    const w = p.peri - p.node, cw = Math.cos(w), sw = Math.sin(w);
    const cn = Math.cos(p.node), sn = Math.sin(p.node), ci = Math.cos(p.i);
    return [(cw*cn-sw*sn*ci)*x+(-sw*cn-cw*sn*ci)*y,
      (cw*sn+sw*cn*ci)*x+(-sw*sn+cw*cn*ci)*y,
      sw*Math.sin(p.i)*x+cw*Math.sin(p.i)*y];
  }
  space.replaceChildren();
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio','none');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('solar-orbits'); space.append(svg);
  const moonOrbit = document.createElementNS(svg.namespaceURI,'circle');
  moonOrbit.classList.add('moon-orbit');
  moonOrbit.setAttribute('r','30');
  svg.append(moonOrbit);
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
  const planets = rows.map(([id,name,color,base,rates]) => {
    const [a,e,i,L,peri,node] = base.map((v,k) => v + rates[k]*T);
    const p = {id,name,a,e,i:rad(i),peri:rad(peri),node:rad(node),mean:rad(L-peri),radius:a*150};
    const path = document.createElementNS(svg.namespaceURI,'path');
    path.setAttribute('d',Array.from({length:181},(_,k) => {
      const [x,y] = position(p,k/180*TAU,p.radius);
      return `${k ? 'L' : 'M'}${500+x},${500-y}`;
    }).join(' ')+'Z'); svg.append(path);
    return {...p,button:button(id,name,color),initialPosition:position(p,p.mean)};
  });
  const moon = button('luna','Luna','#cfced3');
  const moonOrbitRadius = 30;
  window.reportSolarSystem = {
    names:Object.fromEntries([...planets.map(p => [p.id,p.name]),['luna','Luna']]),
    distance(a,b) {
      if ([a,b].includes('luna') && [a,b].includes('tierra')) return 384400;
      const get = id => planets.find(p => p.id === (id === 'luna' ? 'tierra' : id)).initialPosition;
      const x = get(a), y = get(b);
      return Math.hypot(...x.map((v,k) => v-y[k]))*149597870.7;
    },
  };
  const controls = document.createElement('div'); controls.className = 'orbit-controls';
  const stamp = document.createElement('p');
  stamp.textContent = `Posiciones iniciales aproximadas: ${date.toLocaleDateString('es-MX')}`;
  const pause = document.createElement('button'); pause.type = 'button';
  controls.append(stamp,pause);
  const note = document.createElement('p'); note.className = 'orbit-note';
  note.innerHTML = '¼ de órbita cada 60 segundos · Vuelta completa en 4 minutos. Vista superior con distancias y tamaños comprimidos; movimiento ilustrativo. Luna esquemática alrededor de la Tierra. Fuente: <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener noreferrer">NASA/JPL</a>.';
  space.after(controls,note);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches, elapsed = 0, last = null, frame;
  function draw() {
    const phase = elapsed/240000*TAU;
    for (const p of planets) {
      const [x,y] = position(p,p.mean+phase,p.radius);
      p.button.style.left = `${50+x/10}%`; p.button.style.top = `${50-y/10}%`;
    }
    const earth = planets.find(p => p.id === 'tierra');
    const [x,y] = position(earth,earth.mean+phase,earth.radius);
    moonOrbit.setAttribute('cx',String(500+x));
    moonOrbit.setAttribute('cy',String(500-y));
    moon.style.left = `${50+(x+moonOrbitRadius*Math.cos(phase))/10}%`;
    moon.style.top = `${50-(y+moonOrbitRadius*Math.sin(phase))/10}%`;
  }
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
  pause.addEventListener('click',() => { paused = !paused; sync(); });
  motion.addEventListener('change',event => { paused = event.matches; sync(); });
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',() => { cancelAnimationFrame(frame); last = null; });
  window.addEventListener('pageshow',sync);
  draw(); sync();
})();
