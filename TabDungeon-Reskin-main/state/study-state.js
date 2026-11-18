import { createMockStudyContent } from './seed-data.js';

export const STORAGE_KEY = 'studyState';

export function createCard(card) {
  return {
    ...card,
    interval: card.interval || 0,
    repetitions: card.repetitions || 0,
    easeFactor: card.easeFactor || 2.5,
    dueAt: card.dueAt || 0,
    exposureCredit: card.exposureCredit || 0,
    lapses: card.lapses || 0
  };
}

export function createDefaultState() {
  const content = createMockStudyContent();
  return { ...content, cards: content.cards.map(createCard) };
}

function isOriginalSeed(state) {
  const deckIds = (state.decks || []).map(deck => deck.id).sort().join(',');
  const cardIds = (state.cards || []).map(card => card.id).sort().join(',');
  return deckIds === 'focus,web' && cardIds === 'focus-1,focus-2,web-1';
}

export async function loadStudyState(storage = globalThis.chrome?.storage?.local) {
  if (!storage) return createDefaultState();

  const result = await storage.get(STORAGE_KEY);
  if (result[STORAGE_KEY]?.decks && result[STORAGE_KEY]?.cards) {
    if (isOriginalSeed(result[STORAGE_KEY])) {
      const state = createDefaultState();
      await saveStudyState(state, storage);
      return state;
    }
    return result[STORAGE_KEY];
  }

  const state = createDefaultState();
  await saveStudyState(state, storage);
  return state;
}

export function saveStudyState(state, storage = globalThis.chrome?.storage?.local) {
  return storage?.set({ [STORAGE_KEY]: state });
}
