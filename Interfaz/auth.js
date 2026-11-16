import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config.js';

// Page-specific forms and shared navigation/session elements.
const loginForm = document.querySelector('#loginForm');
const registerForm = document.querySelector('#registerForm');
const message = document.querySelector('#authMessage');
const protectedPage = document.querySelector('[data-requires-auth]');
const sidebarUserName = document.querySelector('#sidebarUserName');
const userRoles = Object.freeze({
  capitan:'Capitán',
  ingeniero:'Ingeniero',
  piloto:'Piloto',
  doctor:'Doctor',
  cientifico:'Científico',
});
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
    const displayName =
      typeof fullName === 'string' && fullName.trim()
        ? fullName.trim()
        : currentUser?.email ?? 'Usuario';
    const role = currentUser?.user_metadata?.role;
    const roleName = typeof role === 'string' && Object.hasOwn(userRoles,role) ? userRoles[role] : 'Sin rol';
    sidebarUserName.textContent = `${displayName} · ${roleName}`;
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
  let crewLink = document.querySelector('[data-crew-link]');
  const nav = document.querySelector('.nav-link[href="reporte.html"]');
  if (!crewLink && nav) {
    crewLink = document.createElement('a'); crewLink.href = 'doctor.html'; crewLink.className = 'nav-link nav-sublink';
    crewLink.dataset.crewLink = ''; crewLink.textContent = 'Vista General'; crewLink.hidden = true;
    const submenu = document.createElement('div');
    submenu.className = 'nav-submenu'; submenu.setAttribute('role','group');
    submenu.setAttribute('aria-label','Subpestañas de Reporte');
    submenu.append(crewLink); nav.after(submenu);
    if (document.querySelector('[data-crew-report]')) { crewLink.classList.add('is-active'); crewLink.setAttribute('aria-current','page'); nav.classList.add('is-parent-active'); }
  }
  if (crewLink) {
    const assignedRole = currentUser?.app_metadata?.role ?? currentUser?.user_metadata?.role;
    crewLink.hidden = !['doctor','capitan'].includes(assignedRole);
    crewLink.parentElement.hidden = crewLink.hidden;
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

const healthPanel = document.createElement('aside');
healthPanel.className = 'health-emergency-panel';
healthPanel.setAttribute('aria-label','Estado crítico de la tripulación');
healthPanel.setAttribute('role','alert');
healthPanel.setAttribute('aria-live','assertive');
healthPanel.hidden = true;
const healthPanelHeader = document.createElement('div');
healthPanelHeader.className = 'health-emergency-panel-header';
const healthPanelHeading = document.createElement('h2');
healthPanelHeading.textContent = 'Alerta: tripulante(s) en estado crítico';
const healthPanelMinimize = document.createElement('button');
healthPanelMinimize.className = 'health-emergency-minimize';
healthPanelMinimize.type = 'button';
healthPanelMinimize.textContent = '×';
healthPanelMinimize.setAttribute('aria-label','Minimizar alertas críticas');
healthPanelMinimize.setAttribute('aria-controls','healthEmergencyDetails');
healthPanelMinimize.setAttribute('aria-expanded','true');
healthPanelHeader.append(healthPanelHeading,healthPanelMinimize);
const healthPanelContent = document.createElement('div');
healthPanelContent.id = 'healthEmergencyDetails';
healthPanelContent.className = 'health-emergency-content';
const healthPanelList = document.createElement('ul');
healthPanelContent.append(healthPanelList);
const healthPanelRestore = document.createElement('button');
healthPanelRestore.className = 'health-emergency-restore';
healthPanelRestore.type = 'button';
healthPanelRestore.hidden = true;
healthPanel.append(healthPanelHeader,healthPanelContent,healthPanelRestore);
document.body.append(healthPanel);

let healthStatusLoading = false, healthStatusRequest = 0;
function clearHealthPanel() {
  healthPanel.hidden = true;
  healthPanel.classList.remove('is-minimized');
  healthPanelList.replaceChildren();
  healthPanelRestore.hidden = true;
  healthPanelMinimize.setAttribute('aria-expanded','true');
}
async function refreshHealthStatus() {
  const client = await supabaseReady;
  const user = currentUser;
  if (!client || !user) { clearHealthPanel(); return; }
  if (healthStatusLoading) return;
  healthStatusLoading = true;
  const request = ++healthStatusRequest;
  try {
    const {data,error} = await client.rpc('get_active_health_emergencies');
    if (error) throw error;
    if (request !== healthStatusRequest || user.id !== currentUser?.id) return;
    const emergencies = data ?? [];
    healthPanelList.replaceChildren(...emergencies.map(emergency => {
      const item = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = `Alerta, ${emergency.crew_name} en estado crítico`;
      const score = document.createElement('small');
      score.textContent = `Puntaje de riesgo: ${emergency.score}`;
      item.append(name,score);
      return item;
    }));
    if (emergencies.length) {
      healthPanelRestore.textContent = `${emergencies.length} alerta(s) crítica(s)`;
      healthPanel.hidden = false;
    } else clearHealthPanel();
  } catch (error) {
    if (request === healthStatusRequest) console.error('No se pudo leer el estado de emergencia desde Supabase:',error);
  } finally { healthStatusLoading = false; }
}
healthPanelMinimize.addEventListener('click',() => {
  healthPanel.classList.add('is-minimized');
  healthPanelMinimize.setAttribute('aria-expanded','false');
  healthPanelRestore.hidden = false;
  healthPanelRestore.focus();
});
healthPanelRestore.addEventListener('click',() => {
  healthPanel.classList.remove('is-minimized');
  healthPanelMinimize.setAttribute('aria-expanded','true');
  healthPanelRestore.hidden = true;
  healthPanelMinimize.focus();
});
document.addEventListener('sessionchange',() => {
  healthStatusRequest++;
  clearHealthPanel();
  void refreshHealthStatus();
});
document.addEventListener('healthstatuschange',() => void refreshHealthStatus());
void supabaseReady.then(client => {
  if (!client) return;
  void refreshHealthStatus();
  window.setInterval(() => void refreshHealthStatus(),10000);
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
      let result;
      if (form === loginForm) result = await client.auth.signInWithPassword(credentials);
      else {
        const name = fields.get('nombre');
        const role = fields.get('rol');
        if (typeof role !== 'string' || !Object.hasOwn(userRoles,role)) throw new Error('Selecciona un rol válido.');
        if (typeof name !== 'string' || !name.trim()) throw new Error('Escribe tu nombre completo.');
        result = await client.auth.signUp({ ...credentials, options: { data: { full_name: name.trim(), role } } });
      }
      const { data, error } = result;
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
