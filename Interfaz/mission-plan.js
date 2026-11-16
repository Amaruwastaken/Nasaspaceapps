import { getCurrentUser, supabaseReady } from './auth.js';

const saveButton = document.querySelector('#saveMissionName');
const resetButton = document.querySelector('#missionsReset');
const hint = document.querySelector('#missionSaveHint');
const nameInput = document.querySelector('#missionName');
const travelInput = document.querySelector('#travelDays');
const stayInput = document.querySelector('#stayDays');
const startInput = document.querySelector('#missionStartDate');

const plan = await new Promise(resolve => {
  if (window.missionPlan) resolve(window.missionPlan);
  else document.addEventListener('missionplanready', () => resolve(window.missionPlan), { once: true });
});

let request = 0;
let saving = false;
let resetting = false;

function showError(message) {
  hint.textContent = message;
  hint.classList.add('is-error');
}

function showStatus(message) {
  hint.textContent = message;
  hint.classList.remove('is-error');
}

async function loadSharedMission() {
  const currentRequest = ++request;
  const client = await supabaseReady;
  const userId = getCurrentUser()?.id;
  if (!client) {
    showError('No se pudo conectar con Supabase. Revisa la configuración e inténtalo de nuevo.');
    resetButton.hidden = !plan.read().locked;
    return;
  }
  if (!userId) {
    showStatus('Inicia sesión para cargar o guardar la misión compartida en Supabase.');
    resetButton.hidden = !plan.read().locked;
    return;
  }

  saveButton.disabled = true;
  resetButton.disabled = true;
  showStatus('Consultando la misión en Supabase…');
  try {
    const { data, error } = await client.rpc('get_shared_mission');
    if (error) throw error;
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;

    const mission = Array.isArray(data) ? data[0] : data;
    if (mission) {
      plan.restore(mission);
      resetButton.hidden = false;
      showStatus(`Misión "${mission.name}" cargada desde Supabase.`);
    } else {
      if (plan.read().locked) plan.reset();
      resetButton.hidden = true;
      showStatus('Aún no hay una misión guardada. Completa los datos y guárdala en Supabase.');
    }
  } catch (error) {
    if (currentRequest !== request) return;
    showError(`No se pudo cargar la misión desde Supabase: ${error.message || 'error desconocido'}`);
  } finally {
    if (currentRequest === request) {
      saveButton.disabled = plan.read().locked;
      resetButton.disabled = false;
    }
  }
}

saveButton.addEventListener('click', async () => {
  if (saving || plan.read().locked) return;
  const state = plan.read();
  if (!state.name) {
    nameInput.setCustomValidity('Escribe el nombre de la misión.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    return;
  }
  if (!state.origin || !state.dest) {
    showError('Selecciona el punto de partida y el destino antes de guardar.');
    return;
  }
  for (const input of [travelInput, stayInput, startInput]) {
    if (!input.value || !input.checkValidity()) {
      input.setCustomValidity('Completa este dato antes de guardar.');
      input.reportValidity();
      input.setCustomValidity('');
      return;
    }
  }

  saving = true;
  saveButton.disabled = true;
  showStatus('Guardando la misión en Supabase…');
  try {
    const userId = getCurrentUser()?.id;
    const client = await supabaseReady;
    if (!client || !userId || userId !== getCurrentUser()?.id) {
      throw new Error('Inicia sesión para guardar la misión compartida.');
    }

    const startAt = `${state.startDate}T00:00:00.000Z`;
    const clockReal = new Date().toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    const { error } = await client.rpc('save_shared_mission', {
      p_name: state.name,
      p_origin: state.origin,
      p_dest: state.dest,
      p_transit_days: Number(state.transitDays),
      p_stay_days: Number(state.stayDays),
      p_stay_mode: state.preset === 'apollo' ? 'surface' : 'orbit',
      p_tz: timeZone,
      p_start_at: startAt,
      p_clock_real: clockReal,
      p_clock_mission: startAt,
      p_time_scale: 1,
    });
    if (error) throw error;

    plan.commit();
    resetButton.hidden = false;
    showStatus('Misión guardada en Supabase y compartida con las demás cuentas.');
  } catch (error) {
    showError(`No se pudo guardar la misión en Supabase: ${error.message || 'error desconocido'}`);
  } finally {
    saving = false;
    saveButton.disabled = plan.read().locked;
  }
});

resetButton.addEventListener('click', async () => {
  if (resetting) return;
  resetting = true;
  resetButton.disabled = true;
  saveButton.disabled = true;
  showStatus('Eliminando la misión compartida de Supabase…');
  try {
    const userId = getCurrentUser()?.id;
    const client = await supabaseReady;
    if (!client || !userId || userId !== getCurrentUser()?.id) {
      throw new Error('Inicia sesión para reiniciar la misión compartida.');
    }
    const { error } = await client.rpc('reset_shared_mission');
    if (error) throw error;
    plan.reset();
    resetButton.hidden = true;
    showStatus('Misión eliminada de Supabase. Puedes planear una nueva.');
  } catch (error) {
    showError(`No se pudo reiniciar la misión en Supabase: ${error.message || 'error desconocido'}`);
  } finally {
    resetting = false;
    resetButton.disabled = false;
    saveButton.disabled = plan.read().locked;
  }
});

document.addEventListener('sessionchange', () => void loadSharedMission());
void loadSharedMission();