// Provisional values for the effort-based game layer.
export const GAME_PARAMS = Object.freeze({
  STREAK_MIN_REVIEWS: 3,
  FLOOR_CLEARED_XP: 25,
  ESCAPED_XP: 3,
  XP_BY_TIER: Object.freeze({
    t1: 10,
    t2: 15,
    t3: 20,
    boss: 40
  }),
  UNLOCKS: Object.freeze([
    Object.freeze({ level: 1, type: 'hero-skin', id: 'default' }),
    Object.freeze({ level: 2, type: 'hero-skin', id: 'scholar' }),
    Object.freeze({ level: 3, type: 'background', id: 'library' }),
    Object.freeze({ level: 5, type: 'hero-skin', id: 'knight' }),
    Object.freeze({ level: 7, type: 'background', id: 'observatory' })
  ])
});
