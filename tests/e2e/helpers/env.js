const ALLOWED_EMAIL_SOURCES = new Set(['tmailor', 'duck', '33mail']);
const ALLOWED_MAIL_PROVIDERS = new Set(['163', 'qq', 'inbucket']);

function getRealFlowConfig() {
  return {
    enabled: process.env.PW_REAL_E2E === '1',
    vpsUrl: String(process.env.PW_REAL_VPS_URL || '').trim(),
    vpsPassword: String(process.env.PW_REAL_VPS_CPA_PASSWORD || '').trim(),
    emailSource: String(process.env.PW_REAL_EMAIL_SOURCE || 'tmailor').trim(),
    mailProvider: String(process.env.PW_REAL_MAIL_PROVIDER || '163').trim(),
    inbucketHost: String(process.env.PW_REAL_INBUCKET_HOST || '').trim(),
    inbucketMailbox: String(process.env.PW_REAL_INBUCKET_MAILBOX || '').trim(),
  };
}

function getMissingRealFlowConfig(config = getRealFlowConfig()) {
  const missing = [];

  if (!config.enabled) {
    missing.push('PW_REAL_E2E=1');
  }

  if (!config.vpsUrl) {
    missing.push('PW_REAL_VPS_URL');
  }

  if (!ALLOWED_EMAIL_SOURCES.has(config.emailSource)) {
    missing.push('PW_REAL_EMAIL_SOURCE(valid: tmailor, duck, 33mail)');
  }

  const usesMailProvider = config.emailSource !== 'tmailor';

  if (usesMailProvider && !ALLOWED_MAIL_PROVIDERS.has(config.mailProvider)) {
    missing.push('PW_REAL_MAIL_PROVIDER(valid: 163, qq, inbucket)');
  }

  if (usesMailProvider && config.mailProvider === 'inbucket') {
    if (!config.inbucketHost) {
      missing.push('PW_REAL_INBUCKET_HOST');
    }
    if (!config.inbucketMailbox) {
      missing.push('PW_REAL_INBUCKET_MAILBOX');
    }
  }

  return missing;
}

function hasRealFlowConfig() {
  return getMissingRealFlowConfig().length === 0;
}

function getRealFlowSkipReason() {
  const missing = getMissingRealFlowConfig();
  return missing.length > 0
    ? `Real flow e2e skipped. Missing or invalid configuration: ${missing.join(', ')}`
    : '';
}

module.exports = {
  getMissingRealFlowConfig,
  getRealFlowConfig,
  getRealFlowSkipReason,
  hasRealFlowConfig,
};
