const app = document.querySelector('#app');
const menuToggle = document.querySelector('#menuToggle');
const sidebar = document.querySelector('#sidebar');
const sidebarClose = document.querySelector('#sidebarClose');
const overlay = document.querySelector('#overlay');
const tipTitle = document.querySelector('#tipTitle');
const tipText = document.querySelector('#tipText');

function setMenu(open) {
  app.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  sidebar.setAttribute('aria-hidden', String(!open));
  sidebar.inert = !open;
  if (!open && sidebar.contains(document.activeElement)) menuToggle.focus();
}

menuToggle.addEventListener('click', () => setMenu(!app.classList.contains('menu-open')));
sidebarClose.addEventListener('click', () => setMenu(false));
overlay.addEventListener('click', () => setMenu(false));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') setMenu(false);
});

sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));

document.querySelector('#aboutButton').addEventListener('click', () => {
  setMenu(false);
  tipTitle.textContent = 'Sobre Farmacias Similunares';
  tipText.textContent = 'Una mision para explorar el cosmos.';
});
