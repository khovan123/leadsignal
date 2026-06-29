const statusEl = document.querySelector('#status');
const pairedEl = document.querySelector('#paired');
const workspaceEl = document.querySelector('#workspace');
const captureButton = document.querySelector('#capture');
const optionsButton = document.querySelector('#options');
const messageEl = document.querySelector('#message');

function setMessage(text, type = '') {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

async function sendMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || 'Extension request failed');
  return response;
}

async function loadState() {
  try {
    const response = await sendMessage({ type: 'GET_STATE' });
    const state = response.state || {};
    pairedEl.textContent = state.paired ? 'Yes' : 'No';
    workspaceEl.textContent = state.workspaceId || 'Not paired';
    statusEl.textContent = state.paired
      ? `Ready · v${state.version || chrome.runtime.getManifest().version}`
      : 'Pair the extension before capturing';
    captureButton.disabled = !state.paired;
    if (state.paired) setMessage('Extension paired successfully.', 'success');
  } catch (error) {
    statusEl.textContent = 'Unable to read extension state';
    captureButton.disabled = true;
    setMessage(error.message || String(error), 'error');
  }
}

captureButton.addEventListener('click', async () => {
  captureButton.disabled = true;
  setMessage('Capturing rendered Reddit posts…');
  try {
    const response = await sendMessage({ type: 'CAPTURE_CURRENT_PAGE' });
    setMessage(`Captured ${response.collected} post(s).`, 'success');
  } catch (error) {
    setMessage(error.message || String(error), 'error');
  } finally {
    await loadState();
  }
});

optionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[LS_KEYS.deviceId] || changes[LS_KEYS.workspaceId]) {
    void loadState();
  }
});

window.addEventListener('focus', () => void loadState());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void loadState();
});

void loadState();
