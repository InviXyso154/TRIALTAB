export function createRuntime() {
  const runtime = globalThis.chrome?.runtime;

  function send(message, callback) {
    if (!runtime) {
      callback?.(null);
      return;
    }

    runtime.sendMessage(message, response => {
      callback?.(globalThis.chrome.runtime.lastError ? null : response);
    });
  }

  return {
    send,
    onMessage: runtime?.onMessage
  };
}
