export const GAME_STORAGE_KEY = 'gameState';
export const GAME_STATE_VERSION = 1;

export function createDefaultGameState() {
  return {
    version: GAME_STATE_VERSION,
    xp: 0,
    streak: {
      current: 0,
      best: 0,
      lastReviewDay: null,
      lastGraceDay: null
    },
    daily: {
      day: null,
      count: 0,
      target: 3,
      completed: false
    },
    floorCleared: {},
    lastFloorCleared: null,
    stats: {
      cardsDefeated: 0,
      bossesDefeated: 0,
      bestStreak: 0
    }
  };
}

function normalizeGameState(value) {
  const defaults = createDefaultGameState();
  const state = value && typeof value === 'object' ? value : {};
  return {
    ...defaults,
    ...state,
    version: GAME_STATE_VERSION,
    streak: { ...defaults.streak, ...(state.streak || {}) },
    daily: { ...defaults.daily, ...(state.daily || {}) },
    floorCleared: { ...defaults.floorCleared, ...(state.floorCleared || {}) },
    stats: { ...defaults.stats, ...(state.stats || {}) }
  };
}

export function createGameStorage(storage = globalThis.chrome?.storage?.local) {
  return {
    async load() {
      if (!storage) return createDefaultGameState();
      const result = await storage.get(GAME_STORAGE_KEY);
      return normalizeGameState(result?.[GAME_STORAGE_KEY]);
    },
    async save(gameState) {
      if (!storage) return;
      await storage.set({ [GAME_STORAGE_KEY]: normalizeGameState(gameState) });
    }
  };
}

export async function loadGameState(storage) {
  return createGameStorage(storage).load();
}

export async function saveGameState(gameState, storage) {
  return createGameStorage(storage).save(gameState);
}
