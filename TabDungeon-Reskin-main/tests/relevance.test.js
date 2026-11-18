import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDeckModel,
  classifyAgainstDecks,
  isScorableUrl,
  normalizeUrl,
  scoreRelevance,
  tokenize
} from '../core/relevance.js';

const dataDeck = buildDeckModel([
  { id: 'tree', front: 'Binary tree traversal', back: 'Nodes, edges, recursion, depth first search' },
  { id: 'graph', front: 'Graph algorithms', back: 'Vertices, edges, breadth first search' }
], { id: 'data', keywords: 'data structures algorithms computer science' });

test('tokenizer removes stopwords, short words, and numbers', () => {
  assert.deepEqual(tokenize('Ang a tree and 123 in algorithms'), ['tree', 'algorithm']);
});

test('binary-tree page is related to data structures', () => {
  const result = scoreRelevance({
    title: 'Binary tree traversal',
    description: 'Learn data structures with nodes, edges, and depth first search.',
    headings: ['Algorithms']
  }, dataDeck);
  assert.equal(result.label, 'related');
  assert.ok(result.score >= 0.25 && result.score <= 1);
  assert.ok(result.matchedTerms.includes('tree'));
});

test('music and shopping pages are not related', () => {
  for (const metadata of [
    { title: 'Official music video', description: 'Listen to this new song and playlist.' },
    { title: 'Shop shoes online', description: 'Best price, cart, shipping and deals.' }
  ]) {
    assert.notEqual(scoreRelevance(metadata, dataDeck).label, 'related');
  }
});

test('empty metadata is uncertain with zero score', () => {
  assert.deepEqual(scoreRelevance({}, dataDeck), { score: 0, label: 'uncertain', matchedTerms: [] });
});

test('empty, one-card, and two-card decks are finite', () => {
  for (const cards of [[], [{ front: 'trees', back: 'nodes' }], [
    { front: 'trees', back: 'nodes' }, { front: 'graphs', back: 'edges' }
  ]]) {
    const model = buildDeckModel(cards);
    const result = scoreRelevance({ title: 'Trees and nodes' }, model);
    assert.ok(Number.isFinite(result.score));
    assert.ok(result.score >= 0 && result.score <= 1);
  }
});

test('classification is deterministic and selects the best deck', () => {
  const result = classifyAgainstDecks({ title: 'Binary tree nodes and traversal' }, [
    dataDeck,
    buildDeckModel([{ front: 'Philippine history', back: 'Revolution and independence' }], { id: 'history' })
  ]);
  assert.equal(result.deckId, 'data');
  assert.deepEqual(result, classifyAgainstDecks({ title: 'Binary tree nodes and traversal' }, [
    dataDeck,
    buildDeckModel([{ front: 'Philippine history', back: 'Revolution and independence' }], { id: 'history' })
  ]));
});

test('URL eligibility and normalization', () => {
  assert.equal(isScorableUrl('chrome://settings'), false);
  assert.equal(isScorableUrl('chrome-extension://abc/sidepanel.html'), false);
  assert.equal(isScorableUrl('about:blank'), false);
  assert.equal(isScorableUrl('file:///tmp/a.html'), false);
  assert.equal(isScorableUrl('https://example.com/a'), true);
  assert.equal(normalizeUrl('https://Example.com/a/?utm_source=x&x=1#part'), 'https://example.com/a/?x=1');
});
