import { createCard, loadStudyState, saveStudyState } from '../state/study-state.js';
import { createButton, createInput } from '../dom.js';

let state;

function render() {
  const container = document.getElementById('manager-decks');
  container.textContent = '';
  state.decks.forEach(deck => container.appendChild(renderDeck(deck)));
}

function renderDeck(deck) {
  const section = document.createElement('section');
  section.className = 'manager-deck';
  const header = document.createElement('div');
  header.className = 'manager-deck-header';
  const name = createInput(deck.name, 'Deck topic');
  const exam = createInput('', 'Exam date', 'date');
  exam.value = deck.examDate ? new Date(deck.examDate).toISOString().slice(0, 10) : '';
  const saveDeck = createButton('Save deck');
  const deleteDeck = createButton('Delete deck', 'danger');
  saveDeck.addEventListener('click', async () => {
    if (!name.value.trim()) return setStatus('Deck name cannot be empty.');
    deck.name = name.value.trim();
    deck.examDate = exam.value ? new Date(`${exam.value}T23:59:59`).getTime() : null;
    await saveStudyState(state);
    setStatus('Deck saved.');
    render();
  });
  deleteDeck.addEventListener('click', async () => {
    if (!confirm(`Delete "${deck.name}" and all of its cards?`)) return;
    state.decks = state.decks.filter(item => item.id !== deck.id);
    state.cards = state.cards.filter(card => card.deckId !== deck.id);
    await saveStudyState(state);
    setStatus('Deck deleted.');
    render();
  });
  header.append(name, exam, saveDeck, deleteDeck);
  section.appendChild(header);

  const cards = state.cards.filter(card => card.deckId === deck.id);
  const meta = document.createElement('p');
  meta.className = 'manager-deck-meta';
  meta.textContent = `${cards.length} card${cards.length === 1 ? '' : 's'} · ${deck.examDate ? 'deadline mode' : 'retention mode'}`;
  section.appendChild(meta);

  const cardGrid = document.createElement('div');
  cardGrid.className = 'manager-cards';
  cards.forEach(card => cardGrid.appendChild(renderCard(card)));
  section.appendChild(cardGrid);

  const newFront = createInput('', 'New question');
  const newBack = createInput('', 'New answer');
  const addCard = createButton('+ Add card');
  addCard.addEventListener('click', async () => {
    if (!newFront.value.trim() || !newBack.value.trim()) return setStatus('Add both a question and answer.');
    state.cards.push(createCard({ id: `card-${Date.now()}`, deckId: deck.id, front: newFront.value.trim(), back: newBack.value.trim() }));
    await saveStudyState(state);
    setStatus('Card added.');
    render();
  });
  const addRow = document.createElement('div');
  addRow.className = 'new-manager-card';
  addRow.append(newFront, newBack, addCard);
  section.appendChild(addRow);
  return section;
}

function renderCard(card) {
  const article = document.createElement('article');
  article.className = 'manager-card';
  const front = document.createElement('textarea');
  front.value = card.front;
  front.placeholder = 'Question';
  const back = document.createElement('textarea');
  back.value = card.back;
  back.placeholder = 'Answer';
  const saveCard = createButton('Save card');
  const deleteCard = createButton('Delete card');
  saveCard.addEventListener('click', async () => {
    if (!front.value.trim() || !back.value.trim()) return setStatus('A card needs a question and answer.');
    card.front = front.value.trim();
    card.back = back.value.trim();
    await saveStudyState(state);
    setStatus('Card saved.');
  });
  deleteCard.addEventListener('click', async () => {
    state.cards = state.cards.filter(item => item.id !== card.id);
    await saveStudyState(state);
    setStatus('Card deleted.');
    render();
  });
  const actions = document.createElement('div');
  actions.className = 'manager-card-actions';
  actions.append(saveCard, deleteCard);
  article.append(front, back, actions);
  return article;
}

function setStatus(message) {
  document.getElementById('manager-status').textContent = message;
}

document.addEventListener('DOMContentLoaded', async () => {
  state = await loadStudyState();
  render();
  document.getElementById('add-deck').addEventListener('click', async () => {
    const field = document.getElementById('new-deck-name');
    if (!field.value.trim()) return setStatus('Enter a topic for the new deck.');
    state.decks.push({ id: `deck-${Date.now()}`, name: field.value.trim(), examDate: null });
    field.value = '';
    await saveStudyState(state);
    setStatus('Deck created.');
    render();
  });
  document.getElementById('back-to-sidepanel').addEventListener('click', () => window.close());
});
