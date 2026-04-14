(function(root, factory) {
  const exports = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  root.FlowRecovery = exports;
})(typeof globalThis !== 'undefined' ? globalThis : self, function() {
  const TMAILOR_HOME_URL = 'https://tmailor.com/';

  function normalizeStep(step) {
    const value = Number.parseInt(String(step ?? '').trim(), 10);
    return Number.isFinite(value) ? value : 0;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeUrl(value) {
    return String(value || '').trim();
  }

  function isLocalhostCallbackUrl(value) {
    const url = normalizeUrl(value).toLowerCase();
    return url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1');
  }

  function normalizeComparableUrl(value) {
    const url = normalizeUrl(value);
    if (!url) {
      return '';
    }

    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return url;
    }
  }

  function getHostname(value) {
    const url = normalizeUrl(value);
    if (!url) {
      return '';
    }

    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function isExpectedOpenAiAuthHost(value) {
    const hostname = getHostname(value);
    return hostname === 'auth.openai.com'
      || hostname === 'auth0.openai.com'
      || hostname === 'accounts.openai.com';
  }

  function getMailTabOpenUrlForStep({ step, mailSource, defaultUrl } = {}) {
    if (normalizeStep(step) === 7 && String(mailSource || '').trim() === 'tmailor-mail') {
      return TMAILOR_HOME_URL;
    }

    return String(defaultUrl || '').trim();
  }

  function shouldNavigateMailTabOnStepStart({ step, mailSource } = {}) {
    return normalizeStep(step) === 7 && String(mailSource || '').trim() === 'tmailor-mail';
  }

  function isVpsAuthorizationNotPendingText(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
      return false;
    }

    return (
      /(authorization|authorisation|auth)\s+link[^|]*not\s+pending/.test(text) ||
      /link\s+is\s+not\s+pending/.test(text) ||
      /授权链接[^|]*not\s+pending/.test(text) ||
      /授权链接[^|]*(不在待处理|不是待处理|未待处理)/.test(text)
    );
  }

  function isRecoverableAuthRedirectText(value) {
    const text = normalizeText(value).toLowerCase();
    if (!text) {
      return false;
    }

    return (
      /\b502\b.*bad gateway/.test(text) ||
      /\b500\b.*internal server error/.test(text) ||
      /\b503\b.*service unavailable/.test(text) ||
      /\b504\b.*gateway timeout/.test(text) ||
      /upstream connect error/.test(text) ||
      /temporary server error/.test(text) ||
      /服务器错误/.test(text)
    );
  }

  function getStep6RecoveryReasonForUnexpectedAuthPage({ currentUrl, currentPageText, expectedUrl } = {}) {
    const comparableCurrentUrl = normalizeComparableUrl(currentUrl);
    if (!comparableCurrentUrl) {
      return '';
    }

    if (isLocalhostCallbackUrl(comparableCurrentUrl)) {
      return '';
    }

    if (isRecoverableAuthRedirectText(currentPageText)) {
      return 'auth_server_error';
    }

    const comparableExpectedUrl = normalizeComparableUrl(expectedUrl);
    if (
      comparableExpectedUrl
      && comparableCurrentUrl !== comparableExpectedUrl
      && !isExpectedOpenAiAuthHost(comparableCurrentUrl)
    ) {
      return 'unexpected_auth_redirect';
    }

    return '';
  }

  return {
    TMAILOR_HOME_URL,
    getMailTabOpenUrlForStep,
    getStep6RecoveryReasonForUnexpectedAuthPage,
    isLocalhostCallbackUrl,
    isRecoverableAuthRedirectText,
    shouldNavigateMailTabOnStepStart,
    isVpsAuthorizationNotPendingText,
  };
});
