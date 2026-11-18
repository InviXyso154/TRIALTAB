import assert from 'node:assert/strict';
import { calculateReview } from '../core/scheduler.js';

const now = Date.UTC(2026, 0, 1);
const base = {
  interval: 10,
  repetitions: 3,
  easeFactor: 2.5,
  dueAt: 0,
  exposureCredit: 0.5,
  lapses: 0
};

const normal = calculateReview(base, 4, { now, deck: {}, params: { GAMMA: 0.2, CREDIT_CAP: 1, MAX_MULT: 1.25 } });
assert.equal(normal.exposureCredit, 0);
assert.ok(normal.interval > base.interval);

const failed = calculateReview(base, 1, { now, deck: {}, params: {} });
assert.equal(failed.repetitions, 0);
assert.equal(failed.interval, 1);
assert.equal(failed.exposureCredit, 0);

const capped = calculateReview(base, 5, {
  now,
  deck: { examDate: now + 2 * 86400000 },
  params: { GAMMA: 0.2, CREDIT_CAP: 1, MAX_MULT: 1.25, K_REVIEWS: 3 }
});
assert.ok(capped.interval <= 1);
console.log('scheduler tests: OK');
