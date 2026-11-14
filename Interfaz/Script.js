const app = document.querySelector('#app');
const menuToggle = document.querySelector('#menuToggle');
const sidebar = document.querySelector('#sidebar');
const sidebarClose = document.querySelector('#sidebarClose');
const overlay = document.querySelector('#overlay');
const stage = document.querySelector('#organStage');
const organs = [...document.querySelectorAll('.organ')];
const tipTitle = document.querySelector('#tipTitle');
const tipText = document.querySelector('#tipText');

const organInfo = {
  cerebro: { title: 'Cerebro', text: 'Coordina el pensamiento, la memoria, las sensaciones y el movimiento.' },
  corazon: { title: 'Corazón', text: 'Bombea la sangre para llevar oxígeno y nutrientes a todo el cuerpo.' },
  pulmones: { title: 'Pulmones', text: 'Permiten incorporar oxígeno y eliminar dióxido de carbono.' }
};

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
document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));

function showOrgan(name, selected = false) {
  const data = organInfo[name];
  if (!data) return;
  tipTitle.textContent = data.title;
  tipText.textContent = data.text;
  if (selected) {
    stage.classList.add('has-selection');
    organs.forEach(organ => organ.classList.toggle('is-selected', organ.dataset.organ === name));
  }
}
function clearSelection() {
  stage.classList.remove('has-selection');
  organs.forEach(organ => organ.classList.remove('is-selected'));
  tipTitle.textContent = 'Explora los órganos';
  tipText.textContent = 'Pasa el cursor por un órgano o tócalo para ver información.';
}
organs.forEach(organ => {
  organ.addEventListener('mouseenter', () => showOrgan(organ.dataset.organ));
  organ.addEventListener('focus', () => showOrgan(organ.dataset.organ));
  organ.addEventListener('click', () => {
    if (organ.classList.contains('is-selected')) clearSelection();
    else showOrgan(organ.dataset.organ, true);
  });
});
stage.addEventListener('mouseleave', () => {
  const selected = stage.querySelector('.organ.is-selected');
  if (selected) showOrgan(selected.dataset.organ);
  else clearSelection();
});
sidebar.querySelectorAll('[data-select]').forEach(link => link.addEventListener('click', () => {
  showOrgan(link.dataset.select, true);
  setMenu(false);
  stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));
document.querySelector('#aboutButton').addEventListener('click', () => {
  setMenu(false);
  tipTitle.textContent = 'Sobre Loso';
  tipText.textContent = 'Proyecto interactivo para explorar y aprender sobre el cuerpo humano.';
  stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
