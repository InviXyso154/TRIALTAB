import { GAME_PARAMS } from './game-params.js';

const DAY_MS = 86400000;
const TIER_ORDER = ['t1', 't2', 't3', 'boss'];

function copyState(gameState) {
  const state = gameState || {};
  return {
    ...state,
    xp: Number.isFinite(state.xp) ? state.xp : 0,
    streak: {
      current: state.streak?.current || 0,
      best: state.streak?.best || 0,
      lastReviewDay: state.streak?.lastReviewDay || null,
      lastGraceDay: state.streak?.lastGraceDay || null
    },
    daily: {
      day: state.daily?.day || null,
      count: state.daily?.count || 0,
      target: state.daily?.target || GAME_PARAMS.STREAK_MIN_REVIEWS,
      completed: state.daily?.completed === true
    },
    floorCleared: { ...(state.floorCleared || {}) },
    stats: {
      cardsDefeated: state.stats?.cardsDefeated || 0,
      bossesDefeated: state.stats?.bossesDefeated || 0,
      bestStreak: state.stats?.bestStreak || 0
    }
  };
}

function localDayKey(now) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayNumber(day) {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS);
}

export function getMonsterTier(card = {}) {
  const easeFactor = Number.isFinite(card.easeFactor) ? card.easeFactor : 2.5;
  const lapses = card.lapses || 0;
  if (lapses >= 3) return 'boss';
  if (easeFactor < 2.1 || lapses >= 2) return 't3';
  if (easeFactor < 2.5 || lapses === 1) return 't2';
  return 't1';
}

export function xpForReview(tier, quality) {
  if (Number(quality) < 3) return GAME_PARAMS.ESCAPED_XP;
  return GAME_PARAMS.XP_BY_TIER[TIER_ORDER.includes(tier) ? tier : 't1'];
}

export function levelFromXp(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}

export function xpToNextLevel(xp) {
  const level = levelFromXp(xp);
  return level * level * 50 - Math.max(0, xp);
}

export function updateStreak(gameState, now) {
  const state = copyState(gameState);
  if (!state.daily.completed) return state;

  const today = localDayKey(now);
  const streak = state.streak;
  if (streak.lastReviewDay === today) return state;

  let current = 1;
  if (streak.lastReviewDay) {
    const gap = dayNumber(today) - dayNumber(streak.lastReviewDay);
    if (gap === 1) {
      current = streak.current + 1;
    } else if (
      gap === 2 &&
      (!streak.lastGraceDay || dayNumber(today) - dayNumber(streak.lastGraceDay) >= 7)
    ) {
      current = streak.current + 1;
      streak.lastGraceDay = today;
    }
  }
  streak.current = current;
  streak.best = Math.max(streak.best, current);
  streak.lastReviewDay = today;
  state.stats.bestStreak = Math.max(state.stats.bestStreak, current);
  return state;
}

export function getUnlocks(level) {
  return GAME_PARAMS.UNLOCKS.filter(unlock => unlock.level <= level).map(unlock => ({ ...unlock }));
}

export function applyReview(gameState, event, now) {
  const state = copyState(gameState);
  const previousLevel = levelFromXp(state.xp);
  const tier = event.tier || getMonsterTier(event.card);
  const quality = Number(event.quality);
  const day = localDayKey(now);

  if (state.daily.day !== day) {
    state.daily = {
      day,
      count: 0,
      target: GAME_PARAMS.STREAK_MIN_REVIEWS,
      completed: false
    };
  }
  if (Number.isFinite(event.dailyDueCount) && event.dailyDueCount > 0) {
    state.daily.target = Math.min(GAME_PARAMS.STREAK_MIN_REVIEWS, event.dailyDueCount);
  }
  state.daily.count += 1;
  state.daily.completed = state.daily.count >= state.daily.target;

  const earnedXp = xpForReview(tier, quality);
  const effects = [];
  if (quality >= 3) {
    state.xp += earnedXp;
    state.stats.cardsDefeated += 1;
    if (tier === 'boss') state.stats.bossesDefeated += 1;
    effects.push({ type: 'defeated', tier, xp: earnedXp });
  } else {
    state.xp += earnedXp;
    effects.push({ type: 'escaped', tier, xp: earnedXp });
  }

  const exposureCredit = event.exposureCredit ?? event.card?.exposureCredit ?? 0;
  if (exposureCredit > 0) effects.push({ type: 'weakened', weakened: true });

  if (event.dueRemainingInDeck === 0 && state.floorCleared[event.deckId] !== day) {
    state.floorCleared[event.deckId] = day;
    state.lastFloorCleared = { deckId: event.deckId, day };
    state.xp += GAME_PARAMS.FLOOR_CLEARED_XP;
    effects.push({ type: 'floorCleared', deckId: event.deckId, xp: GAME_PARAMS.FLOOR_CLEARED_XP });
  }

  const streakBefore = state.streak.current;
  const streakState = updateStreak(state, now);
  state.streak = streakState.streak;
  state.stats = streakState.stats;
  if (state.streak.current > streakBefore) {
    effects.push({ type: 'streakExtended', streak: state.streak.current });
  }

  const level = levelFromXp(state.xp);
  if (level > previousLevel) effects.push({ type: 'levelUp', level, unlocks: getUnlocks(level) });
  return { state, effects };
}
