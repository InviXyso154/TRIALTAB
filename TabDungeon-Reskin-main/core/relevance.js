import { DEFAULTS } from './params.js';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for',
  'from', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this',
  'to', 'was', 'were', 'with', 'you', 'your', 'i', 'we', 'they', 'he', 'she',
  'ang', 'ng', 'sa', 'na', 'at', 'ay', 'mga', 'ito', 'iyon', 'para', 'kung',
  'ako', 'ikaw', 'ka', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'may', 'pag',
  'dahil', 'hindi', 'isang', 'mga'
]);

const fields = metadata => [
  metadata?.title,
  metadata?.description,
  metadata?.keywords,
  ...(Array.isArray(metadata?.headings) ? metadata.headings : [])
].filter(value => typeof value === 'string' && value.trim());

export function tokenize(text = '') {
  return String(text).toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 3 && !/^\d+$/.test(token) && !STOPWORDS.has(token))
    .map(token => {
      if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
      if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
      if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
      return token;
    })
    .filter(token => token.length >= 3);
}

export function pageText(metadata = {}) {
  const title = typeof metadata.title === 'string' ? metadata.title : '';
  return [title, title, ...fields({ ...metadata, title: undefined })].join(' ');
}

const normalize = vector => {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map(value => value / magnitude) : vector.map(() => 0);
};

const vectorForTokens = (tokens, vocabulary, idf) => {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return normalize(vocabulary.map((term, index) => (counts.get(term) || 0) * idf[index]));
};

export function buildDeckModel(cards = [], deckMeta = {}) {
  const cardList = Array.isArray(cards) ? cards : [];
  const documents = cardList.map(card => tokenize(`${card?.front || ''} ${card?.back || ''}`));
  const metaText = [deckMeta.description, deckMeta.keywords].filter(Boolean).join(' ');
  if (metaText) documents.push(tokenize(metaText));
  const termSet = new Set(documents.flat());
  const vocabulary = [...termSet].sort();
  const documentCount = Math.max(1, documents.length);
  const idf = vocabulary.map(term => {
    const df = documents.reduce((count, document) => count + (document.includes(term) ? 1 : 0), 0);
    return Math.log((documentCount + 1) / (df + 1)) + 1;
  });
  const cardVectors = documents.slice(0, cardList.length).map(tokens => vectorForTokens(tokens, vocabulary, idf));
  const allVectors = [...cardVectors];
  if (metaText) allVectors.push(vectorForTokens(documents[documents.length - 1], vocabulary, idf));
  const mean = vocabulary.map((_, index) => allVectors.length
    ? allVectors.reduce((sum, vector) => sum + vector[index], 0) / allVectors.length
    : 0);
  return {
    deckId: deckMeta.id || deckMeta.deckId || null,
    vocabulary,
    idf,
    vector: normalize(mean),
    cardVectors,
    cardIds: cardList.map(card => card.id || null)
  };
}

export function scoreRelevance(metadata, deckModel, params = DEFAULTS) {
  const pageTokens = tokenize(pageText(metadata));
  if (!deckModel || pageTokens.length < (params.MIN_PAGE_TOKENS ?? DEFAULTS.MIN_PAGE_TOKENS)) {
    return { score: 0, label: 'uncertain', matchedTerms: [] };
  }
  const vocabulary = Array.isArray(deckModel.vocabulary) ? deckModel.vocabulary : [];
  const idf = Array.isArray(deckModel.idf) ? deckModel.idf : [];
  const pageVector = vectorForTokens(pageTokens, vocabulary, idf);
  const deckVector = Array.isArray(deckModel.vector) ? deckModel.vector : [];
  const pageMagnitude = Math.sqrt(pageVector.reduce((sum, value) => sum + value * value, 0));
  const deckMagnitude = Math.sqrt(deckVector.reduce((sum, value) => sum + value * value, 0));
  const rawScore = pageMagnitude && deckMagnitude
    ? pageVector.reduce((sum, value, index) => sum + value * (deckVector[index] || 0), 0) / (pageMagnitude * deckMagnitude)
    : 0;
  const score = Math.max(0, Math.min(1, Number.isFinite(rawScore) ? rawScore : 0));
  const overlaps = vocabulary.map((term, index) => ({
    term,
    weight: pageVector[index] * (deckVector[index] || 0)
  })).filter(item => item.weight > 0).sort((a, b) => b.weight - a.weight);
  const hi = params.T_HI ?? DEFAULTS.T_HI;
  const lo = params.T_LO ?? DEFAULTS.T_LO;
  return {
    score,
    label: score >= hi ? 'related' : score <= lo ? 'unrelated' : 'uncertain',
    matchedTerms: overlaps.slice(0, 5).map(item => item.term)
  };
}

export function classifyAgainstDecks(metadata, deckModels = []) {
  if (!Array.isArray(deckModels) || deckModels.length === 0) return null;
  return deckModels.map(model => ({
    deckId: model.deckId,
    ...scoreRelevance(metadata, model)
  })).sort((a, b) => b.score - a.score)[0];
}

export function scoreCardLevel(metadata, deckModel) {
  const pageTokens = tokenize(pageText(metadata));
  if (!deckModel?.cardVectors?.length || pageTokens.length < DEFAULTS.MIN_PAGE_TOKENS) return [];
  const pageVector = vectorForTokens(pageTokens, deckModel.vocabulary, deckModel.idf);
  return deckModel.cardVectors.map((vector, index) => ({
    cardId: deckModel.cardIds[index],
    score: Math.max(0, Math.min(1, pageVector.reduce((sum, value, i) => sum + value * (vector[i] || 0), 0)))
  })).sort((a, b) => b.score - a.score).slice(0, 3);
}

export function isScorableUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const value = url.toLowerCase();
  return !value.startsWith('chrome://') && !value.startsWith('chrome-extension://') &&
    !value.startsWith('about:') && !value.startsWith('file://') &&
    !/^https?:\/\/newtab(?:\.|\/|$)/.test(value);
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return '';
  }
}
