// TabDungeon - Background Service Worker
// Handles tab monitoring, domain classification, and AI Guide API calls

import {
  buildDeckModel,
  classifyAgainstDecks,
  isScorableUrl,
  normalizeUrl,
  scoreRelevance
} from '../core/relevance.js';
import { PARAMS, clamp } from '../core/params.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
const MODEL = 'gemini-3.5-flash-lite';

// Default system prompt for the playable hero who doubles as the AI Guide NPC.
// IMPORTANT: Only use information explicitly provided in the context.
// Do NOT make up statistics, numbers, or facts not given to you.
// If you don't know something, say you don't have that information.
const SYSTEM_PROMPT = `You are the user's dungeon hero and AI Guide companion in TabDungeon, a pixel-art productivity RPG.
You are a kind, observant adventurer speaking from a small dungeon between quests. Your role is to help the user
focus, understand their browsing habits, and take the next useful step.

PERSONALITY AND VOICE:
- Speak in first person as the Guide/hero, with a warm, encouraging, lightly playful fantasy-game voice.
- Use occasional gentle terms such as "traveler", "hero", "quest", "camp", "path", or "dungeon".
- Keep roleplay subtle: the advice must remain clear, practical, and useful.
- You may use a short in-character flourish when it fits, such as "The path is clear" or "A small victory for the party."
- Never threaten, shame, or pressure the user, and never pretend that fictional game events are real.
- Do not overuse fantasy metaphors, exclamation marks, or catchphrases.

IMPORTANT CONSTRAINTS:
- ONLY use information that is explicitly provided in the context/messages below
- Do NOT make up, guess, or hallucinate any statistics, numbers, or facts
- If you don't have information about something, clearly say you don't have that data
- Do not claim the user has spent time on sites unless explicitly told
- Do not invent features or capabilities that weren't mentioned
- Do NOT volunteer time spent statistics unless the user specifically asks about their time/session stats

Keep your responses:
- Helpful, practical, and encouraging
- Concise (2-3 sentences max for general questions)
- In-character as the Guide while remaining easy to understand
- Focused on productivity insights when relevant

You can discuss:
- The user's browsing session statistics (ONLY if provided in context AND user asks about it)
- Focus tips and productivity advice
- How to use TabDungeon features (ONLY if mentioned in context)
- General productivity guidance

Do NOT:
- Replace useful advice with fantasy narration
- Be melodramatic, patronizing, or overly dramatic
- Make up statistics you don't have access to
- Claim knowledge about the user's browsing habits unless explicitly given
- Bring up time spent on sites unprompted`;

// Track active tab timing
let activeTabStartTime = null;
let activeTabId = null;
let focusedWindowId = chrome.windows?.WINDOW_ID_NONE || -1;
let idleState = 'active';
let activePage = null;
const countedTabIds = new Set();
let deckModelCache = null;
let deckModelSignature = '';

