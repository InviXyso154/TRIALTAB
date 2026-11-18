import assert from 'node:assert/strict';
import test from 'node:test';
import { loadStudyState } from '../state/study-state.js';

function createStorage(initialState) {
  const writes = [];
  return {
    writes,
    async get(key) {
      return { [key]: initialState };
    },
    async set(value) {
      writes.push(value);
    }
  };
}

test('loadStudyState migrates the original focus/web seed to the current default state', async () => {
  const storage = createStorage({
    decks: [{ id: 'web' }, { id: 'focus' }],
    cards: [
      { id: 'web-1', deckId: 'web' },
      { id: 'focus-2', deckId: 'focus' },
      { id: 'focus-1', deckId: 'focus' }
    ]
  });

  const state = await loadStudyState(storage);

  assert.deepEqual(
    state.decks.map(deck => deck.id),
    ['software-design-concepts', 'software-architecture', 'design-elements-analysis']
  );
  assert.ok(state.cards.length > 0);
  assert.ok(state.cards.every(card => card.easeFactor === 2.5 && card.exposureCredit === 0));
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(storage.writes[0].studyState, state);
});

test('loadStudyState preserves a non-original stored state', async () => {
  const storedState = {
    decks: [{ id: 'custom-deck' }],
    cards: [{ id: 'custom-card', deckId: 'custom-deck' }],
    history: []
  };
  const storage = createStorage(storedState);

  assert.equal(await loadStudyState(storage), storedState);
  assert.equal(storage.writes.length, 0);
});
