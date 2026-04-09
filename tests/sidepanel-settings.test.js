const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_AUTO_RUN_COUNT,
  DEFAULT_AUTO_RUN_INFINITE,
  DEFAULT_AUTO_ROTATE_MAIL_PROVIDER,
  DEFAULT_EMAIL_SOURCE,
  PERSISTED_TOP_SETTING_KEYS,
  normalizePersistentSettings,
  sanitizeAutoRunCount,
  sanitizeAutoRotateMailProvider,
  sanitizeEmailSource,
  sanitizeInfiniteAutoRun,
} = require('../shared/sidepanel-settings.js');

test('sanitizeAutoRunCount keeps positive integers', () => {
  assert.equal(sanitizeAutoRunCount('5'), 5);
  assert.equal(sanitizeAutoRunCount(3), 3);
});

test('sanitizeAutoRunCount falls back to default for invalid values', () => {
  assert.equal(sanitizeAutoRunCount(''), DEFAULT_AUTO_RUN_COUNT);
  assert.equal(sanitizeAutoRunCount('0'), DEFAULT_AUTO_RUN_COUNT);
  assert.equal(sanitizeAutoRunCount('-1'), DEFAULT_AUTO_RUN_COUNT);
  assert.equal(sanitizeAutoRunCount('abc'), DEFAULT_AUTO_RUN_COUNT);
});

test('sanitizeInfiniteAutoRun coerces values to booleans', () => {
  assert.equal(sanitizeInfiniteAutoRun(true), true);
  assert.equal(sanitizeInfiniteAutoRun(false), false);
  assert.equal(sanitizeInfiniteAutoRun('true'), true);
  assert.equal(sanitizeInfiniteAutoRun('false'), false);
  assert.equal(sanitizeInfiniteAutoRun(undefined), false);
});

test('sanitizeEmailSource falls back to duck for unsupported values', () => {
  assert.equal(sanitizeEmailSource('duck'), 'duck');
  assert.equal(sanitizeEmailSource('33mail'), '33mail');
  assert.equal(sanitizeEmailSource('other'), DEFAULT_EMAIL_SOURCE);
});

test('sanitizeAutoRotateMailProvider coerces booleans safely', () => {
  assert.equal(sanitizeAutoRotateMailProvider(true), true);
  assert.equal(sanitizeAutoRotateMailProvider(false), false);
  assert.equal(sanitizeAutoRotateMailProvider('true'), true);
  assert.equal(sanitizeAutoRotateMailProvider('false'), false);
  assert.equal(sanitizeAutoRotateMailProvider(undefined), DEFAULT_AUTO_ROTATE_MAIL_PROVIDER);
});

test('normalizePersistentSettings returns only persisted top-bar settings', () => {
  assert.deepEqual(
    normalizePersistentSettings({
      vpsUrl: 'http://127.0.0.1:3000',
      mailProvider: 'inbucket',
      emailSource: '33mail',
      mailDomainSettings: {
        '163': { emailDomain: 'alpha.33mail.com' },
        qq: { emailDomain: 'beta.33mail.com' },
      },
      inbucketHost: 'mail.test',
      inbucketMailbox: 'box-1',
      autoRunCount: '8',
      autoRunInfinite: 'true',
      autoRotateMailProvider: 'true',
      customPassword: 'should-not-be-here',
    }),
    {
      vpsUrl: 'http://127.0.0.1:3000',
      mailProvider: 'inbucket',
      emailSource: '33mail',
      mailDomainSettings: {
        '163': { emailDomain: 'alpha.33mail.com' },
        qq: { emailDomain: 'beta.33mail.com' },
        inbucket: { emailDomain: '' },
      },
      inbucketHost: 'mail.test',
      inbucketMailbox: 'box-1',
      autoRunCount: 8,
      autoRunInfinite: true,
      autoRotateMailProvider: true,
    }
  );

  assert.deepEqual(
    normalizePersistentSettings({}),
    {
      vpsUrl: '',
      mailProvider: '163',
      emailSource: DEFAULT_EMAIL_SOURCE,
      mailDomainSettings: {
        '163': { emailDomain: '' },
        qq: { emailDomain: '' },
        inbucket: { emailDomain: '' },
      },
      inbucketHost: '',
      inbucketMailbox: '',
      autoRunCount: DEFAULT_AUTO_RUN_COUNT,
      autoRunInfinite: DEFAULT_AUTO_RUN_INFINITE,
      autoRotateMailProvider: DEFAULT_AUTO_ROTATE_MAIL_PROVIDER,
    }
  );

  assert.deepEqual(
    PERSISTED_TOP_SETTING_KEYS,
    ['vpsUrl', 'mailProvider', 'emailSource', 'mailDomainSettings', 'inbucketHost', 'inbucketMailbox', 'autoRunCount', 'autoRunInfinite', 'autoRotateMailProvider']
  );
});
