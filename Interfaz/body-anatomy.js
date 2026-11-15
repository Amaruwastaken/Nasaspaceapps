import {metrics,classify} from './report-data.js';

const areas = {
  brain:{name:'Cerebro',x:183,y:65},
  eyes:{name:'Ojos',x:128,y:117},
  lungs:{name:'Pulmones',x:260,y:269,ids:['spo2','respiratoryRate','sleepApnea']},
  heart:{name:'Corazón',x:216,y:298},
  liver:{name:'Hígado',x:169,y:355,ids:[]},
  stomach:{name:'Estómago',x:232,y:386},
  kidneys:{name:'Riñones',x:263,y:409},
  intestines:{name:'Intestinos',x:205,y:460,ids:[]},
  body:{name:'Cuerpo',x:205,y:620},
};
const names = {green:'Normal',yellow:'Atención',red:'Alerta',unknown:'Sin clasificar',invalid:'Dato inválido',missing:'Sin datos'};
const priority = {red:0,yellow:1,unknown:2,invalid:3,green:4,missing:5};
const node = (tag,text,className) => { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; };

export function organReadings(id,values) {
  const area = areas[id];
  if (!area) return [];
  return metrics.filter(metric => area.ids ? area.ids.includes(metric.id) : metric.group === id || metric.organs?.includes(id))
    .map(metric => ({metric,state:classify(metric,values[metric.id],values)}))
    .sort((a,b) => priority[a.state]-priority[b.state]);
}
function areaState(readings) {
  for (const state of ['red','yellow','unknown','invalid','green']) if (readings.some(item => item.state === state)) return state;
  return 'missing';
}

