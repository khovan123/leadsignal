const form = document.getElementById('settings-form');
const apiBaseInput = document.getElementById('api-base');
const appOriginInput = document.getElementById('app-origin');
const resetButton = document.getElementById('reset-button');
const status = document.getElementById('status');

void loadSettings();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const config = lsNormalizeConfig({
    apiBase: apiBaseInput.value,
    appOrigin: appOriginInput.value,
  });
  void saveFromUserGesture(config, 'Settings saved. Reload the LeadSignal login page.');
});

resetButton.addEventListener('click', () => {
  const config = lsNormalizeConfig(LS_DEFAULT_CONFIG);
  void saveFromUserGesture(config, 'Local defaults restored. Reload the LeadSignal login page.');
});

async function saveFromUserGesture(config, successMessage) {
  setStatus('Saving…', 'working');
  try {
    await lsRequestHostPermissions(config);
    const saved = await lsSaveConfig(config);
    render(saved);
    setStatus(successMessage, 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function loadSettings() {
  try {
    render(await lsGetConfig());
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

function render(config) {
  apiBaseInput.value = config.apiBase;
  appOriginInput.value = config.appOrigin;
}

function setStatus(message, state) {
  status.textContent = message;
  status.dataset.state = state;
}
