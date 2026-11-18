import { buildDeckModel, isScorableUrl, scoreRelevance } from '../core/relevance.js';
import { PARAMS } from '../core/params.js';
import { loadStudyState } from '../state/study-state.js';

const MOCK_VISITS = [
  {
    title: 'JavaScript tutorial for beginners',
    url: 'https://example.com/tutorial',
    description: 'Learn programming with a practical coding lesson.',
    headings: ['Variables and functions'],
    dwell: 120,
    source: 'mock'
  },
  {
    title: 'Funny videos compilation',
    url: 'https://example.com/funny',
    description: 'A collection of entertainment clips.',
    headings: [],
    dwell: 180,
    source: 'mock'
  },
  {
    title: 'Background research tab',
    url: 'https://example.com/research',
    description: 'Research notes for the upcoming exam.',
    headings: ['Study guide'],
    dwell: 10,
    source: 'mock'
  }
];

const state = { decks: [], visits: [...MOCK_VISITS] };
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function renderVisits() {
  $('visit-list').innerHTML = state.visits.map(visit =>
    `<div class="visit-row"><span>${escapeHtml(visit.title)} <small>(${visit.source})</small></span><span>${visit.dwell}s</span></div>`
  ).join('');
}

async function tabMetadata(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        headings: [...document.querySelectorAll('h1, h2, h3')].slice(0, 10)
          .map(heading => heading.textContent?.trim()).filter(Boolean)
      })
    });
    return results[0]?.result || {};
  } catch {
    return {};
  }
}

async function addCurrentTabs() {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(tab => tab.url && isScorableUrl(tab.url));
  const currentVisits = await Promise.all(candidates.map(async (tab, index) => {
    const metadata = await tabMetadata(tab.id);
    return {
      ...metadata,
      title: metadata.title || tab.title || tab.url,
      url: tab.url,
      dwell: PARAMS.MIN_DWELL + ((index * 47) % 271),
      source: 'current tab'
    };
  }));
  state.visits = [...MOCK_VISITS, ...currentVisits];
  renderVisits();
  $('status').textContent = `${currentVisits.length} current tab${currentVisits.length === 1 ? '' : 's'} included.`;
}

function renderResults() {
  const results = [];
  let related = 0;
  let uncertain = 0;
  let unrelated = 0;
  let totalCredit = 0;
  for (const visit of state.visits) {
    for (const deck of state.decks) {
      const result = scoreRelevance(visit, deck.model);
      const counted = visit.dwell >= PARAMS.MIN_DWELL && result.label === 'related';
      const credit = counted
        ? PARAMS.LAMBDA * result.score * Math.min(visit.dwell / PARAMS.T_FULL, 1)
        : 0;
      totalCredit += credit;
      if (result.label === 'related') related += 1;
      else if (result.label === 'uncertain') uncertain += 1;
      else unrelated += 1;
      results.push(`<tr><td>${escapeHtml(visit.title)}</td><td>${escapeHtml(deck.name)}</td><td>${visit.dwell}s</td><td>${result.score.toFixed(3)}</td><td>${result.label}</td><td>${escapeHtml(result.matchedTerms.join(', ') || '—')}</td><td>${credit.toFixed(3)}</td></tr>`);
    }
  }
  $('summary').innerHTML = [
    `Visits: ${state.visits.length}`,
    `Decks: ${state.decks.length}`,
    `Related: ${related}`,
    `Uncertain: ${uncertain}`,
    `Unrelated: ${unrelated}`,
    `Capped credit: ${Math.min(PARAMS.CREDIT_CAP, totalCredit).toFixed(3)}`
  ].map(value => `<strong>${value}</strong>`).join('');
  $('results').innerHTML = `<table><thead><tr><th>Page</th><th>Deck</th><th>Dwell</th><th>Score</th><th>Label</th><th>Matched terms</th><th>Credit</th></tr></thead><tbody>${results.join('')}</tbody></table>`;
}

async function loadDecks() {
  const studyState = await loadStudyState();
  state.decks = (studyState.decks || []).map(deck => ({
    name: deck.name,
    model: buildDeckModel((studyState.cards || []).filter(card => card.deckId === deck.id), deck)
  }));
  $('status').textContent = `${state.decks.length} deck${state.decks.length === 1 ? '' : 's'} loaded.`;
}

$('include-tabs').addEventListener('change', event => {
  if (event.target.checked) {
    addCurrentTabs().catch(error => { $('status').textContent = `Could not include tabs: ${error.message}`; });
  } else {
    state.visits = [...MOCK_VISITS];
    renderVisits();
    $('status').textContent = 'Only mock visits included.';
  }
});
$('run').addEventListener('click', () => renderResults());
$('refresh').addEventListener('click', () => loadDecks().catch(error => {
  $('status').textContent = `Could not load decks: ${error.message}`;
}));

renderVisits();
loadDecks().catch(error => { $('status').textContent = `Could not load decks: ${error.message}`; });
