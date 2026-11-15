const element = (tag,text,className) => {
  const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el;
};
const action = (text,fn) => { const button = element('button',text,'capture-secondary'); button.type = 'button'; button.addEventListener('click',fn); return button; };
const status = () => { const el = element('p','','test-result'); el.setAttribute('role','status'); return el; };
export function rawTlx(scores) {
  if (scores.length !== 6 || scores.some(v => v === null || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > 100)) return null;
  return Math.round(scores.reduce((sum,v) => sum+Number(v),0)/6);
}
export function amslerResult(eyes) {
  const rank = ['green','yellow','red'];
  if (eyes.length !== 2 || eyes.some(value => !rank.includes(value))) return null;
  return rank[Math.max(...eyes.map(value => rank.indexOf(value)))];
}
export function reactionMean(attempts) {
  const valid = attempts.filter(v => Number.isFinite(v) && v >= 100);
  return valid.length ? Math.round(valid.reduce((sum,v) => sum+v,0)/valid.length) : null;
}
export function mountDigitalTest(id,container,draft,onChange) {
  if (id === 'pvt') return mountReaction(container,draft,onChange);
  if (id === 'tlx') return mountTlx(container,draft,onChange);
  return mountAmsler(container,draft,onChange);
}
function mountReaction(container,draft,changed) {
  const info = element('p','Durante 60 segundos, pulsa cuando aparezca «¡Ahora!». Puedes tocar el panel o usar Espacio mientras está enfocado. No pulses antes.','test-instructions');
  const note = element('p','Prueba breve orientativa de reacción, no equivalente al protocolo PVT validado. La pantalla y el dispositivo afectan los tiempos.','metric-ranges');
  const result = status();
  const panel = element('button','Comenzar prueba','reaction-panel'); panel.type = 'button';
  const clock = element('p','','metric-ranges');
  let state = 'idle',signal = 0,deadline = 0,attempts = [],early = 0,timeouts = 0,timer,finishTimer,countdown,frame,disposed = false;
  const clear = () => { clearTimeout(timer); clearTimeout(finishTimer); clearInterval(countdown); cancelAnimationFrame(frame); };
  const showSaved = () => { result.textContent = draft.result != null ? `Resultado: ${draft.result} ms. Puedes repetir la prueba.` : 'Completa la prueba para obtener tu resultado.'; };
  function end() {
    clear(); state = 'done'; panel.dataset.state = 'done'; panel.textContent = 'Repetir prueba'; clock.textContent = '';
    draft.result = reactionMean(attempts);
    result.textContent = draft.result === null ? 'No hubo respuestas válidas. Repite la prueba.' : `Promedio: ${draft.result} ms · ${attempts.length} respuestas · ${early} anticipadas · ${timeouts} sin respuesta.`;
    changed();
  }
  function schedule() {
    if (disposed) return;
    if (performance.now() >= deadline) { end(); return; }
    state = 'waiting'; panel.dataset.state = 'waiting'; panel.textContent = 'Espera…';
    timer = setTimeout(() => {
      if (performance.now() >= deadline) { end(); return; }
      // Timestamp after the cue is committed for painting; input uses performance.now too.
      state = 'drawing'; panel.dataset.state = 'ready'; panel.textContent = '¡Ahora!';
      frame = requestAnimationFrame(() => {
        if (disposed || state !== 'drawing') return;
        signal = performance.now(); state = 'ready';
        timer = setTimeout(() => { timeouts++; result.textContent = 'Sin respuesta. Espera la siguiente señal.'; schedule(); },3000);
      });
    },2000+Math.random()*3000);
  }
  function respond() {
    if (state === 'idle' || state === 'done') {
      clear(); attempts = []; early = 0; timeouts = 0; draft.result = null; changed();
      deadline = performance.now()+60000;
      finishTimer = setTimeout(end,60000);
      const showClock = () => { clock.textContent = `Tiempo restante: ${Math.max(0,Math.ceil((deadline-performance.now())/1000))} s`; };
      showClock(); countdown = setInterval(showClock,250);
      result.textContent = 'Prueba en curso…'; schedule(); return;
    }
    if (performance.now() >= deadline) { end(); return; }
    if (state === 'waiting' || state === 'drawing') {
      clearTimeout(timer); cancelAnimationFrame(frame); early++; result.textContent = 'Te anticipaste. Espera la siguiente señal.'; schedule(); return;
    }
    if (state !== 'ready') return;
    clearTimeout(timer);
    const elapsed = performance.now()-signal;
    if (elapsed < 100) { early++; result.textContent = 'Respuesta demasiado anticipada; no se incluye en el promedio.'; }
    else { attempts.push(elapsed); result.textContent = `Última respuesta: ${Math.round(elapsed)} ms`; }
    schedule();
  }
  const pointer = event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); panel.focus({preventScroll:true}); respond(); } };
  const keyboard = event => { if ((event.code === 'Space' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); respond(); } };
  const click = event => { if (event.detail === 0) respond(); };
  panel.addEventListener('pointerdown',pointer); panel.addEventListener('keydown',keyboard); panel.addEventListener('click',click);
  const visibility = () => {
    if (document.hidden && !['idle','done'].includes(state)) {
      clear(); state = 'idle'; draft.result = null; changed(); panel.dataset.state = ''; panel.textContent = 'Reiniciar prueba'; clock.textContent = ''; result.textContent = 'Prueba interrumpida al cambiar de pestaña. Comienza de nuevo.';
    }
  };
  document.addEventListener('visibilitychange',visibility);
  showSaved(); container.append(info,note,panel,clock,result);
  return {read:() => draft.result,validate:() => draft.result != null,destroy:() => { disposed = true; clear(); document.removeEventListener('visibilitychange',visibility); }};
}
function mountTlx(container,draft,changed) {
  container.append(element('p','Piensa en la tarea que acabas de realizar. Responde las seis escalas. El promedio sin ponderación (Raw‑TLX) se calcula automáticamente.','test-instructions'));
  const dimensions = [
    ['Demanda mental','¿Cuánta concentración y esfuerzo mental necesitaste?','Muy poca','Muy alta'],
    ['Demanda física','¿Cuánto esfuerzo físico necesitaste?','Muy poco','Muy alto'],
    ['Presión de tiempo','¿Qué tan apresurado fue el ritmo de la tarea?','Sin prisa','Muy apresurado'],
    ['Rendimiento','¿Qué tan lejos quedaste de cumplir tus objetivos?','Éxito completo','Fracaso completo'],
    ['Esfuerzo','¿Cuánto tuviste que esforzarte para lograr tu resultado?','Muy poco','Muchísimo'],
    ['Frustración','¿Cuánta frustración, inseguridad o tensión sentiste?','Muy poca','Muy alta'],
  ];
  draft.scores ??= Array(6).fill(null);
  const result = status();
  function update() { draft.result = rawTlx(draft.scores); result.textContent = draft.result === null ? `${draft.scores.filter(v => v !== null).length} de 6 escalas respondidas.` : `Raw‑TLX: ${draft.result} / 100`; changed(); }
  dimensions.forEach(([title,question,low,high],index) => {
    const field = element('div','','tlx-scale');
    const label = element('label',`${title}: ${question}`); label.htmlFor = `tlx-${index}`;
    const input = element('input'); input.type = 'range'; input.id = label.htmlFor; input.min = '0'; input.max = '100'; input.step = '5'; input.value = draft.scores[index] ?? 50;
    const value = element('output',draft.scores[index] === null ? 'Sin responder' : String(draft.scores[index])); value.htmlFor = input.id;
    const ends = element('p',`0 · ${low} — 100 · ${high}`,'metric-ranges');
    const confirm = action('Confirmar este valor',() => { draft.scores[index] = Number(input.value); value.textContent = input.value; update(); });
    input.addEventListener('input',() => { draft.scores[index] = Number(input.value); value.textContent = input.value; update(); });
    field.append(label,input,value,ends,confirm); container.append(field);
  });
  container.append(result); result.textContent = draft.result != null ? `Resultado guardado: ${draft.result} / 100. Puedes completar las escalas para actualizarlo.` : 'Responde las seis escalas.';
  return {read:() => draft.result,validate:() => draft.result != null,destroy() {}};
}
function mountAmsler(container,draft,changed) {
  container.append(element('p','Usa tus lentes de lectura habituales y buena iluminación. A una distancia cómoda de lectura (aprox. 30–35 cm), cubre un ojo sin presionarlo y fija la mirada en el punto central. Repite con el otro ojo.','test-instructions'));
  container.append(element('p','Comprobación visual orientativa: no detecta automáticamente alteraciones ni diagnostica SANS. El tamaño mostrado depende de la pantalla.','metric-ranges'));
  const grid = document.createElementNS('http://www.w3.org/2000/svg','svg'); grid.setAttribute('viewBox','0 0 220 220'); grid.classList.add('amsler-grid'); grid.setAttribute('role','img'); grid.setAttribute('aria-label','Cuadrícula de Amsler, líneas rectas con punto central');
  const background = document.createElementNS(grid.namespaceURI,'rect'); background.setAttribute('width','220'); background.setAttribute('height','220'); background.setAttribute('fill','white'); grid.append(background);
  const path = document.createElementNS(grid.namespaceURI,'path'); let d = '';
  for (let n = 10;n <= 210;n += 10) d += `M${n} 10V210M10 ${n}H210`;
  path.setAttribute('d',d); path.setAttribute('stroke','#111'); path.setAttribute('stroke-width','.8'); grid.append(path);
  const dot = document.createElementNS(grid.namespaceURI,'circle'); dot.setAttribute('cx','110'); dot.setAttribute('cy','110'); dot.setAttribute('r','3'); dot.setAttribute('fill','black'); grid.append(dot); container.append(grid);
  draft.eyes ??= ['', '']; const result = status();
  ['Ojo derecho (cubre el izquierdo)','Ojo izquierdo (cubre el derecho)'].forEach((text,index) => {
    const field = element('fieldset','','amsler-eye'); field.append(element('legend',text));
    [['green','Veo líneas rectas y no faltan zonas'],['yellow','Veo líneas onduladas o distorsionadas'],['red','Veo manchas, zonas ausentes o distorsión severa']].forEach(([value,text]) => {
      const label = element('label'); const input = element('input'); input.type = 'radio'; input.name = `amsler-eye-${index}`; input.value = value; input.checked = draft.eyes[index] === value;
      input.addEventListener('change',() => { draft.eyes[index] = value; draft.result = amslerResult(draft.eyes); result.textContent = draft.result ? `Ambos ojos revisados. Resultado: ${draft.result === 'red' ? 'alerta' : draft.result === 'yellow' ? 'atención' : 'sin distorsión informada'}.` : 'Falta revisar el otro ojo.'; changed(); });
      label.append(input,document.createTextNode(text)); field.append(label);
    }); container.append(field);
  });
  result.textContent = draft.result ? 'Hay un resultado guardado. Revisa ambos ojos para actualizarlo.' : 'Revisa ambos ojos para completar la prueba.';
  container.append(result);
  return {read:() => draft.result,validate:() => draft.result != null,destroy() {}};
}
