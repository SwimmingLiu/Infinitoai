(function(root, factory) {
  const exports = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  root.PhoneVerification = exports;
})(typeof globalThis !== 'undefined' ? globalThis : self, function() {
  const PHONE_VERIFICATION_PATTERNS = [
    /验证手机(?:号码)?/i,
    /电话号码是必填项/i,
    /添加电话(?:号码)?/i,
    /请输入.*手机(?:号码|号)/i,
    /请输入.*电话(?:号码|号)/i,
    /手机号(?:码)?验证/i,
    /verify\s+your\s+phone(?:\s+number)?/i,
    /enter\s+your\s+phone\s+number/i,
    /phone\s+number\s+verification/i,
    /add\s+your\s+phone/i,
  ];

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function isPhoneVerificationRequiredText(text) {
    const normalized = normalizeText(text);
    if (!normalized) {
      return false;
    }

    return PHONE_VERIFICATION_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function extractCurrentDomain(currentUrl) {
    const normalized = normalizeText(currentUrl);
    if (!normalized) {
      return '';
    }

    try {
      return new URL(normalized).hostname || '';
    } catch {
      const hostnameMatch = normalized.match(/^[a-z0-9.-]+\.[a-z]{2,}$/i);
      return hostnameMatch ? hostnameMatch[0].toLowerCase() : '';
    }
  }

  function getPhoneVerificationBlockedMessage(step, currentUrl) {
    if (Number(step) === 7) {
      const currentDomain = extractCurrentDomain(currentUrl);
      const domainSuffix = currentDomain ? ` (domain: ${currentDomain})` : '';
      return `Step 7 blocked: phone number is required on the auth page${domainSuffix}. Please change node and retry.`;
    }
    return `Step ${step} blocked: phone verification is required on the auth page.`;
  }

  return {
    getPhoneVerificationBlockedMessage,
    isPhoneVerificationRequiredText,
  };
});
