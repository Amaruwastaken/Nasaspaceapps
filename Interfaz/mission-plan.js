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

function showSignInPrompt(message) {
  const link = document.createElement('a');
  link.href = 'login.html';
  link.textContent = 'Sign in';
  hint.replaceChildren(document.createTextNode(`${message} `), link);
  hint.classList.remove('is-error');
}

function hasMission() {
  const state = plan.read();
  return Boolean(state.name || state.origin || state.dest);
}

async function loadSharedMission() {
  const currentRequest = ++request;
  const client = await supabaseReady;
  const userId = getCurrentUser()?.id;
  if (!client) {
    showError('Could not connect to Supabase. Check the configuration and try again.');
    resetButton.hidden = !hasMission();
    return;
  }
  if (!userId) {
    showSignInPrompt('Sign in to load or save the shared mission in Supabase.');
    resetButton.hidden = !hasMission();
    return;
  }

  saveButton.disabled = true;
  resetButton.disabled = true;
  showStatus('Loading the shared mission from Supabase…');
  try {
    const { data, error } = await client.rpc('get_shared_mission');
    if (error) throw error;
    if (currentRequest !== request || userId !== getCurrentUser()?.id) return;

    const mission = Array.isArray(data) ? data[0] : data;
    if (mission) {
      plan.restore(mission);
      resetButton.hidden = false;
      showStatus(`Mission "${mission.name}" loaded from Supabase.`);
    } else {
      if (plan.read().locked) plan.reset();
      resetButton.hidden = !hasMission();
      showStatus('No mission has been saved yet. Complete the details and save it to Supabase.');
    }
  } catch (error) {
    if (currentRequest !== request) return;
    showError(`Could not load the mission from Supabase: ${error.message || 'unknown error'}`);
    resetButton.hidden = !hasMission();
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
    nameInput.setCustomValidity('Enter a mission name.');
    nameInput.reportValidity();
    nameInput.setCustomValidity('');
    return;
  }
  if (!state.origin || !state.dest) {
    showError('Select a departure point and destination before saving.');
    return;
  }
  for (const input of [travelInput, stayInput, startInput]) {
    if (!input.value || !input.checkValidity()) {
      input.setCustomValidity('Complete this field before saving.');
      input.reportValidity();
      input.setCustomValidity('');
      return;
    }
  }

  saving = true;
  saveButton.disabled = true;
  showStatus('Saving the mission to Supabase…');
  try {
    const client = await supabaseReady;
    if (!client) throw new Error('Could not connect to Supabase. Check the configuration and try again.');
    const userId = getCurrentUser()?.id;
    if (!userId) {
      showSignInPrompt('Sign in to save the shared mission.');
      return;
    }
    if (userId !== getCurrentUser()?.id) throw new Error('Your session changed. Try saving the mission again.');

    const startAt = `${state.startDate}T00:00:00.000Z`;
    const clockReal = new Date().toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago';
    const { data, error } = await client.rpc('save_shared_mission', {
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
    if (data !== 'Farmacias Similunares') throw new Error('Supabase did not confirm that the mission was saved.');

    plan.commit();
    resetButton.hidden = false;
    showStatus('Mission saved to Supabase and shared with all accounts.');
  } catch (error) {
    showError(`Could not save the mission to Supabase: ${error.message || 'unknown error'}`);
  } finally {
    saving = false;
    saveButton.disabled = plan.read().locked;
  }
});

resetButton.addEventListener('click', async () => {
  if (resetting) return;
  if (!plan.read().locked) {
    plan.reset();
    showStatus('Mission reset in this browser. Save it to Supabase to share it.');
    return;
  }
  resetting = true;
  resetButton.disabled = true;
  saveButton.disabled = true;
  showStatus('Removing the shared mission from Supabase…');
  try {
    const client = await supabaseReady;
    const userId = getCurrentUser()?.id;
    if (!userId) {
      plan.reset();
      showStatus('Local mission cleared. Sign in to remove the shared mission from Supabase.');
      return;
    }
    if (!client) throw new Error('Could not connect to Supabase. Check the configuration and try again.');
    if (userId !== getCurrentUser()?.id) throw new Error('Your session changed. Try resetting the mission again.');
    const { error } = await client.rpc('reset_shared_mission');
    if (error) throw error;
    plan.reset();
    resetButton.hidden = true;
    showStatus('Mission removed from Supabase. You can plan a new one.');
  } catch (error) {
    showError(`Could not reset the mission in Supabase: ${error.message || 'unknown error'}`);
  } finally {
    resetting = false;
    resetButton.disabled = false;
    saveButton.disabled = plan.read().locked;
  }
});

document.addEventListener('sessionchange', () => void loadSharedMission());
void loadSharedMission();