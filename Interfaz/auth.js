import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config.js';

// Page-specific forms and shared navigation/session elements.
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const message = document.querySelector('#authMessage');
const protectedPage = document.querySelector('[data-requires-auth]');
const sidebarUserName = document.querySelector('#sidebarUserName');
let currentUser = null;
let notice;

function showMessage(text, error = false) {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle('is-error', error);
  message.setAttribute('role', error ? 'alert' : 'status');
}
// Reflect the Supabase session in navigation, protected content, and listeners.
function renderSession(session) {
  currentUser = session?.user ?? null;
  if (sidebarUserName) {
    const fullName = currentUser?.user_metadata?.full_name;
    sidebarUserName.textContent =
      typeof fullName === 'string' && fullName.trim()
        ? fullName.trim()
        : currentUser?.email ?? 'Usuario';
  }
  document.querySelectorAll('[data-auth]').forEach(el => {
    el.hidden = (el.dataset.auth === 'logged-in') !== Boolean(currentUser);
  });
  if (protectedPage) {
    protectedPage.hidden = !currentUser;
    if (!currentUser && !notice) {
      notice = document.createElement('p');
      notice.className = 'auth-notice';
      notice.setAttribute('role', 'status');
      const link = document.createElement('a');
      link.href = 'login.html';
      link.textContent = 'Inicia sesión para continuar.';
      notice.append(link);
      protectedPage.before(notice);
    }
    if (notice) notice.hidden = Boolean(currentUser);
  }
  document.dispatchEvent(new CustomEvent('sessionchange', { detail: currentUser }));
}
function busy(form, value) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = value;
  button.textContent = value ? 'Procesando…' : form === loginForm ? 'Iniciar sesión' : 'Crear cuenta';
}

// Load Supabase, restore the current session, and publish client readiness.
export const supabaseReady = (async () => {
  try {
    if (!SUPABASE_URL.startsWith('https://') || !SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY.includes('YOUR_')) {
      throw new Error('La conexión no está configurada.');
    }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    client.auth.onAuthStateChange((_event, session) => renderSession(session));
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    renderSession(data.session);
    [loginForm, registerForm].filter(Boolean).forEach(form => busy(form, false));
    return client;
  } catch (error) {
    renderSession(null);
    const text = `No se pudo conectar. ${error.message || 'Intenta recargar la página.'}`;
    showMessage(text, true);
    if (notice) notice.textContent = text;
    return null;
  }
})();
export const getCurrentUser = () => currentUser;

const healthPopup = document.createElement('dialog');
healthPopup.className = 'health-alert-popup';
healthPopup.setAttribute('aria-labelledby','healthPopupTitle');
const healthPopupContent = document.createElement('div');
healthPopupContent.className = 'health-alert-popup-content';
const healthPopupTitle = document.createElement('h2');
healthPopupTitle.id = 'healthPopupTitle';
healthPopupTitle.textContent = 'Alerta de salud crítica';
const healthPopupMessage = document.createElement('p');
const healthPopupButton = document.createElement('button');
healthPopupButton.type = 'button';
healthPopupButton.textContent = 'Entendido';
healthPopupContent.append(healthPopupTitle,healthPopupMessage,healthPopupButton);
healthPopup.append(healthPopupContent);
document.body.append(healthPopup);

let notificationLoading = false, notificationRequest = 0, currentNotificationId = null, currentNotificationUser = null;
function dismissHealthPopup() {
  if (healthPopup.open) healthPopup.close();
  currentNotificationId = null;
  currentNotificationUser = null;
}
async function refreshHealthPopup() {
  const client = await supabaseReady;
  const user = currentUser;
  if (!client || !user) { dismissHealthPopup(); return; }
  if (notificationLoading) return;
  notificationLoading = true;
  const request = ++notificationRequest;
  try {
    const {data,error} = await client.from('health_notifications')
      .select('id,message').eq('recipient_id',user.id).is('read_at',null)
      .order('created_at',{ascending:true}).limit(1).maybeSingle();
    if (error) throw error;
    if (request !== notificationRequest || user.id !== currentUser?.id) return;
    if (!data) { dismissHealthPopup(); return; }
    if (currentNotificationId === data.id && currentNotificationUser === user.id) return;
    currentNotificationId = data.id;
    currentNotificationUser = user.id;
    healthPopupMessage.textContent = data.message;
    if (!healthPopup.open) healthPopup.showModal();
  } catch (error) {
    if (request === notificationRequest) console.error('No se pudo actualizar la alerta de salud:',error);
  } finally { notificationLoading = false; }
}
healthPopupButton.addEventListener('click',async () => {
  const userId = currentNotificationUser;
  const notificationId = currentNotificationId;
  if (!userId || !notificationId) return;
  healthPopupButton.disabled = true;
  try {
    const client = await supabaseReady;
    if (!client || userId !== currentUser?.id) return;
    const {error} = await client.from('health_notifications')
      .update({read_at:new Date().toISOString()})
      .eq('id',notificationId).eq('recipient_id',userId).is('read_at',null);
    if (error) throw error;
    notificationRequest++;
    dismissHealthPopup();
    await refreshHealthPopup();
  } catch (error) {
    healthPopupMessage.textContent = `No se pudo cerrar la alerta. Intenta de nuevo. ${error.message || ''}`;
    console.error('No se pudo marcar la alerta de salud como leída:',error);
  } finally { healthPopupButton.disabled = false; }
});
healthPopup.addEventListener('cancel',event => {
  event.preventDefault();
  healthPopupButton.click();
});
document.addEventListener('sessionchange',() => {
  notificationRequest++;
  dismissHealthPopup();
  void refreshHealthPopup();
});
void supabaseReady.then(client => {
  if (!client) return;
  void refreshHealthPopup();
  window.setInterval(() => void refreshHealthPopup(),15000);
});

// Use the same handler for sign-in and registration forms.
for (const form of [loginForm, registerForm].filter(Boolean)) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    busy(form, true);
    showMessage('Conectando…');
    try {
      const client = await supabaseReady;
      if (!client) throw new Error('La conexión no está disponible.');
      const fields = new FormData(form);
      const credentials = { email: fields.get('correo').trim(), password: fields.get('contrasena') };
      const { data, error } = form === loginForm
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp({ ...credentials, options: { data: { full_name: fields.get('nombre').trim() } } });
      if (error) throw error;
      if (data.session) window.location.assign('Index.html');
      else {
        showMessage('Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.');
        form.reset();
      }
    } catch (error) { showMessage(error.message || 'No se pudo completar la solicitud.', true); }
    finally { busy(form, false); }
  });
}

// Sign out and keep an actionable message on failure.
document.querySelector('#logoutButton')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const client = await supabaseReady;
    if (!client) throw new Error('La conexión no está disponible.');
    const { error } = await client.auth.signOut();
    if (error) throw error;
    window.location.assign('Index.html');
  } catch (error) {
    button.textContent = 'No se pudo cerrar sesión. Reintentar';
    button.title = error.message;
  } finally { button.disabled = false; }
});
