// Provisional values. Tune these through simulation and labeled evaluation data.
export const PARAMS = Object.freeze({
  MIN_DWELL: 30,
  T_FULL: 120,
  LAMBDA: 0.5,
  T_HI: 0.18,
  T_LO: 0.06,
  CREDIT_CAP: 1,
  GAMMA: 0.2,
  MAX_MULT: 1.25,
  MIN_MULT: 0.8,
  E0: 0.25,
  K_REVIEWS: 3,
  CARD_LEVEL_MATCHING: false
});

// Provisional relevance-classifier thresholds; tune with labeled evaluation data.
export const DEFAULTS = Object.freeze({
  T_HI: 0.25,
  T_LO: 0.08,
  MIN_PAGE_TOKENS: 3,
  MIN_DWELL: 30
});

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
