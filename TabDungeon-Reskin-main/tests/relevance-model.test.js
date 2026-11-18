import assert from 'node:assert/strict';
import test from 'node:test';
import { predict, train } from '../core/relevance-model.js';

test('Naive Bayes model trains and predicts within the inference budget', () => {
  const model = train([
    { similarity: 0.8, dwell: 120, domain: 'wikipedia.org', label: 'related' },
    { similarity: 0.02, dwell: 20, domain: 'shop.example', label: 'unrelated' },
    { similarity: 0.15, dwell: 40, domain: 'example.org', label: 'uncertain' }
  ]);
  const result = predict({ similarity: 0.8, dwell: 120, domain: 'wikipedia.org' }, model);
  assert.equal(result.label, 'related');
  assert.ok(result.inferenceMs < 200);
  assert.equal(Object.keys(result.probabilities).length, 3);
});
