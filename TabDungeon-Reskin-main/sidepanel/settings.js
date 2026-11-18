export function setupSettings($, runtime, gameController) {
  const storage = globalThis.chrome?.storage?.local;
  let scale = 100;
  let devMode = false;

  const save = values => storage?.set(values);
  const setDeveloperVisibility = visible => {
    devMode = visible === true;
    $('developer-tools').hidden = !devMode;
    $('developer-output').hidden = !devMode;
  };

  setDeveloperVisibility(false);

  function load() {
    storage?.get(['guiScale', 'aiEnabled', 'apiKey', 'devMode'], result => {
      scale = result.guiScale || 100;
      $('scale-value').textContent = `${scale}%`;
      $('ai-toggle').checked = result.aiEnabled !== false;
      $('game-effects').checked = result.gameEffects !== false;
      $('reduce-motion').checked = result.reduceMotion === true;
      gameController?.setOptions({
        effectsEnabled: $('game-effects').checked,
        reduceMotion: $('reduce-motion').checked
      });
      $('api-key').value = result.apiKey || '';
      $('developer-mode').checked = result.devMode === true;
      setDeveloperVisibility($('developer-mode').checked);
      document.querySelector('.sidepanel').style.fontSize = `${scale}%`;
    });
  }

  function changeScale(amount) {
    scale = Math.max(60, Math.min(140, scale + amount));
    $('scale-value').textContent = `${scale}%`;
    document.querySelector('.sidepanel').style.fontSize = `${scale}%`;
    save({ guiScale: scale });
  }
  $('scale-dec').addEventListener('click', () => changeScale(-10));
  $('scale-inc').addEventListener('click', () => changeScale(10));
  $('ai-toggle').addEventListener('change', event => save({ aiEnabled: event.target.checked }));
  $('game-effects').addEventListener('change', event => {
    gameController?.setOptions({ effectsEnabled: event.target.checked });
    save({ gameEffects: event.target.checked });
  });
  $('reduce-motion').addEventListener('change', event => {
    gameController?.setOptions({ reduceMotion: event.target.checked });
    save({ reduceMotion: event.target.checked });
  });
  $('save-key').addEventListener('click', () => {
    const key = $('api-key').value.trim();
    save({ apiKey: key });
    $('key-status').textContent = key ? 'API key saved.' : 'Enter an API key first.';
  });
  $('test-key').addEventListener('click', () => {
    $('key-status').textContent = 'Testing…';
    runtime.send({ action: 'testApiKey', apiKey: $('api-key').value.trim() }, response => {
      $('key-status').textContent = response?.success ? 'API key is valid.' : (response?.error || 'Test failed.');
    });
  });
  $('developer-mode').addEventListener('change', event => {
    setDeveloperVisibility(event.target.checked);
    save({ devMode });
  });
  $('open-simulation').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('simulation/simulation.html') });
  });

  return { load, isDeveloperMode: () => devMode };
}
