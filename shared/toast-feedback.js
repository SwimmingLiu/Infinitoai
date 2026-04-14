(function(root, factory) {
  const exports = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  root.ToastFeedback = exports;
})(typeof globalThis !== 'undefined' ? globalThis : self, function() {
  const TOAST_DURATIONS = {
    error: 4200,
    warn: 3600,
    success: 5000,
    info: 5000,
  };

  function canonicalizeToastMessage(message) {
    let text = String(message || '').trim();
    text = text.replace(/^\[[^\]]+\]\s*/, '');
    text = text.replace(/^Auto fetch failed:\s*/i, '');
    text = text.replace(/^Run \d+\/(?:\d+|∞) failed:\s*/i, '');
    text = text.replace(/^Step \d+ failed:\s*/i, '');
    return text.trim();
  }

  function getToastDuration(type, duration) {
    if (typeof duration === 'number') {
      return duration;
    }
    return TOAST_DURATIONS[type] || TOAST_DURATIONS.info;
  }

  function buildToastKey(message, type = 'info') {
    return `${type}:${canonicalizeToastMessage(message)}`;
  }

  function shouldSuppressToastMessage(message, type = 'info') {
    if (type !== 'error' && type !== 'warn') {
      return false;
    }

    const text = String(message || '').trim();
    if (type === 'warn' && /^Stopping\.\.\.$/i.test(text)) {
      return true;
    }

    return /the page keeping the extension port is moved into back\/forward cache, so the message channel is closed|message channel closed before a response was received|could not establish connection\.\s*receiving end does not exist/i.test(text);
  }

  return {
    buildToastKey,
    canonicalizeToastMessage,
    getToastDuration,
    shouldSuppressToastMessage,
    TOAST_DURATIONS,
  };
});
