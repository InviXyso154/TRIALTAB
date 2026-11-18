import { createRuntime } from './runtime.js';
import { createStatsView } from './stats.js';
import { setupChat } from './chat.js';
import { setupCards } from './flashcards.js';
import { setupSettings } from './settings.js';
import { createGameController } from '../game/controller.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const panels = [...document.querySelectorAll('.panel')];
  const links = [...document.querySelectorAll('.footer-nav-link')];
  const runtime = createRuntime();
  const stats = createStatsView($, runtime);
  const gameController = createGameController($);
  const settings = setupSettings($, runtime, gameController);
  const cards = setupCards($, runtime, gameController);

  function switchPanel(id) {
    panels.forEach(panel => {
      panel.hidden = panel.id !== id;
      panel.classList.toggle('active', panel.id === id);
    });
    links.forEach(link => link.classList.toggle('active', link.dataset.panel === id));
    if (id === 'guide-panel') $('chat-input').focus();
    if (id === 'settings-panel') settings.load();
    if (id === 'cards-panel') cards.load();
  }

  links.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    switchPanel(link.dataset.panel);
  }));

  setupChat($, runtime, settings.isDeveloperMode);
  if (runtime.onMessage) {
    runtime.onMessage.addListener(message => {
      if (message.action === 'tabsChanged') stats.update();
    });
  } else {
    $('status-message').textContent = 'Status: extension preview mode';
  }

  stats.update();
  gameController.load().catch(error => console.error('Game state failed to load:', error));
  cards.load();
  settings.load();
  setInterval(stats.update, 60000);
});
