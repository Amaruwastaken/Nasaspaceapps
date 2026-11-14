
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

  if (!open && sidebar.contains(document.activeElement)) {
    menuToggle.focus();
  }
}

// Abrir y cerrar el menú
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
// ===== Misiones (solo existe en reporte.html) =====
(() => {
  const planetsBox = document.querySelector('#planets');
  if (!planetsBox) return;

  const PLANETS = { tierra: 'Tierra', luna: 'Luna', marte: 'Marte', titan: 'Titán' };
  const DIST = { // km promedio aproximados
    'tierra-luna': 384400,
    'tierra-marte': 225e6,
    'tierra-titan': 1275e6,
    'luna-marte': 225e6,
    'luna-titan': 1275e6,
    'marte-titan': 1100e6,
  };
  const SPEED = 58000; // km/h (nave ficticia)

  const hint = document.querySelector('#missionsHint');
  const chip = document.querySelector('#missionsChip');
  const route = document.querySelector('#route');
  const resetBtn = document.querySelector('#missionsReset');
  const buttons = planetsBox.querySelectorAll('.planet');
  let a = null, b = null;

  const distance = (x, y) => DIST[`${x}-${y}`] ?? DIST[`${y}-${x}`];

  function formatTime(h) {
    if (h < 48) return `${Math.round(h)} horas`;
    const d = h / 24;
    return d < 730 ? `${Math.round(d)} días` : `${(d / 365).toFixed(1)} años`;
  }

  function render() {
    buttons.forEach(btn => {
      btn.classList.toggle('is-a', btn.dataset.planet === a);
      btn.classList.toggle('is-b', btn.dataset.planet === b);
    });
    resetBtn.hidden = !a;

    if (!a) {
      hint.textContent = 'Toca tu punto de partida (A).';
      chip.textContent = 'Paso 1 de 2';
      route.hidden = true;
    } else if (!b) {
      hint.textContent = `Partida: ${PLANETS[a]}. Ahora toca tu destino (B).`;
      chip.textContent = 'Paso 2 de 2';
      route.hidden = true;
    } else {
      const km = distance(a, b);
      hint.textContent = '¡Misión lista!';
      chip.textContent = 'Listo';
      route.hidden = false;
      route.innerHTML = `
        <h3>${PLANETS[a]} (A) ➔ ${PLANETS[b]} (B)</h3>
        <p><strong>Distancia:</strong> ${km.toLocaleString('es-MX')} km (aprox.)</p>
        <p><strong>Duración:</strong> ${formatTime(km / SPEED)}</p>`;
    }
  }

  buttons.forEach(btn => btn.addEventListener('click', () => {
    const p = btn.dataset.planet;
    if (!a || b) { a = p; b = null; }   // empezar o reiniciar con nuevo A
    else if (p === a) { a = null; }     // tocar A otra vez lo quita
    else { b = p; }
    render();
  }));

  resetBtn.addEventListener('click', () => { a = b = null; render(); });
  render();
})();