// Listen for messages from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'chatWithGuide') {
    handleChatRequest(request.message, sendResponse);
    return true;
  }
  if (request.action === 'testApiKey') {
    testApiKey(request.apiKey, sendResponse);
    return true;
  }
  
  if (request.action === 'getSessionStats') {
    getSessionData(sendResponse);
    return true;
  }
  
  if (request.action === 'updateDomainClassification') {
    sendResponse({ success: false, error: 'Domain classification is no longer used.' });
    return false;
  }
  
  if (request.action === 'getUserDomainOverrides') {
    sendResponse({ success: true, overrides: {} });
    return false;
  }
  
  if (request.action === 'getAllTabs') {
    getAllTabsInfo(sendResponse);
    return true;
  }
  if (request.action === 'openDeckManager') {
    chrome.tabs.create({ url: chrome.runtime.getURL('deck-manager/deck-manager.html') });
    return false;
  }
  if (request.action === 'scoreRelevance') {
    getDeckModels().then(models => sendResponse({
      success: true,
      result: scoreRelevance(request.metadata || {}, models.find(model => model.deckId === request.deckId))
    })).catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle chat request to Gemini API
async function handleChatRequest(userMessage, sendResponse) {
  try {
    const aiSettings = await chrome.storage.local.get(['aiEnabled']);
    if (aiSettings.aiEnabled === false) {
      sendResponse({ success: false, error: 'AI Guide is disabled in Settings.' });
      return;
    }
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      sendResponse({
        success: false,
        error: 'API key not configured. Please set your Google Gemini API key in settings.'
      });
      return;
    }
    
    // Trim key to remove any whitespace
    const cleanKey = apiKey.trim();
    
    const data = await getSessionData();
    const stats = data.stats;
    const userContext = data.userContext;
    const devMode = data.devMode || false;
    
    const systemContext = `Current user context: ${JSON.stringify(userContext)}.
    Current session stats: ${JSON.stringify(stats)}. 
    Use these stats when relevant to the user's questions.`;
    
    console.log('[TabDungeon] Chat request:', { model: MODEL, messageLength: userMessage.length });
    
    // Gemini API uses contents format with parts
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: SYSTEM_PROMPT + '\\n\\n' + systemContext },
            { text: userMessage }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    };
    
    const apiUrl = `${GEMINI_API_URL}?key=${cleanKey}`;
    console.log('[TabDungeon] Chat request to Gemini');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('[TabDungeon] API response status:', response.status, response.statusText);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { raw: await response.text() };
      }
      const errorMsg = errorData.error?.message || errorData.error?.status || `API error: ${response.status} ${response.statusText}`;
      const errorResponse = {
        success: false,
        error: errorMsg,
        statusCode: response.status,
        statusText: response.statusText,
        rawResponse: errorData
      };
      
      console.error('[TabDungeon] API Error:', errorResponse);
      
      if (devMode) {
        sendResponse(errorResponse);
      } else {
        sendResponse({ success: false, error: errorMsg });
      }
      return;
    }
    
    const result = await response.json();
    console.log('[TabDungeon] API success');
    
    // Gemini response format: candidates[0].content.parts[0].text
    if (!result.candidates || result.candidates.length === 0) {
      const errorResponse = {
        success: false,
        error: 'Empty response from API',
        rawResponse: result
      };
      sendResponse(devMode ? errorResponse : { success: false, error: 'Empty response from API' });
      return;
    }
    
    const reply = result.candidates[0].content.parts[0].text;
    
    const responseData = {
      success: true,
      reply: reply,
      rawResponse: devMode ? result : undefined
    };
    
    sendResponse(responseData);
  } catch (error) {
    console.error('[TabDungeon] Chat error:', error);
    console.error('[TabDungeon] Stack:', error.stack);
    const errorData = {
      success: false,
      error: error.message || 'Failed to get response from AI Guide',
      rawError: error
    };
    
    sendResponse(errorData);
  }
}

// Get API key from storage
async function getApiKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  return result.apiKey || null;
}

async function testApiKey(apiKey, sendResponse) {
  if (!apiKey) {
    sendResponse({ success: false, error: 'Please enter an API key first.' });
    return;
  }
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }] })
    });
    sendResponse(response.ok ? { success: true } : { success: false, error: `API returned ${response.status}.` });
  } catch (error) {
    sendResponse({ success: false, error: error.message || 'Unable to reach the API.' });
  }
}

// Get full session data
async function getSessionData(sendResponse) {
  await flushExposure();
  const result = await chrome.storage.local.get(['studyStats', 'devMode']);
  const studyStats = result.studyStats || { exposureMs: 0, tabsVisited: 0, dueCards: 0, startTime: Date.now() };
  const devMode = result.devMode || false;
  
  if (sendResponse) {
    sendResponse({ success: true, stats: studyStats, devMode });
  } else {
    return { stats: studyStats, devMode };
  }
}

// Get default session stats
// Quick storage access
async function getStorage(key) {
  const result = await chrome.storage.local.get([key]);
  return result[key];
}

// Tab monitoring - track active tab and classify
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await flushExposure();
  await beginActivePage(activeInfo.tabId, activeInfo.windowId);
});

// Also monitor tab updates (URL changes and loading completion)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab) {
    await countNewTab(tab);
  }
  if ((changeInfo.url || changeInfo.status === 'complete') && tab && tab.active) {
    await flushExposure();
    await beginActivePage(tabId, tab.windowId);
  }
  // Always notify side panel on any tab update
  chrome.runtime.sendMessage({ action: 'tabsChanged' }).catch(() => {});
});

