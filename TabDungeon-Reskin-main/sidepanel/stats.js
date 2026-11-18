export function createStatsView($, runtime) {
  const formatMinutes = milliseconds => `${Math.floor((milliseconds || 0) / 60000)}m`;

  function renderStats(stats) {
    if (!stats) return;
    $('session-time').textContent = `Session: ${formatMinutes(Date.now() - (stats.startTime || Date.now()))}`;
    $('study-exposure').textContent = `Study exposure: ${formatMinutes(stats.exposureMs)}`;
    $('due-cards').textContent = `Due cards: ${stats.dueCards || 0}`;
    $('tab-count').textContent = `New tabs: ${stats.tabsVisited || 0}`;
  }

  function loadTabs() {
    runtime.send({ action: 'getAllTabs' }, response => {
      const list = $('tabs-list');
      list.textContent = '';
      (response?.tabs || []).forEach(tab => {
        const row = document.createElement('div');
        row.className = 'tab-row';
        row.textContent = `${tab.title} · ${tab.bestDeck || 'No matching deck'}`;
        list.appendChild(row);
      });
      if (!list.children.length) list.textContent = 'No web tabs found.';
    });
  }

  function update() {
    runtime.send({ action: 'getSessionStats' }, response => {
      if (response?.success) renderStats(response.stats);
    });
    loadTabs();
  }

  return { update };
}
