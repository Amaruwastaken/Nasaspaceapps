import {supabaseReady,getCurrentUser} from './auth.js';

const dateInput = document.querySelector('#missionStartDate');
const saveButton = document.querySelector('#saveMissionStart');
const message = document.querySelector('#missionStartMessage');
const MISSION_START_STORAGE_KEY = 'farmacias-similunares.mission-start';
let request = 0, saving = false;

function todayISO() { return new Date().toISOString().slice(0,10); }
function readSavedMissionStart() {
  try { return localStorage.getItem(MISSION_START_STORAGE_KEY); }
  catch { return null; }
}
function writeSavedMissionStart(value) {
  try { if (value) localStorage.setItem(MISSION_START_STORAGE_KEY, value); else localStorage.removeItem(MISSION_START_STORAGE_KEY); }
  catch {}
}

function feedback(text,error = false) {
  message.textContent = text;
  message.classList.toggle('is-error',error);
  message.setAttribute('role',error ? 'alert' : 'status');
}

async function fetchMissionStartViaFallback(client, userId) {
  try {
    const { data, error } = await client.rpc('get_mission_start_at_for_user');
    if (!error) return data ?? null;
    const message = String(error?.message ?? '');
    const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.get_mission_start_at_for_user');
    if (!missingFunction) throw error;
  } catch (error) {
    const message = String(error?.message ?? '');
    const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.get_mission_start_at_for_user');
    if (!missingFunction) throw error;
  }
  const { data, error } = await client.from('profiles').select('mission_start_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.mission_start_at ?? null;
}

async function loadMissionStart() {
  const currentRequest = ++request;
  const userId = getCurrentUser()?.id ?? null;
  saving = false;
  dateInput.value = '';
  dateInput.disabled = true;
  saveButton.disabled = true;
  if (!userId) {
    const saved = readSavedMissionStart() ?? todayISO();
    dateInput.value = saved;
    dateInput.disabled = false;
    saveButton.disabled = false;
    feedback('Inicia sesión para sincronizar con Supabase; se usó la fecha local del navegador.');
    return;
  }
  feedback('Cargando la fecha de inicio…');
  try {
    const client = await supabaseReady;
    let data = null;
    if (client) {
      if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
      data = await fetchMissionStartViaFallback(client, userId).catch(() => null);
    }
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    if (data !== null) {
      const timestamp = Date.parse(data);
      if (!Number.isFinite(timestamp)) throw new Error('Supabase devolvió una fecha de misión inválida.');
      dateInput.value = new Date(timestamp).toISOString().slice(0,10);
      writeSavedMissionStart(dateInput.value);
    } else {
      const saved = readSavedMissionStart() ?? todayISO();
      dateInput.value = saved;
      writeSavedMissionStart(dateInput.value);
    }
    dateInput.disabled = false;
    saveButton.disabled = false;
    feedback(data ? 'Fecha cargada. Puedes cambiarla y guardar.' : 'No hay fecha guardada; se usó hoy como inicio por defecto.');
  } catch (error) {
    const fallbackDate = readSavedMissionStart() ?? todayISO();
    dateInput.value = fallbackDate;
    writeSavedMissionStart(fallbackDate);
    dateInput.disabled = false;
    saveButton.disabled = false;
    if (currentRequest === request) feedback('No se pudo sincronizar con Supabase; se usó la fecha local del navegador.', false);
  }
}

dateInput.addEventListener('input',() => {
  if (!dateInput.disabled) feedback('Cambios sin guardar.');
});

saveButton.addEventListener('click',async () => {
  const userId = getCurrentUser()?.id;
  if (!userId || saving) return;
  const currentRequest = ++request;
  saving = true;
  dateInput.disabled = true;
  saveButton.disabled = true;
  feedback('Guardando la fecha de inicio…');
  try {
    const client = await supabaseReady;
    const missionStartAt = dateInput.value ? `${dateInput.value}T00:00:00.000Z` : null;
    writeSavedMissionStart(dateInput.value || null);

    if (client) {
      if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
      try {
        const {error} = await client.rpc('set_mission_start_at_for_user',{p_mission_start_at:missionStartAt});
        if (!error) {
          if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
          feedback(missionStartAt ? 'Fecha de inicio guardada.' : 'Se quitó la fecha de inicio.');
          return;
        }
        const message = String(error?.message ?? '');
        const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.set_mission_start_at_for_user');
        if (!missingFunction) throw error;
      } catch (error) {
        const message = String(error?.message ?? '');
        const missingFunction = error?.code === '42883' || message.includes('without parameters') || message.includes('function public.set_mission_start_at_for_user');
        if (!missingFunction) throw error;
      }

      try {
        const { data, error } = await client.from('profiles').upsert({
          id: userId,
          mission_start_at: missionStartAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).select('id').maybeSingle();
        if (error) throw error;
        if (data === null && currentRequest === request) {
          throw new Error('No se pudo guardar la fecha de inicio de misión en el perfil.');
        }
      } catch (error) {
        if (currentRequest === request) feedback('Guardado localmente: la base de datos aún no está sincronizada.', false);
        return;
      }
    }
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    feedback(missionStartAt ? 'Fecha de inicio guardada.' : 'Se quitó la fecha de inicio.');
  } catch (error) {
    if (currentRequest === request) feedback('Se guardó localmente en el navegador; la base de datos aún no responde.', false);
  } finally {
    if (currentRequest === request) {
      saving = false;
      dateInput.disabled = false;
      saveButton.disabled = false;
    }
  }
});

document.addEventListener('sessionchange',loadMissionStart);
void loadMissionStart();
