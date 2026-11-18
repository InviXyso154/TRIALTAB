const LABELS = ['related', 'unrelated', 'uncertain'];
const bin = (value, edges) => {
  const numeric = Number(value) || 0;
  return String(edges.findIndex(edge => numeric < edge) < 0 ? edges.length : edges.findIndex(edge => numeric < edge));
};

export function train(rows = []) {
  const started = performance.now();
  const counts = Object.fromEntries(LABELS.map(label => [label, { total: 0, similarity: {}, dwell: {}, domain: {} }]));
  for (const row of rows) {
    if (!counts[row.label]) continue;
    const group = counts[row.label];
    group.total += 1;
    for (const [feature, value] of [['similarity', bin(row.similarity, [0.08, 0.25, 0.5, 0.75])], ['dwell', bin(row.dwell, [30, 120, 600])], ['domain', String(row.domain || '').toLowerCase()]]) {
      group[feature][value] = (group[feature][value] || 0) + 1;
    }
  }
  return { labels: LABELS, counts, total: rows.length, trainingMs: performance.now() - started };
}

export function predict(features, model) {
  const started = performance.now();
  const total = Math.max(1, model?.total || 0);
  const probabilities = {};
  for (const label of LABELS) {
    const group = model?.counts?.[label] || { total: 0, similarity: {}, dwell: {}, domain: {} };
    const prior = (group.total + 1) / (total + LABELS.length);
    const values = [
      ['similarity', bin(features.similarity, [0.08, 0.25, 0.5, 0.75])],
      ['dwell', bin(features.dwell, [30, 120, 600])],
      ['domain', String(features.domain || '').toLowerCase()]
    ];
    let probability = prior;
    for (const [feature, value] of values) {
      const vocabularySize = feature === 'domain'
        ? Math.max(1, Object.keys(model?.counts || {}).length)
        : feature === 'similarity' ? 5 : 4;
      probability *= ((group[feature]?.[value] || 0) + 1) / (group.total + vocabularySize);
    }
    probabilities[label] = probability;
  }
  const normalizer = Object.values(probabilities).reduce((sum, value) => sum + value, 0) || 1;
  for (const label of LABELS) probabilities[label] /= normalizer;
  const label = LABELS.reduce((best, candidate) => probabilities[candidate] > probabilities[best] ? candidate : best, LABELS[0]);
  return { label, probabilities, inferenceMs: performance.now() - started };
}
