import { PARAMS } from '../core/params.js';
import { calculateReview, isDue } from '../core/scheduler.js';
import { loadStudyState, saveStudyState } from '../state/study-state.js';

export function setupCards($, runtime, gameController) {
  let state;
  let activeCard;
  let testSession = null;

  function safeGameCall(method, ...args) {
    try {
      return gameController?.[method]?.(...args);
    } catch (error) {
      console.error(`Game ${method} failed:`, error);
      return undefined;
    }
  }

  async function safeGameReview(event) {
    try {
      await gameController?.onReview?.(event);
    } catch (error) {
      console.error('Game review effect failed:', error);
    }
  }

  $('open-deck-manager').addEventListener('click', () => {
    const extensionUrl = globalThis.chrome?.runtime?.getURL('deck-manager/deck-manager.html');
    if (extensionUrl) {
      runtime.send({ action: 'openDeckManager' });
    } else {
      window.open('deck-manager/deck-manager.html', '_blank', 'noopener');
    }
  });

  function renderDeckSummary(deck) {
    const row = document.createElement('section');
    row.className = 'deck-row';
    const cards = state.cards.filter(card => card.deckId === deck.id);
    const nextDue = cards.length
      ? Math.min(...cards.map(card => card.dueAt || Date.now()))
      : null;
    const name = document.createElement('strong');
    name.className = 'deck-name';
    name.textContent = deck.name;
    const details = document.createElement('div');
    details.className = 'deck-details';
    const dueLabel = document.createElement('span');
    dueLabel.textContent = 'Due date';
    const dueInput = document.createElement('input');
    dueInput.type = 'date';
    dueInput.className = 'deck-due-input';
    dueInput.setAttribute('aria-label', `Due date for ${deck.name}`);
    dueInput.value = nextDue ? new Date(nextDue).toISOString().slice(0, 10) : '';
    dueInput.addEventListener('change', async () => {
      const dueAt = dueInput.value ? new Date(`${dueInput.value}T23:59:59.999`).getTime() : 0;
      cards.forEach(card => { card.dueAt = dueAt; });
      await saveStudyState(state);
      $('deck-editor-status').textContent = 'Due date updated.';
      render();
    });
    const count = document.createElement('span');
    count.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'}`;
    details.append(dueLabel, dueInput, count);
    row.append(name, details);
    return row;
  }

  function render(skipGame = false) {
    const now = Date.now();
    const dueCards = state.cards
      .filter(card => isDue(card, now))
      .sort((a, b) => a.dueAt - b.dueAt);
    activeCard = null;
    $('review-actions').hidden = true;
    $('card-response').disabled = false;
    $('submit-card-answer').disabled = false;
    $('card-response').value = '';
    $('deck-list').textContent = '';
    state.decks.forEach(deck => $('deck-list').appendChild(renderDeckSummary(deck)));
    $('answer-card').hidden = true;
    $('exit-test').hidden = true;
    $('empty-card-state').hidden = dueCards.length > 0;
    $('test-card-controls').hidden = true;
    $('due-card-state').hidden = dueCards.length === 0;
    $('test-deck-select').textContent = '';
    $('due-deck-select').textContent = '';
    if (dueCards.length === 0) {
      $('review-status').textContent = '';
      if (!skipGame) safeGameCall('showEmpty');
      return;
    }
    const dueDecks = state.decks.filter(deck => dueCards.some(card => card.deckId === deck.id));
    dueDecks.forEach(deck => {
      const option = document.createElement('option');
      option.value = deck.id;
      option.textContent = deck.name;
      $('due-deck-select').appendChild(option);
    });
    $('review-status').textContent = 'Choose a deck to answer a due card.';
    if (!skipGame) safeGameCall('showEmpty');
  }

  function showCard(card, label, skipGame = false) {
    if (!card) return;
    activeCard = card;
    $('empty-card-state').hidden = true;
    $('test-card-controls').hidden = true;
    $('due-card-state').hidden = true;
    $('answer-card').hidden = false;
    $('exit-test').hidden = !testSession;
    $('review-actions').hidden = true;
    $('card-response').disabled = false;
    $('submit-card-answer').disabled = false;
    $('card-response').value = '';
    $('card-question').textContent = activeCard.front;
    $('card-answer').textContent = activeCard.back;
    $('card-answer').hidden = true;
    $('review-status').textContent = label;
    const deck = state.decks.find(item => item.id === activeCard.deckId);
    safeGameCall(skipGame ? 'queueReview' : 'showReview', activeCard, deck);
  }

  function startDeckTest() {
    const deck = state.decks.find(item => item.id === $('test-deck-select').value);
    const cards = state.cards.filter(item => item.deckId === deck?.id);
    if (!deck || cards.length === 0) return;
    testSession = { deckId: deck.id, cardIds: cards.map(card => card.id), index: 0 };
    showCard(cards[0], `${deck.name} · Practice test (1/${cards.length})`);
  }

  function showDueCard() {
    const deck = state.decks.find(item => item.id === $('due-deck-select').value);
    const card = state.cards
      .filter(item => item.deckId === deck?.id && isDue(item, Date.now()))
      .sort((a, b) => a.dueAt - b.dueAt)[0];
    showCard(card, `${deck?.name || 'Deck'} · Due review`);
  }

  async function review(quality) {
    if (!activeCard) return;
    const deck = state.decks.find(item => item.id === activeCard.deckId);
    const now = Date.now();
    const dueBeforeReview = state.cards.filter(card => card.deckId === activeCard.deckId && isDue(card, now)).length;
    const tierCard = { ...activeCard };
    const updated = calculateReview(activeCard, quality, { now, deck, params: PARAMS });
    state.cards = state.cards.map(card => card.id === activeCard.id ? updated : card);
    state.history.push({ cardId: activeCard.id, quality, reviewedAt: new Date().toISOString(), schedule: updated.schedule });
    await saveStudyState(state);
    const repeatCard = Number(quality) === 1;
    const deckFinished = testSession
      ? !repeatCard && testSession.index >= testSession.cardIds.length - 1
      : state.cards.filter(card => card.deckId === activeCard.deckId && isDue(card, now)).length === 0;
    const gameEvent = {
      cardId: activeCard.id,
      deckId: activeCard.deckId,
      card: tierCard,
      deck,
      quality,
      dueRemainingInDeck: state.cards.filter(card => card.deckId === activeCard.deckId && isDue(card, now)).length,
      dailyDueCount: dueBeforeReview,
      exposureCredit: activeCard.exposureCredit || 0,
      deckFinished,
      now
    };
    if (testSession) {
      if (repeatCard) {
        await safeGameReview(gameEvent);
        showCard(updated, `${deck?.name || 'Deck'} · Practice test (repeat)`, true);
        return;
      }
      testSession.index += 1;
      const nextCard = state.cards.find(card => card.id === testSession.cardIds[testSession.index]);
      if (nextCard) {
        await safeGameReview(gameEvent);
        showCard(nextCard, `${deck?.name || 'Deck'} · Practice test (${testSession.index + 1}/${testSession.cardIds.length})`, true);
        return;
      } else {
        testSession = null;
        render(true);
      }
    } else {
      if (repeatCard) {
        await safeGameReview(gameEvent);
        showCard(updated, `${deck?.name || 'Deck'} · Again`, true);
        return;
      }
      render(true);
    }
    await safeGameReview(gameEvent);
  }

  function exitTest() {
    testSession = null;
    activeCard = null;
    render();
  }

  $('submit-card-answer').addEventListener('click', () => {
    const response = $('card-response').value.trim();
    if (!response) {
      $('review-status').textContent = 'Write an answer before finishing the card.';
      $('card-response').focus();
      return;
    }
    $('card-response').disabled = true;
    $('submit-card-answer').disabled = true;
    $('card-answer').hidden = false;
    $('review-actions').hidden = false;
    $('review-status').textContent = 'Answer submitted. How well did you recall it?';
  });
  document.querySelectorAll('.quality-button').forEach(button => button.addEventListener('click', () => review(Number(button.dataset.quality))));
  $('show-test-options').addEventListener('click', () => {
    const select = $('test-deck-select');
    select.textContent = '';
    state.decks
      .filter(deck => state.cards.some(card => card.deckId === deck.id))
      .forEach(deck => {
        const option = document.createElement('option');
        option.value = deck.id;
        option.textContent = deck.name;
        select.appendChild(option);
      });
    $('start-deck-test').disabled = select.options.length === 0;
    $('empty-card-state').hidden = true;
    $('test-card-controls').hidden = false;
  });
  $('start-deck-test').addEventListener('click', startDeckTest);
  $('show-due-card').addEventListener('click', showDueCard);
  $('exit-test').addEventListener('click', exitTest);
  $('add-deck').addEventListener('click', async () => {
    const name = $('new-deck-name').value.trim();
    if (!name) {
      $('deck-editor-status').textContent = 'Enter a topic for the new deck.';
      return;
    }
    state.decks.push({ id: `deck-${Date.now()}`, name, examDate: null });
    $('new-deck-name').value = '';
    await saveStudyState(state);
    $('deck-editor-status').textContent = 'Deck added.';
    render();
  });

  return {
    async load() {
      state = await loadStudyState();
      render();
    },
    getState: () => state
  };
}