// Accumulate active time and refresh the chatbot context in complete one-minute blocks.
chrome.alarms.create('minuteUpdate', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'minuteUpdate') return;
  await flushExposure();
});

chrome.windows.onFocusChanged.addListener(async windowId => {
  await flushExposure();
  focusedWindowId = windowId;
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activePage = null;
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, windowId });
  if (tabs[0]) await beginActivePage(tabs[0].id, windowId);
});

chrome.idle.onStateChanged.addListener(async state => {
  await flushExposure();
  idleState = state;
  if (state !== 'active') activePage = null;
  else if (focusedWindowId !== chrome.windows.WINDOW_ID_NONE) {
    const tabs = await chrome.tabs.query({ active: true, windowId: focusedWindowId });
    if (tabs[0]) await beginActivePage(tabs[0].id, focusedWindowId);
  }
});

// Listen for tab removal (auto-refresh tabs list)
chrome.tabs.onRemoved.addListener((tabId) => {
  countedTabIds.delete(tabId);
  chrome.runtime.sendMessage({ action: 'tabsChanged' }).catch(() => {});
});

// A tab visit means a newly created browser tab, not selecting an existing tab.
chrome.tabs.onCreated.addListener(async (tab) => {
  await countNewTab(tab);
  chrome.runtime.sendMessage({ action: 'tabsChanged' }).catch(() => {});
});

async function beginActivePage(tabId, windowId) {
  if (idleState !== 'active' || windowId !== focusedWindowId && focusedWindowId !== chrome.windows.WINDOW_ID_NONE) return;
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url || !isScorableUrl(tab.url)) {
    activePage = null;
    return;
  }
  activeTabId = tabId;
  activeTabStartTime = Date.now();
  activePage = { tabId, windowId, url: normalizeUrl(tab.url), metadata: await getTabMetadata(tabId) };
  focusedWindowId = windowId;
}

async function flushExposure() {
  if (!activePage || !activeTabStartTime || idleState !== 'active') return;
  const dwell = Date.now() - activeTabStartTime;
  activeTabStartTime = Date.now();
  if (dwell < PARAMS.MIN_DWELL * 1000) return;

  const state = await chrome.storage.local.get(['studyState', 'exposureVisits', 'studyStats']);
  const studyState = state.studyState || { decks: [], cards: [] };
  const visits = state.exposureVisits || {};
  const day = new Date().toISOString().slice(0, 10);
  const stats = state.studyStats || { exposureMs: 0, tabsVisited: 0, dueCards: 0, startTime: Date.now() };
  const models = await getDeckModels(studyState);
  const pageMetadata = activePage.metadata;
  for (const deck of studyState.decks || []) {
    const cards = (studyState.cards || []).filter(card => card.deckId === deck.id);
    const relevance = scoreRelevance(pageMetadata, models.find(model => model.deckId === deck.id));
    const key = `${day}:${deck.id}:${hashUrl(activePage.url)}`;
    if (relevance.label !== 'related' || visits[key]) continue;
    visits[key] = true;
    const credit = PARAMS.LAMBDA * relevance.score * Math.min(dwell / (PARAMS.T_FULL * 1000), 1);
    for (const card of cards) {
      card.exposureCredit = clamp((card.exposureCredit || 0) + credit, 0, PARAMS.CREDIT_CAP);
    }
    stats.exposureMs += dwell;
  }
  await chrome.storage.local.set({ studyState, exposureVisits: visits, studyStats: stats });
}

