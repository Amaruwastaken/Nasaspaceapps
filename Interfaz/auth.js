import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config.js';

const message = document.querySelector('#authMessage');
const registerForm = document.querySelector('#registerForm');
const loginForm = document.querySelector('#loginForm');

function showMessage(text, isError = false) {
  message.textContent = text;
  message.setAttribute('role', isError ? 'alert' : 'status');
}

function setFormBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.textContent = busy
    ? 'Procesando…'
    : form === registerForm
      ? 'Registrarme'
      : 'Iniciar Sesión';
}

const isConfigured =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
  SUPABASE_PUBLISHABLE_KEY !== 'YOUR_SUPABASE_PUBLISHABLE_KEY';

const supabaseReady = isConfigured
  ? import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm')
      .then(({ createClient }) => {
        const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        [registerForm, loginForm].filter(Boolean).forEach(form => {
          setFormBusy(form, false);
        });
        return client;
      })
      .catch(error => {
        showMessage(
          error instanceof Error
            ? `No se pudo cargar Supabase: ${error.message}`
            : 'No se pudo cargar Supabase.',
          true
        );
        return null;
      })
  : Promise.resolve(null);

if (!isConfigured) {
  showMessage(
    'Configura la URL y la publishable key de Supabase en supabase-config.js.',
    true
  );
}

if (registerForm) {
  registerForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const name = formData.get('nombre')?.toString().trim();
    const email = formData.get('correo')?.toString().trim();
    const password = formData.get('contrasena')?.toString();

    if (!name || !email || !password) {
      showMessage('Completa todos los campos.', true);
      return;
    }

    setFormBusy(registerForm, true);
    showMessage('Creando tu cuenta…');
    try {
      const supabase = await supabaseReady;
      if (!supabase) {
        showMessage('Supabase no está configurado o no se pudo cargar.', true);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw error;

      showMessage(
        data.session
          ? 'Cuenta creada. Ya puedes iniciar sesión.'
          : 'Cuenta creada. Revisa tu correo para confirmar el registro.'
      );
      registerForm.reset();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'No se pudo crear la cuenta.',
        true
      );
    } finally {
      setFormBusy(registerForm, false);
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('correo')?.toString().trim();
    const password = formData.get('contrasena')?.toString();

    if (!email || !password) {
      showMessage('Ingresa tu correo y contraseña.', true);
      return;
    }

    setFormBusy(loginForm, true);
    showMessage('Iniciando sesión…');
    try {
      const supabase = await supabaseReady;
      if (!supabase) {
        showMessage('Supabase no está configurado o no se pudo cargar.', true);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.assign('Index.html');
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
        true
      );
    } finally {
      setFormBusy(loginForm, false);
    }
  });
}
