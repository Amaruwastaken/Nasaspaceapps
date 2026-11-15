import { supabaseReady, getCurrentUser } from './auth.js';

const HISTORY_PREFIX = 'farmacias-similunares.dr-simi.history.';

async function getSessionToken() {
  const client = await supabaseReady;
  const session = client ? (await client.auth.getSession()).data.session : null;
  return session?.access_token || null;
}

function historyKey() {
  const user = getCurrentUser();
  return user?.id ? `${HISTORY_PREFIX}${user.id}` : null;
}

function loadHistory() {
  const key = historyKey();
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => ['user', 'assistant'].includes(item?.role) && typeof item?.text === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  const key = historyKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.warn('Could not save Dr. SIMI chat history.', error);
  }
}

function appendMessage(thread, role, text) {
  const item = document.createElement('div');
  item.className = `chat-message ${role === 'assistant' ? 'assistant' : 'user'}`;
  item.textContent = text;
  thread.append(item);
  thread.scrollTop = thread.scrollHeight;
  return item;
}

async function askDrSimi(question) {
  const token = await getSessionToken();
  if (!token) return 'Inicia sesi\u00f3n para usar Dr. SIMI bot.';

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return payload?.error || payload?.answer || 'No pude consultar al asistente.';
  return payload.answer || 'No se obtuvo respuesta del asistente.';
}

function setupWidget() {
  const widget = document.querySelector('#drSimiWidget');
  if (!widget) return;

  widget.innerHTML = `
    <div class="dr-simi-header">
      <button class="dr-simi-toggle" type="button" aria-label="Minimizar Dr. SIMI bot" aria-expanded="true" aria-controls="drSimiContent">
        <img src="Imagenes/farmacias-similunares.png" alt="" />
      </button>
      <strong class="dr-simi-title">Dr. SIMI bot</strong>
    </div>
    <div class="dr-simi-content" id="drSimiContent">
      <div class="dr-simi-output" id="drSimiOutput">\u00bfQu\u00e9 quieres revisar hoy?</div>
      <form id="drSimiForm" class="dr-simi-form">
        <input id="drSimiInput" type="text" maxlength="280" placeholder="Pregunta aqu\u00ed..." aria-label="Pregunta para Dr. SIMI bot" />
        <button type="submit">Enviar</button>
      </form>
    </div>
  `;

  const output = widget.querySelector('#drSimiOutput');
  const form = widget.querySelector('#drSimiForm');
  const input = widget.querySelector('#drSimiInput');
  const toggle = widget.querySelector('.dr-simi-toggle');
  const previousAnswer = loadHistory().filter((item) => item.role === 'assistant').at(-1);
  if (previousAnswer) output.textContent = previousAnswer.text;

  toggle.addEventListener('click', () => {
    const collapsed = widget.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Abrir' : 'Minimizar'} Dr. SIMI bot`);
  });

  const updateSessionMessage = (user) => {
    if (!user) output.textContent = 'Inicia sesi\u00f3n para consultar Dr. SIMI bot.';
    else {
      const lastAnswer = loadHistory().filter((item) => item.role === 'assistant').at(-1);
      output.textContent = lastAnswer?.text || '\u00bfQu\u00e9 quieres revisar hoy?';
    }
  };
  document.addEventListener('sessionchange', (event) => updateSessionMessage(event.detail));
  void supabaseReady.then(() => updateSessionMessage(getCurrentUser()));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    const history = loadHistory();
    history.push({ role: 'user', text: question });
    saveHistory(history);
    output.textContent = 'Dr. SIMI est\u00e1 pensando...';
    input.value = '';

    const answer = await askDrSimi(question).catch(() => 'No pude responder ahora. Intentalo de nuevo.');
    history.push({ role: 'assistant', text: answer });
    saveHistory(history);
    output.textContent = answer;
  });
}

async function setupChatPage() {
  const thread = document.querySelector('#chatThread');
  const form = document.querySelector('#chatForm');
  const input = document.querySelector('#chatInput');
  if (!thread || !form || !input) return;

  await supabaseReady;
  const history = loadHistory();
  if (history.length) {
    history.forEach((item) => appendMessage(thread, item.role, item.text));
  } else {
    appendMessage(thread, 'assistant', '\u00bfQu\u00e9 quieres revisar hoy?');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    const messages = loadHistory();
    messages.push({ role: 'user', text: question });
    saveHistory(messages);
    appendMessage(thread, 'user', question);
    input.value = '';
    const pending = appendMessage(thread, 'assistant', 'Estoy pensando...');
    form.querySelector('button[type="submit"]').disabled = true;

    const answer = await askDrSimi(question).catch(() => 'No pude responder ahora. Intentalo de nuevo.');
    pending.textContent = answer;
    messages.push({ role: 'assistant', text: answer });
    saveHistory(messages);
    form.querySelector('button[type="submit"]').disabled = false;
    input.focus();
  });
}

window.addEventListener('storage', (event) => {
  const thread = document.querySelector('#chatThread');
  const key = historyKey();
  if (!thread || !key || event.key !== key) return;
  thread.replaceChildren();
  const history = loadHistory();
  if (history.length) history.forEach((item) => appendMessage(thread, item.role, item.text));
});

document.addEventListener('DOMContentLoaded', () => {
  setupWidget();
  void setupChatPage();
});