function hashUrl(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function countNewTab(tab) {
  if (!tab?.id || !tab.url || !isScorableUrl(tab.url)) {
    return;
  }
  if (countedTabIds.has(tab.id)) return;

  countedTabIds.add(tab.id);
  const studyStats = await getStorage('studyStats') || { exposureMs: 0, tabsVisited: 0, dueCards: 0, startTime: Date.now() };
  studyStats.tabsVisited += 1;
  await chrome.storage.local.set({ studyStats });
}

async function getTabMetadata(tabId) {
  if (!tabId) return {};
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title,
        description: [
          document.querySelector('meta[name="description"]')?.content,
          document.querySelector('meta[property="og:description"]')?.content,
          document.querySelector('meta[name="twitter:description"]')?.content
        ].filter(Boolean).join(' '),
        keywords: [
          document.querySelector('meta[name="keywords"]')?.content,
          document.querySelector('meta[property="og:title"]')?.content,
          document.querySelector('meta[name="twitter:title"]')?.content
        ].filter(Boolean).join(' '),
        headings: [...document.querySelectorAll('h1, h2, h3')]
          .slice(0, 10)
          .map(heading => heading.textContent?.trim())
          .filter(Boolean)
      })
    });
    return results[0]?.result || {};
  } catch (error) {
    console.warn('[TabDungeon] Page metadata unavailable:', error.message);
    return {};
  }
}

// Get all open tabs and their best matching study deck.
async function getAllTabsInfo(sendResponse) {
  const allTabs = await chrome.tabs.query({});
  const { studyState } = await chrome.storage.local.get('studyState');
  const eligibleTabs = allTabs.filter(tab => tab.url && isScorableUrl(tab.url));
  const models = await getDeckModels(studyState);
  const tabsWithDecks = await Promise.all(eligibleTabs.map(async tab => {
    if (tab.id !== activeTabId || tab.windowId !== focusedWindowId) {
      return { id: tab.id, title: tab.title || 'Untitled', bestDeck: null };
    }
    const metadata = await getTabMetadata(tab.id);
    const match = classifyAgainstDecks(metadata, models);
    const deck = studyState?.decks?.find(item => item.id === match?.deckId);
    return { id: tab.id, title: tab.title || 'Untitled', bestDeck: match?.label === 'related' ? deck?.name || null : null };
  }));
  
  if (sendResponse) {
    sendResponse({ success: true, tabs: tabsWithDecks });
  }

  async function getDeckModels(studyState = null) {
    const state = studyState || (await chrome.storage.local.get('studyState')).studyState || { decks: [], cards: [] };
    const signature = JSON.stringify({
      decks: (state.decks || []).map(deck => ({
        id: deck.id,
        name: deck.name,
        description: deck.description,
        keywords: deck.keywords,
        examDate: deck.examDate
      })),
      cards: (state.cards || []).map(card => ({
        id: card.id,
        deckId: card.deckId,
        front: card.front,
        back: card.back
      }))
    });
    if (deckModelCache && deckModelSignature === signature) return deckModelCache;
    const stored = await chrome.storage.local.get(['relevanceDeckModels', 'relevanceDeckModelsSignature']);
    if (stored.relevanceDeckModelsSignature === signature && Array.isArray(stored.relevanceDeckModels)) {
      deckModelCache = stored.relevanceDeckModels;
      deckModelSignature = signature;
      return deckModelCache;
    }
    deckModelCache = (state.decks || []).map(deck => buildDeckModel(
      (state.cards || []).filter(card => card.deckId === deck.id),
      { ...deck, description: deck.description, keywords: deck.keywords }
    ));
    deckModelSignature = signature;
    await chrome.storage.local.set({
      relevanceDeckModels: deckModelCache,
      relevanceDeckModelsSignature: signature
    });
    return deckModelCache;
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.studyState) {
      deckModelCache = null;
      deckModelSignature = '';
    }
  });
}

// Initialize when extension loads
chrome.runtime.onStartup.addListener(async () => {
  focusedWindowId = await chrome.windows.getLastFocused().then(window => window.id);
  const tabs = await chrome.tabs.query({ active: true, windowId: focusedWindowId });
  if (tabs[0]) await beginActivePage(tabs[0].id, focusedWindowId);
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    studyStats: { exposureMs: 0, tabsVisited: 0, dueCards: 0, startTime: Date.now() }
  });
  const window = await chrome.windows.getLastFocused();
  focusedWindowId = window.id;
  const tabs = await chrome.tabs.query({ active: true, windowId: focusedWindowId });
  if (tabs[0]) await beginActivePage(tabs[0].id, focusedWindowId);
});
