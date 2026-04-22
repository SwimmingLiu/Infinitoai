const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMissingRealFlowConfig,
  getRealFlowConfig,
} = require('./e2e/helpers/env.js');

test('real flow config does not require inbucket variables for tmailor runs', () => {
  const missing = getMissingRealFlowConfig({
    enabled: true,
    vpsUrl: 'https://example.com/management.html#/oauth',
    vpsPassword: '',
    emailSource: 'tmailor',
    mailProvider: 'inbucket',
    inbucketHost: '',
    inbucketMailbox: '',
  });

  assert.deepEqual(missing, []);
});

test('real flow config requires inbucket variables when a mail-provider source uses inbucket', () => {
  const missing = getMissingRealFlowConfig({
    enabled: true,
    vpsUrl: 'https://example.com/management.html#/oauth',
    vpsPassword: '',
    emailSource: 'duck',
    mailProvider: 'inbucket',
    inbucketHost: '',
    inbucketMailbox: '',
  });

  assert.deepEqual(missing, [
    'PW_REAL_INBUCKET_HOST',
    'PW_REAL_INBUCKET_MAILBOX',
  ]);
});

test('real flow config defaults to the sidepanel mail provider value when unset', () => {
  const originalMailProvider = process.env.PW_REAL_MAIL_PROVIDER;
  delete process.env.PW_REAL_MAIL_PROVIDER;

  try {
    const config = getRealFlowConfig();
    assert.equal(config.mailProvider, '163');
  } finally {
    if (originalMailProvider === undefined) {
      delete process.env.PW_REAL_MAIL_PROVIDER;
    } else {
      process.env.PW_REAL_MAIL_PROVIDER = originalMailProvider;
    }
  }
});
