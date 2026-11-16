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
  if (dateInput.dataset.missionLocked === 'true') return;
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
    feedback('Sign in to sync with Supabase; the browser’s local date is being used.');
    return;
  }
  feedback('Loading start date…');
  try {
    const client = await supabaseReady;
    let data = null;
    if (client) {
      if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
      data = await fetchMissionStartViaFallback(client, userId).catch(() => null);
    }
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    if (dateInput.dataset.missionLocked === 'true') return;
    if (data !== null) {
      const timestamp = Date.parse(data);
      if (!Number.isFinite(timestamp)) throw new Error('Supabase returned an invalid mission date.');
      dateInput.value = new Date(timestamp).toISOString().slice(0,10);
      writeSavedMissionStart(dateInput.value);
    } else {
      const saved = readSavedMissionStart() ?? todayISO();
      dateInput.value = saved;
      writeSavedMissionStart(dateInput.value);
    }
    dateInput.disabled = false;
    saveButton.disabled = false;
    feedback(data ? 'Date loaded. You can change and save it.' : 'No saved date; today is being used as the default start date.');
  } catch (error) {
    const fallbackDate = readSavedMissionStart() ?? todayISO();
    dateInput.value = fallbackDate;
    writeSavedMissionStart(fallbackDate);
    dateInput.disabled = false;
    saveButton.disabled = false;
    if (currentRequest === request) feedback('Could not sync with Supabase; the browser’s local date is being used.', false);
  }
}

dateInput.addEventListener('input',() => {
  if (!dateInput.disabled) feedback('Unsaved changes.');
});

saveButton.addEventListener('click',async () => {
  const userId = getCurrentUser()?.id;
  if (!userId || saving) return;
  const currentRequest = ++request;
  saving = true;
  dateInput.disabled = true;
  saveButton.disabled = true;
  feedback('Saving start date…');
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
          feedback(missionStartAt ? 'Start date saved.' : 'Start date removed.');
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
          throw new Error('Could not save the mission start date to the profile.');
        }
      } catch (error) {
        if (currentRequest === request) feedback('Saved locally; the database has not synced yet.', false);
        return;
      }
    }
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;
    feedback(missionStartAt ? 'Start date saved.' : 'Start date removed.');
  } catch (error) {
    if (currentRequest === request) feedback('Saved locally in the browser; the database has not responded yet.', false);
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
