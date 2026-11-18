import { applyReview, levelFromXp, xpToNextLevel } from './game-rules.js';
import { loadGameState, saveGameState } from './game-state.js';
import { renderArena } from './arena.js';

export function createGameController($) {
  let gameState;
  let arena;
  let effectsEnabled = true;
  let reduceMotion = false;
  let ambientEnabled = true;

  function renderHeader() {
    if (!gameState) return;
    const level = levelFromXp(gameState.xp);
    const nextLevelXp = level * level * 50;
    const previousLevelXp = (level - 1) * (level - 1) * 50;
    const progress = nextLevelXp === previousLevelXp
      ? 0
      : ((gameState.xp - previousLevelXp) / (nextLevelXp - previousLevelXp)) * 100;
    $('game-level').textContent = `Level ${level}`;
    $('game-xp').textContent = `${gameState.xp} XP · ${xpToNextLevel(gameState.xp)} to next`;
    $('game-xp-bar').style.width = `${Math.max(0, Math.min(100, progress))}%`;
    $('game-streak').textContent = `Streak ${gameState.streak.current}`;
    $('adventure-defeated').textContent = `Cards defeated: ${gameState.stats.cardsDefeated}`;
    $('adventure-bosses').textContent = `Bosses defeated: ${gameState.stats.bossesDefeated}`;
    $('adventure-best-streak').textContent = `Best streak: ${gameState.stats.bestStreak}`;
  }

  function renderVisibility() {
    const header = $('game-header-strip');
    const arena = $('review-arena');
    const log = $('adventure-log');
    if (header) header.hidden = !effectsEnabled;
    if (arena) arena.hidden = !effectsEnabled;
    if (log) log.hidden = !effectsEnabled;
  }

  function renderContext(card, deck) {
    if (!gameState) return;
    arena?.hero.destroy();
    arena?.monster?.destroy();
    arena = renderArena($('review-arena'), {
      card,
      deck,
      gameState,
      effectsEnabled,
      reduceMotion,
      ambientEnabled
    });
  }

  return {
    async load() {
      gameState = await loadGameState();
      renderHeader();
    },
    setOptions(options = {}) {
      if (typeof options.effectsEnabled === 'boolean') effectsEnabled = options.effectsEnabled;
      if (typeof options.reduceMotion === 'boolean') reduceMotion = options.reduceMotion;
      if (typeof options.ambientEnabled === 'boolean') ambientEnabled = options.ambientEnabled;
      renderVisibility();
      arena?.setAmbientEnabled?.(ambientEnabled);
    },
    showReview(card, deck) {
      renderContext(card, deck);
    },
    queueReview(card, deck) {
      if (arena?.setNextCard) arena.setNextCard(card, deck);
      else renderContext(card, deck);
    },
    showEmpty() {
      renderContext(null, null);
    },
    async onReview(event) {
      if (!gameState) await this.load();
      const result = applyReview(gameState, event, event.now);
      gameState = result.state;
      await saveGameState(gameState);
      renderHeader();
      if (!arena) renderContext(event.card, event.deck);
      const effects = event.deckFinished
        ? [...result.effects, { type: 'deckFinished' }]
        : result.effects;
      arena.playEffects(effects, event);
    }
  };
}
