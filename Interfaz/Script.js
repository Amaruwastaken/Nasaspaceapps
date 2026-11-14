
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
