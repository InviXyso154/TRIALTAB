import fs from 'node:fs';
import { classifyPage } from '../classifier.js';
import { buildDeckModel, scoreRelevance } from '../core/relevance.js';
import { predict, train } from '../core/relevance-model.js';

const LABELS = ['related', 'unrelated', 'uncertain'];

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text[index];
    if (char === '"' && (quoted || text[index - 1] !== '\\')) quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || index === text.length) && !quoted) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else if (char !== undefined) cell += char;
  }
  const [header, ...data] = rows;
  return data.map(values => Object.fromEntries(header.map((key, index) => [key, values[index] || ''])));
}

function metrics(actual, predicted) {
  const matrix = Object.fromEntries(LABELS.map(label => [label, Object.fromEntries(LABELS.map(other => [other, 0]))]));
  actual.forEach((label, index) => { if (matrix[label]?.[predicted[index]] !== undefined) matrix[label][predicted[index]] += 1; });
  const perClass = Object.fromEntries(LABELS.map(label => {
    const tp = matrix[label][label];
    const fp = LABELS.reduce((sum, other) => sum + matrix[other][label], 0) - tp;
    const fn = LABELS.reduce((sum, other) => sum + matrix[label][other], 0) - tp;
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    return [label, { precision, recall, f1: 2 * precision * recall / (precision + recall || 1) }];
  }));
  return { matrix, perClass, macroF1: LABELS.reduce((sum, label) => sum + perClass[label].f1, 0) / LABELS.length };
}

export function cohensKappa(raterA, raterB) {
  const total = Math.min(raterA.length, raterB.length);
  if (!total) return 0;
  const agreement = raterA.slice(0, total).filter((value, index) => value === raterB[index]).length / total;
  const expected = LABELS.reduce((sum, label) =>
    sum + raterA.slice(0, total).filter(value => value === label).length / total *
    (raterB.slice(0, total).filter(value => value === label).length / total), 0);
  return (agreement - expected) / (1 - expected || 1);
}

export function fleissKappa(ratings) {
  if (!ratings.length || !ratings[0]?.length) return 0;
  const n = ratings[0].length;
  const categoryCounts = LABELS.map(label => ratings.reduce((sum, row) => sum + row.filter(value => value === label).length, 0));
  const p = ratings.map(row => row.reduce((sum, label) => sum + row.filter(value => value === label).length ** 2, 0) - n) / (n * (n - 1));
  const pBar = p.reduce((sum, value) => sum + value, 0) / p.length;
  const pExpected = categoryCounts.reduce((sum, count) => sum + (count / (p.length * n)) ** 2, 0);
  return (pBar - pExpected) / (1 - pExpected || 1);
}

function confusionReport(name, actual, predicted) {
  const report = metrics(actual, predicted);
  console.log(`\n${name}`);
  console.table(report.matrix);
  for (const label of LABELS) console.log(`${label}: precision ${report.perClass[label].precision.toFixed(3)}, recall ${report.perClass[label].recall.toFixed(3)}, F1 ${report.perClass[label].f1.toFixed(3)}`);
  console.log(`macro-F1: ${report.macroF1.toFixed(3)}`);
  return report;
}

function main(csvPath, decksPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const decks = JSON.parse(fs.readFileSync(decksPath, 'utf8'));
  const models = Object.fromEntries(Object.entries(decks).map(([id, deck]) => [id, buildDeckModel(deck.cards || [], { ...deck, id })]));
  const actual = rows.map(row => row.label);
  const baseline = rows.map(row => classifyPage(`https://${row.domain || 'example.invalid'}`, row)).map(label =>
    label === 'learning' ? 'related' : label === 'non-learning' ? 'unrelated' : 'uncertain');
  confusionReport('Old task-blind baseline', actual, baseline);

  let best = { f1: -1, hi: 0.25, lo: 0.08 };
  for (let hi = 0.1; hi <= 0.6; hi += 0.05) for (let lo = 0; lo < hi; lo += 0.02) {
    const predicted = rows.map(row => scoreRelevance(row, models[row.deckId], { T_HI: hi, T_LO: lo, MIN_PAGE_TOKENS: 3 }).label);
    const result = metrics(actual, predicted);
    if (result.macroF1 > best.f1) best = { f1: result.macroF1, hi, lo };
  }
  const tfidfPredicted = rows.map(row => scoreRelevance(row, models[row.deckId], { T_HI: best.hi, T_LO: best.lo, MIN_PAGE_TOKENS: 3 }).label);
  confusionReport(`Thresholded TF-IDF (grid T_HI=${best.hi.toFixed(2)}, T_LO=${best.lo.toFixed(2)})`, actual, tfidfPredicted);

  const features = rows.map((row, index) => ({
    similarity: scoreRelevance(row, models[row.deckId]).score,
    dwell: Number(row.dwell || 60),
    domain: row.domain,
    label: row.label,
    index
  }));
  const foldPredictions = Array(rows.length).fill('uncertain');
  for (let fold = 0; fold < 5; fold += 1) {
    const trainingRows = features.filter((_, index) => index % 5 !== fold);
    const model = train(trainingRows);
    features.filter((_, index) => index % 5 === fold).forEach(item => {
      foldPredictions[item.index] = predict(item, model).label;
    });
  }
  confusionReport('Naive Bayes (5-fold cross-validation)', actual, foldPredictions);

  const times = [];
  for (const row of rows) {
    const started = performance.now();
    scoreRelevance(row, models[row.deckId]);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  console.log(`Median TF-IDF inference time: ${times[Math.floor(times.length / 2)].toFixed(3)} ms`);
  const raters = Object.keys(rows[0] || {}).filter(key => /^label_r\d+$/.test(key));
  if (raters.length >= 2) {
    console.log(`Cohen's kappa: ${cohensKappa(rows.map(row => row[raters[0]]), rows.map(row => row[raters[1]])).toFixed(3)}`);
    if (raters.length >= 3) console.log(`Fleiss' kappa: ${fleissKappa(rows.map(row => raters.map(key => row[key]))).toFixed(3)}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('evaluate-classifier.js')) {
  main(process.argv[2] || new URL('./sample-pages.csv', import.meta.url), process.argv[3] || new URL('./sample-decks.json', import.meta.url));
}
