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

  function isPhoneVerificationRequiredText(text, url = '') {
    const normalized = normalizeText(text);
    const normalizedUrl = normalizeText(url).toLowerCase();

    if (/(?:auth|accounts)\.openai\.com\/add-phone(?:[/?#]|$)/i.test(normalizedUrl)) {
      return true;
    }

    if (!normalized) {
      return false;
    }

    return PHONE_VERIFICATION_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function getPhoneVerificationBlockedMessage(step) {
    if (Number(step) === 7) {
      return '第 7 步被拦截：当前 auth 页面要求手机号验证，请切换节点后重试。';
    }
    return `第 ${step} 步被拦截：当前 auth 页面要求手机号验证。`;
  }

  return {
    getPhoneVerificationBlockedMessage,
    isPhoneVerificationRequiredText,
  };
});
