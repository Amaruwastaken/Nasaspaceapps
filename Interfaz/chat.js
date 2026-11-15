import { supabaseReady, getCurrentUser } from './auth.js';

async function getSessionToken() {
  const client = await supabaseReady;
  const session = client ? (await client.auth.getSession()).data.session : null;
  return session?.access_token || null;
}

function appendMessage(thread, role, text) {
  const item = document.createElement('div');
  item.className = `chat-message ${role === 'assistant' ? 'assistant' : 'user'}`;
  item.textContent = text;
  thread.append(item);
  thread.scrollTop = thread.scrollHeight;
}

async function askDrSimi(question) {
  const token = await getSessionToken();
  if (!token) {
    return 'Debes iniciar sesión para usar Dr. SIMI bot.';
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return payload?.error || payload?.answer || 'No pude consultar al asistente.';
  }

  return payload.answer || 'No se obtuvo respuesta del asistente.';
}

function setupWidget() {
  const widget = document.querySelector('#drSimiWidget');
  if (!widget) return;

  widget.innerHTML = `
    <div class="dr-simi-header">
      <span class="dr-simi-badge">AI</span>
      <strong>Dr. SIMI bot</strong>
    </div>
    <div class="dr-simi-output" id="drSimiOutput">¿Qué quieres revisar hoy?</div>
    <form id="drSimiForm" class="dr-simi-form">
      <input id="drSimiInput" type="text" maxlength="280" placeholder="Pregunta aquí..." aria-label="Pregunta para Dr. SIMI bot" />
      <button type="submit">Enviar</button>
    </form>
  `;

  const output = widget.querySelector('#drSimiOutput');
  const form = widget.querySelector('#drSimiForm');
  const input = widget.querySelector('#drSimiInput');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    output.textContent = 'Dr. SIMI piensa…';
    input.value = '';

    const answer = await askDrSimi(question);
    output.textContent = answer;
  });
}

function setupChatPage() {
  const thread = document.querySelector('#chatThread');
  const form = document.querySelector('#chatForm');
  const input = document.querySelector('#chatInput');
  if (!thread || !form || !input) return;

  appendMessage(thread, 'assistant', 'Hola, soy Dr. SIMI bot. Puedo ayudarte a revisar sueño, reacción, visión, estrés y salud general durante la misión.');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    appendMessage(thread, 'user', question);
    input.value = '';
    appendMessage(thread, 'assistant', 'Consultando tus datos y la evidencia de NASA…');

    const answer = await askDrSimi(question);
    const lastAssistant = thread.lastElementChild;
    if (lastAssistant && lastAssistant.classList.contains('assistant')) {
      lastAssistant.textContent = answer;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupWidget();
  setupChatPage();
  const currentUser = getCurrentUser();
  const widget = document.querySelector('#drSimiWidget');
  if (widget && !currentUser) {
    widget.querySelector('#drSimiOutput').textContent = 'Inicia sesión para consultar Dr. SIMI bot.';
  }
});
