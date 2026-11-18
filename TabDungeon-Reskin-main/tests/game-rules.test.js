import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReview,
  getMonsterTier,
  getUnlocks,
  levelFromXp,
  updateStreak,
  xpForReview,
  xpToNextLevel
} from '../game/game-rules.js';

const baseState = () => ({
  version: 1,
  xp: 0,
  streak: { current: 0, best: 0, lastReviewDay: null, lastGraceDay: null },
  daily: { day: null, count: 0, target: 3, completed: false },
  floorCleared: {},
  stats: { cardsDefeated: 0, bossesDefeated: 0, bestStreak: 0 }
});

test('monster tiers follow ease and lapse boundaries', () => {
  assert.equal(getMonsterTier({ easeFactor: 2.5, lapses: 0 }), 't1');
  assert.equal(getMonsterTier({ easeFactor: 2.49, lapses: 0 }), 't2');
  assert.equal(getMonsterTier({ easeFactor: 2.1, lapses: 0 }), 't2');
  assert.equal(getMonsterTier({ easeFactor: 2.09, lapses: 0 }), 't3');
  assert.equal(getMonsterTier({ easeFactor: 2.5, lapses: 1 }), 't2');
  assert.equal(getMonsterTier({ easeFactor: 2.5, lapses: 2 }), 't3');
  assert.equal(getMonsterTier({ easeFactor: 2.5, lapses: 3 }), 'boss');
});

test('hard, good, and easy share defeated XP while again is effort XP', () => {
  assert.equal(xpForReview('t2', 3), 15);
  assert.equal(xpForReview('t2', 4), 15);
  assert.equal(xpForReview('t2', 5), 15);
  assert.equal(xpForReview('boss', 1), 3);
});

test('level and next-level XP boundaries are deterministic', () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(49), 1);
  assert.equal(levelFromXp(50), 2);
  assert.equal(levelFromXp(199), 2);
  assert.equal(levelFromXp(200), 3);
  assert.equal(xpToNextLevel(0), 50);
  assert.equal(xpToNextLevel(50), 150);
  assert.deepEqual(getUnlocks(3).map(unlock => unlock.id), ['default', 'scholar', 'library']);
});

test('streak counts consecutive completed local days and uses one grace day', () => {
  let state = baseState();
  state.daily = { day: '2026-11-10', count: 3, target: 3, completed: true };
  state.streak = { current: 1, best: 1, lastReviewDay: '2026-11-10', lastGraceDay: null };
  state = updateStreak(state, new Date(2026, 10, 11, 9).getTime());
  assert.equal(state.streak.current, 2);

  state.daily.completed = true;
  state = updateStreak(state, new Date(2026, 10, 13, 9).getTime());
  assert.equal(state.streak.current, 3);
  state.daily.completed = true;
  state = updateStreak(state, new Date(2026, 10, 16, 9).getTime());
  assert.equal(state.streak.current, 1);
});

test('streak uses local day boundaries and supports fewer due cards', () => {
  let state = baseState();
  const late = new Date(2026, 10, 10, 23, 59).getTime();
  const first = applyReview(state, {
    cardId: 'a', deckId: 'd', quality: 4, tier: 't1', dueRemainingInDeck: 1, dailyDueCount: 2
  }, late);
  assert.equal(first.state.daily.completed, false);
  const completed = applyReview(first.state, {
    cardId: 'b', deckId: 'd', quality: 4, tier: 't1', dueRemainingInDeck: 0, dailyDueCount: 2
  }, new Date(2026, 10, 10, 23, 59, 30).getTime());
  assert.equal(completed.state.streak.current, 1);
  const nextDay = applyReview(completed.state, {
    cardId: 'c', deckId: 'd', quality: 4, tier: 't1', dueRemainingInDeck: 0, dailyDueCount: 1
  }, new Date(2026, 10, 11, 0, 1).getTime());
  assert.equal(nextDay.state.streak.current, 2);
});

test('floor-cleared bonus is granted once per deck per local day', () => {
  const event = { cardId: 'a', deckId: 'deck-a', quality: 4, tier: 't1', dueRemainingInDeck: 0 };
  const first = applyReview(baseState(), event, new Date(2026, 10, 10, 10).getTime());
  const second = applyReview(first.state, event, new Date(2026, 10, 10, 12).getTime());
  assert.equal(first.effects.filter(effect => effect.type === 'floorCleared').length, 1);
  assert.equal(second.effects.filter(effect => effect.type === 'floorCleared').length, 0);
});

test('applyReview is pure and deterministic', () => {
  const state = baseState();
  const event = { cardId: 'a', deckId: 'd', quality: 4, tier: 'boss', dueRemainingInDeck: 0 };
  const input = JSON.parse(JSON.stringify(state));
  const first = applyReview(state, event, 1794300000000);
  const second = applyReview(state, event, 1794300000000);
  assert.deepEqual(state, input);
  assert.deepEqual(first, second);
});
