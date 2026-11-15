import {supabaseReady,getCurrentUser} from './auth.js';

const dateInput = document.querySelector('#missionStartDate');
const saveButton = document.querySelector('#saveMissionStart');
const message = document.querySelector('#missionStartMessage');
let request = 0, saving = false;

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
    feedback('Inicia sesión para configurar la fecha de inicio de tu misión.');
    return;
  }
  feedback('Cargando la fecha de inicio…');
  try {
    const client = await supabaseReady;
    if (!client) throw new Error('La conexión con Supabase no está disponible.');
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    const data = await fetchMissionStartViaFallback(client, userId);
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    if (data !== null) {
      const timestamp = Date.parse(data);
      if (!Number.isFinite(timestamp)) throw new Error('Supabase devolvió una fecha de misión inválida.');
      dateInput.value = new Date(timestamp).toISOString().slice(0,10);
    }
    dateInput.disabled = false;
    saveButton.disabled = false;
    feedback(data ? 'Fecha cargada. Puedes cambiarla y guardar.' : 'Selecciona la fecha de inicio de tu misión.');
  } catch (error) {
    if (currentRequest === request) feedback(error.message || 'No se pudo cargar la fecha de inicio.',true);
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
    if (!client) throw new Error('La conexión con Supabase no está disponible.');
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    const missionStartAt = dateInput.value ? `${dateInput.value}T00:00:00.000Z` : null;
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
    const { data, error } = await client.from('profiles').upsert({
      id: userId,
      mission_start_at: missionStartAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' }).select('id').maybeSingle();
    if (error) throw error;
    if (data === null && currentRequest === request) {
      throw new Error('No se pudo guardar la fecha de inicio de misión en el perfil.');
    }
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    feedback(missionStartAt ? 'Fecha de inicio guardada.' : 'Se quitó la fecha de inicio.');
  } catch (error) {
    if (currentRequest === request) feedback(error.message || 'No se pudo guardar la fecha de inicio.',true);
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
