const form = document.getElementById('settings-form');
const apiBaseInput = document.getElementById('api-base');
const appOriginInput = document.getElementById('app-origin');
const resetButton = document.getElementById('reset-button');
const status = document.getElementById('status');

void loadSettings();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus('Saving…', 'working');
  try {
    const config = await lsSaveConfig({
      apiBase: apiBaseInput.value,
      appOrigin: appOriginInput.value,
    });
    render(config);
    setStatus('Settings saved. Reload the LeadSignal login page.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});

resetButton.addEventListener('click', async () => {
  setStatus('Restoring local defaults…', 'working');
  try {
    const config = await lsSaveConfig(LS_DEFAULT_CONFIG);
    render(config);
    setStatus('Local defaults restored.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});

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
