export function setupChat($, runtime, isDeveloperMode) {
  function addMessage(text, kind) {
    const message = document.createElement('div');
    message.className = `chat-message ${kind}`;
    message.textContent = text;
    $('chat-messages').appendChild(message);
    $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
  }

  $('chat-send').addEventListener('click', () => {
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text || $('chat-send').disabled) return;

    addMessage(text, 'user');
    input.value = '';
    $('chat-send').disabled = true;
    addMessage('…', 'guide');
    const pending = $('chat-messages').lastElementChild;

    runtime.send({ action: 'chatWithGuide', message: text }, response => {
      pending.remove();
      $('chat-send').disabled = false;
      addMessage(
        response?.success ? response.reply : (response?.error || 'The Guide is unavailable. Check your API key.'),
        'guide'
      );
      if (isDeveloperMode() && response) {
        $('developer-output').hidden = false;
        $('developer-output').textContent = JSON.stringify(response, null, 2);
      }
    });
  });

  $('chat-input').addEventListener('keydown', event => {
    if (event.key === 'Enter') $('chat-send').click();
  });
}
