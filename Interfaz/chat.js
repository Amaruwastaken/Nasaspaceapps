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
  if (!token) return 'Sign in to use Dr. SIMI bot.';

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return payload?.error || payload?.answer || 'Could not reach the assistant.';
  return payload.answer || 'The assistant did not return a response.';
}

function setupWidget() {
  const widget = document.querySelector('#drSimiWidget');
  if (!widget) return;

  widget.innerHTML = `
    <div class="dr-simi-header">
      <button class="dr-simi-toggle" type="button" aria-label="Minimize Dr. SIMI bot" aria-expanded="true" aria-controls="drSimiContent">
        <img src="Imagenes/farmacias-similunares.png" alt="" />
      </button>
      <strong class="dr-simi-title">Dr. SIMI bot</strong>
      <button class="dr-simi-close" type="button" aria-label="Close Dr. SIMI bot" aria-controls="drSimiContent">&times;</button>
    </div>
    <div class="dr-simi-content" id="drSimiContent">
      <div class="dr-simi-output" id="drSimiOutput">What would you like to check today?</div>
      <form id="drSimiForm" class="dr-simi-form">
        <input id="drSimiInput" type="text" maxlength="280" placeholder="Ask here..." aria-label="Question for Dr. SIMI bot" />
        <button type="submit">Send</button>
      </form>
    </div>
  `;

  const output = widget.querySelector('#drSimiOutput');
  const form = widget.querySelector('#drSimiForm');
  const input = widget.querySelector('#drSimiInput');
  const toggle = widget.querySelector('.dr-simi-toggle');
  const close = widget.querySelector('.dr-simi-close');
  const previousAnswer = loadHistory().filter((item) => item.role === 'assistant').at(-1);
  if (previousAnswer) output.textContent = previousAnswer.text;

  const setCollapsed = (collapsed) => {
    widget.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Open Dr. SIMI bot' : 'Dr. SIMI bot is open');
  };
  toggle.addEventListener('click', () => setCollapsed(false));
  close.addEventListener('click', () => setCollapsed(true));

  const updateSessionMessage = (user) => {
    if (!user) output.textContent = 'Sign in to chat with Dr. SIMI.';
    else {
      const lastAnswer = loadHistory().filter((item) => item.role === 'assistant').at(-1);
      output.textContent = lastAnswer?.text || 'What would you like to check today?';
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
    output.textContent = 'Dr. SIMI is thinking...';
    input.value = '';

    const answer = await askDrSimi(question).catch(() => 'I could not respond just now. Please try again.');
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
    appendMessage(thread, 'assistant', 'What would you like to check today?');
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
    const pending = appendMessage(thread, 'assistant', 'Thinking...');
    form.querySelector('button[type="submit"]').disabled = true;

    const answer = await askDrSimi(question).catch(() => 'I could not respond just now. Please try again.');
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
