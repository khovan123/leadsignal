const statusEl = document.querySelector('#status');
const pairedEl = document.querySelector('#paired');
const workspaceEl = document.querySelector('#workspace');
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
      : 'Pair the extension with LeadSignal';
    setMessage(
      state.paired
        ? 'Reddit collection is handled by the backend worker.'
        : 'Pair this extension before using LeadSignal.',
      state.paired ? 'success' : '',
    );
  } catch (error) {
    statusEl.textContent = 'Unable to read extension state';
    setMessage(error.message || String(error), 'error');
  }
}

optionsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
window.addEventListener('focus', () => void loadState());
void loadState();