export function createAnatomyView(root,formatValue) {
  const stage = root.querySelector('#bodyStage');
  const popup = root.querySelector('#bodyPopup');
  const content = root.querySelector('#bodyPopupContent');
  const closeButton = root.querySelector('#bodyPopupClose');
  const markerLayer = root.querySelector('#bodyMarkers');
  const targets = [...root.querySelectorAll('.body-organ[data-anatomy]')];
  let values = {},dates = {},active = null,timer,positionFrame;

  function cancelClose() { clearTimeout(timer); }
  function position() {
    if (!active || popup.hidden) return;
    const rect = active.getBoundingClientRect();
    const width = popup.offsetWidth,height = popup.offsetHeight;
    const margin = 16,gap = 18;
    let left = rect.right+gap;
    if (left+width > window.innerWidth-margin) left = rect.left-width-gap;
    left = Math.max(margin,Math.min(left,window.innerWidth-width-margin));
    const top = Math.max(margin,Math.min(rect.top-20,window.innerHeight-height-margin));
    popup.style.left = `${left}px`; popup.style.top = `${top}px`;
  }
  function queuePosition() { cancelAnimationFrame(positionFrame); positionFrame = requestAnimationFrame(position); }
  function close(restoreFocus = false) {
    cancelClose(); cancelAnimationFrame(positionFrame);
    const previous = active;
    // Focus first; its handler may run, then closing below wins.
    if (restoreFocus && previous) previous.focus({preventScroll:true});
    active = null; popup.hidden = true; content.replaceChildren(); stage.classList.remove('is-inspecting');
    for (const target of targets) { target.classList.remove('is-active'); target.setAttribute('aria-expanded','false'); }
  }
  function scheduleClose() { cancelClose(); timer = setTimeout(() => close(),200); }
  function fillPopup(id) {
    const area = areas[id];
    const readings = organReadings(id,values);
    const available = readings.filter(item => item.state !== 'missing');
    const state = areaState(available);
    const card = node('article','','body-stat-card'); card.dataset.state = state;
    const heading = node('div','','body-stat-heading');
    const title = node('h3',area.name); title.id = 'bodyPopupTitle';
    const label = node('span',names[state],'body-stat-state'); heading.append(title,label); card.append(heading);
    popup.setAttribute('aria-labelledby',title.id);
    if (!available.length) {
      card.append(node('p',readings.length ? 'No hay mediciones disponibles para este órgano.' : 'Todavía no hay mediciones vinculadas a este órgano.','body-popup-empty'));
    } else {
      const list = node('ul','','body-stat-readings');
      for (const {metric,state} of available) {
        const item = node('li','','body-stat-reading');
        const dot = node('span','','body-reading-dot'); dot.dataset.state = state; dot.setAttribute('aria-hidden','true');
        const text = node('span'); text.append(node('strong',metric.name));
        const date = dates[metric.id] ? ` · ${dates[metric.id]}` : '';
        text.append(node('small',`${formatValue(metric,values[metric.id])} · ${names[state]}${date}`));
        item.append(dot,text); list.append(item);
      }
      card.append(list);
      const missing = readings.length-available.length;
      if (missing) card.append(node('p',`${missing} ${missing === 1 ? 'indicador sin datos' : 'indicadores sin datos'}.`,'body-popup-empty'));
    }
    content.replaceChildren(card);
  }
  function open(target) {
    cancelClose();
    if (!areas[target.dataset.anatomy]) return;
    active = target;
    for (const item of targets) {
      const selected = item === target; item.classList.toggle('is-active',selected); item.setAttribute('aria-expanded',String(selected));
    }
    fillPopup(target.dataset.anatomy); popup.hidden = false; stage.classList.add('is-inspecting'); position(); queuePosition();
  }
  for (const target of targets) {
    target.addEventListener('pointerenter',event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') open(target); });
    target.addEventListener('pointerleave',event => {
      if (event.pointerType === 'touch' || popup.contains(event.relatedTarget) || target === document.activeElement) return;
      scheduleClose();
    });
    target.addEventListener('focus',() => open(target));
    target.addEventListener('click',() => open(target));
    target.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(target); }
      if (event.key === 'ArrowDown' && active === target) { event.preventDefault(); closeButton.focus(); }
    });
    target.addEventListener('focusout',event => { if (!popup.contains(event.relatedTarget) && !targets.includes(event.relatedTarget)) scheduleClose(); });
  }
  popup.addEventListener('pointerenter',cancelClose);
  popup.addEventListener('pointerleave',event => { if (event.pointerType !== 'touch' && !popup.contains(document.activeElement) && active !== document.activeElement) scheduleClose(); });
  popup.addEventListener('focusin',cancelClose);
  popup.addEventListener('focusout',event => { if (!popup.contains(event.relatedTarget) && event.relatedTarget !== active) scheduleClose(); });
  closeButton.addEventListener('click',() => close(popup.contains(document.activeElement)));
  document.addEventListener('keydown',event => { if (event.key === 'Escape' && active) { event.preventDefault(); close(popup.contains(document.activeElement)); } });
  document.addEventListener('pointerdown',event => { if (active && !popup.contains(event.target) && !targets.some(target => target.contains(event.target))) close(); });
  window.addEventListener('resize',queuePosition);
  document.addEventListener('scroll',queuePosition,true);

  function update(newValues,newDates) {
    close(); values = newValues; dates = newDates;
    markerLayer.replaceChildren();
    const states = new Set();
    for (const [id,area] of Object.entries(areas)) {
      const readings = organReadings(id,values); const state = areaState(readings);
      const target = targets.find(target => target.dataset.anatomy === id);
      if (target) target.setAttribute('aria-label',`${area.name}: ${names[state]}`);
      if (state === 'missing') continue;
      states.add(state);
      const marker = document.createElementNS('http://www.w3.org/2000/svg','circle');
      marker.classList.add('body-marker'); marker.dataset.state = state;
      marker.setAttribute('cx',String(area.x)); marker.setAttribute('cy',String(area.y)); marker.setAttribute('r','9'); markerLayer.append(marker);
    }
    root.hidden = false;
    for (const legend of root.querySelectorAll('.body-legend [data-state]')) legend.hidden = !states.has(legend.dataset.state);
  }
  return {update,close};
}
