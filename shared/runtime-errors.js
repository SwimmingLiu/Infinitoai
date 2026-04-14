(function(root, factory) {
  const exports = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }

  root.RuntimeErrors = exports;
})(typeof globalThis !== 'undefined' ? globalThis : self, function() {
  function isMessageChannelClosedError(error) {
    const message = typeof error === 'string' ? error : error?.message || '';
    return /message channel closed before a response was received|message channel is closed/i.test(message);
  }

  function isReceivingEndMissingError(error) {
    const message = typeof error === 'string' ? error : error?.message || '';
    return /could not establish connection\.\s*receiving end does not exist/i.test(message);
  }

  function buildMailPollRecoveryPlan(error) {
    if (isMessageChannelClosedError(error) || isReceivingEndMissingError(error)) {
      return ['soft-retry', 'reload'];
    }
    return [];
  }

  function shouldSkipStepResultLog(status) {
    return status === 'failed' || status === 'stopped';
  }

  function shouldRetryStep3WithFreshOauth(error) {
    const message = typeof error === 'string' ? error : error?.message || '';
    return /step 3 blocked: openai auth page timed out before credentials could be submitted/i.test(message);
  }

  function shouldRetryStep8WithFreshOauth(error) {
    const message = typeof error === 'string' ? error : error?.message || '';
    return /step 8 recoverable: auth flow landed on an unexpected page before localhost redirect/i.test(message);
  }

  return {
    buildMailPollRecoveryPlan,
    isMessageChannelClosedError,
    isReceivingEndMissingError,
    shouldRetryStep3WithFreshOauth,
    shouldRetryStep8WithFreshOauth,
    shouldSkipStepResultLog,
  };
});
