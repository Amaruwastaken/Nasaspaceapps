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
  const info = element('p','For 60 seconds, tap when “Now!” appears. You can tap the panel or press Space while it is focused. Do not press early.','test-instructions');
  const note = element('p','Brief reaction-time screening only; this is not the validated PVT protocol. Your screen and device affect the results.','metric-ranges');
  const result = status();
  const panel = element('button','Start test','reaction-panel'); panel.type = 'button';
  const clock = element('p','','metric-ranges');
  let state = 'idle',signal = 0,deadline = 0,attempts = [],early = 0,timeouts = 0,timer,finishTimer,countdown,frame,disposed = false;
  const clear = () => { clearTimeout(timer); clearTimeout(finishTimer); clearInterval(countdown); cancelAnimationFrame(frame); };
  const showSaved = () => { result.textContent = draft.result != null ? `Result: ${draft.result} ms. You can repeat the test.` : 'Complete the test to get your result.'; };
  function end() {
    clear(); state = 'done'; panel.dataset.state = 'done'; panel.textContent = 'Repeat test'; clock.textContent = '';
    draft.result = reactionMean(attempts);
    result.textContent = draft.result === null ? 'No valid responses. Try the test again.' : `Average: ${draft.result} ms · ${attempts.length} responses · ${early} early · ${timeouts} timed out.`;
    changed();
  }
  function schedule() {
    if (disposed) return;
    if (performance.now() >= deadline) { end(); return; }
    state = 'waiting'; panel.dataset.state = 'waiting'; panel.textContent = 'Wait…';
    timer = setTimeout(() => {
      if (performance.now() >= deadline) { end(); return; }
      // Timestamp after the cue is committed for painting; input uses performance.now too.
      state = 'drawing'; panel.dataset.state = 'ready'; panel.textContent = 'Now!';
      frame = requestAnimationFrame(() => {
        if (disposed || state !== 'drawing') return;
        signal = performance.now(); state = 'ready';
        timer = setTimeout(() => { timeouts++; result.textContent = 'No response. Wait for the next signal.'; schedule(); },3000);
      });
    },2000+Math.random()*3000);
  }
  function respond() {
    if (state === 'idle' || state === 'done') {
      clear(); attempts = []; early = 0; timeouts = 0; draft.result = null; changed();
      deadline = performance.now()+60000;
      finishTimer = setTimeout(end,60000);
      const showClock = () => { clock.textContent = `Time remaining: ${Math.max(0,Math.ceil((deadline-performance.now())/1000))} s`; };
      showClock(); countdown = setInterval(showClock,250);
      result.textContent = 'Test in progress…'; schedule(); return;
    }
    if (performance.now() >= deadline) { end(); return; }
    if (state === 'waiting' || state === 'drawing') {
      clearTimeout(timer); cancelAnimationFrame(frame); early++; result.textContent = 'Too early. Wait for the next signal.'; schedule(); return;
    }
    if (state !== 'ready') return;
    clearTimeout(timer);
    const elapsed = performance.now()-signal;
    if (elapsed < 100) { early++; result.textContent = 'Response was too early and is not included in the average.'; }
    else { attempts.push(elapsed); result.textContent = `Latest response: ${Math.round(elapsed)} ms`; }
    schedule();
  }
  const pointer = event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); panel.focus({preventScroll:true}); respond(); } };
  const keyboard = event => { if ((event.code === 'Space' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); respond(); } };
  const click = event => { if (event.detail === 0) respond(); };
  panel.addEventListener('pointerdown',pointer); panel.addEventListener('keydown',keyboard); panel.addEventListener('click',click);
  const visibility = () => {
    if (document.hidden && !['idle','done'].includes(state)) {
      clear(); state = 'idle'; draft.result = null; changed(); panel.dataset.state = ''; panel.textContent = 'Restart test'; clock.textContent = ''; result.textContent = 'Test interrupted when you changed tabs. Start again.';
    }
  };
  document.addEventListener('visibilitychange',visibility);
  showSaved(); container.append(info,note,panel,clock,result);
  return {read:() => draft.result,validate:() => draft.result != null,destroy:() => { disposed = true; clear(); document.removeEventListener('visibilitychange',visibility); }};
}
function mountTlx(container,draft,changed) {
  container.append(element('p','Think about the task you just completed. Rate all six scales. The unweighted average (Raw‑TLX) is calculated automatically.','test-instructions'));
  const dimensions = [
    ['Mental demand','How much mental effort and concentration did you need?','Very low','Very high'],
    ['Physical demand','How much physical effort did you need?','Very low','Very high'],
    ['Time pressure','How hurried was the pace of the task?','Not at all','Very hurried'],
    ['Performance','How successful were you in meeting your goals?','Complete success','Complete failure'],
    ['Effort','How hard did you have to work to achieve your result?','Very low','Very high'],
    ['Frustration','How frustrated, insecure, or tense did you feel?','Very low','Very high'],
  ];
  draft.scores ??= Array(6).fill(null);
  const result = status();
  function update() { draft.result = rawTlx(draft.scores); result.textContent = draft.result === null ? `${draft.scores.filter(v => v !== null).length} of 6 scales answered.` : `Raw‑TLX: ${draft.result} / 100`; changed(); }
  dimensions.forEach(([title,question,low,high],index) => {
    const field = element('div','','tlx-scale');
    const label = element('label',`${title}: ${question}`); label.htmlFor = `tlx-${index}`;
    const input = element('input'); input.type = 'range'; input.id = label.htmlFor; input.min = '0'; input.max = '100'; input.step = '5'; input.value = draft.scores[index] ?? 50;
    const value = element('output',draft.scores[index] === null ? 'Not answered' : String(draft.scores[index])); value.htmlFor = input.id;
    const ends = element('p',`0 · ${low} — 100 · ${high}`,'metric-ranges');
    const confirm = action('Confirm this value',() => { draft.scores[index] = Number(input.value); value.textContent = input.value; update(); });
    input.addEventListener('input',() => { draft.scores[index] = Number(input.value); value.textContent = input.value; update(); });
    field.append(label,input,value,ends,confirm); container.append(field);
  });
  container.append(result); result.textContent = draft.result != null ? `Saved result: ${draft.result} / 100. You can complete the scales to update it.` : 'Rate all six scales.';
  return {read:() => draft.result,validate:() => draft.result != null,destroy() {}};
}
function mountAmsler(container,draft,changed) {
  container.append(element('p','Use your usual reading glasses and good lighting. At a comfortable reading distance (about 30–35 cm), cover one eye without pressing on it and focus on the center dot. Repeat with the other eye.','test-instructions'));
  container.append(element('p','Vision screening only: this does not automatically detect changes or diagnose SANS. The displayed size depends on your screen.','metric-ranges'));
  const grid = document.createElementNS('http://www.w3.org/2000/svg','svg'); grid.setAttribute('viewBox','0 0 220 220'); grid.classList.add('amsler-grid'); grid.setAttribute('role','img'); grid.setAttribute('aria-label','Amsler grid with straight lines and a center dot');
  const background = document.createElementNS(grid.namespaceURI,'rect'); background.setAttribute('width','220'); background.setAttribute('height','220'); background.setAttribute('fill','white'); grid.append(background);
  const path = document.createElementNS(grid.namespaceURI,'path'); let d = '';
  for (let n = 10;n <= 210;n += 10) d += `M${n} 10V210M10 ${n}H210`;
  path.setAttribute('d',d); path.setAttribute('stroke','#111'); path.setAttribute('stroke-width','.8'); grid.append(path);
  const dot = document.createElementNS(grid.namespaceURI,'circle'); dot.setAttribute('cx','110'); dot.setAttribute('cy','110'); dot.setAttribute('r','3'); dot.setAttribute('fill','black'); grid.append(dot); container.append(grid);
  draft.eyes ??= ['', '']; const result = status();
  ['Right eye (cover the left eye)','Left eye (cover the right eye)'].forEach((text,index) => {
    const field = element('fieldset','','amsler-eye'); field.append(element('legend',text));
    [['green','Lines look straight and no areas are missing'],['yellow','Lines look wavy or distorted'],['red','I see spots, missing areas, or severe distortion']].forEach(([value,text]) => {
      const label = element('label'); const input = element('input'); input.type = 'radio'; input.name = `amsler-eye-${index}`; input.value = value; input.checked = draft.eyes[index] === value;
      input.addEventListener('change',() => { draft.eyes[index] = value; draft.result = amslerResult(draft.eyes); result.textContent = draft.result ? `Both eyes checked. Result: ${draft.result === 'red' ? 'alert' : draft.result === 'yellow' ? 'caution' : 'no distortion reported'}.` : 'Check the other eye.'; changed(); });
      label.append(input,document.createTextNode(text)); field.append(label);
    }); container.append(field);
  });
  result.textContent = draft.result ? 'A result is saved. Check both eyes to update it.' : 'Check both eyes to complete the test.';
  container.append(result);
  return {read:() => draft.result,validate:() => draft.result != null,destroy() {}};
}
