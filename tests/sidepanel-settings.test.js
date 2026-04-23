const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTopSettingPayload,
  DEFAULT_ACCOUNT_SUCCESS_ONLY,
  DEFAULT_AUTO_RUN_COUNT,
  DEFAULT_AUTO_RUN_INFINITE,
  DEFAULT_AUTO_ROTATE_MAIL_PROVIDER,
  DEFAULT_EMAIL_SOURCE,
  getAutoContinueHint,
  getEmailInputPlaceholder,
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

test('sanitizeEmailSource falls back to tmailor for unsupported values', () => {
  assert.equal(sanitizeEmailSource('duck'), 'duck');
  assert.equal(sanitizeEmailSource('33mail'), '33mail');
  assert.equal(sanitizeEmailSource('2925'), '2925');
  assert.equal(sanitizeEmailSource('tmailor'), 'tmailor');
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
      vpsCpaPassword: 'secret-key',
      mailProvider: 'inbucket',
      emailSource: '33mail',
      mail2925Prefix: 'demo',
      mailDomainSettings: {
        '163': { emailDomain: 'alpha.33mail.com' },
        qq: { emailDomain: 'beta.33mail.com' },
      },
      inbucketHost: 'mail.test',
      inbucketMailbox: 'box-1',
      autoRunCount: '8',
      autoRunInfinite: 'true',
      autoRotateMailProvider: 'true',
      accountSuccessOnly: false,
      customPassword: 'should-not-be-here',
    }),
    {
      vpsUrl: 'http://127.0.0.1:3000',
      vpsCpaPassword: 'secret-key',
      mailProvider: 'inbucket',
      emailSource: '33mail',
      mail2925Prefix: 'demo',
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
      accountSuccessOnly: false,
    }
  );

  assert.deepEqual(
    normalizePersistentSettings({}),
    {
      vpsUrl: '',
      vpsCpaPassword: '',
      mailProvider: '163',
      emailSource: DEFAULT_EMAIL_SOURCE,
      mail2925Prefix: '',
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
      accountSuccessOnly: DEFAULT_ACCOUNT_SUCCESS_ONLY,
    }
  );

  assert.deepEqual(
    PERSISTED_TOP_SETTING_KEYS,
    ['vpsUrl', 'vpsCpaPassword', 'mailProvider', 'emailSource', 'mail2925Prefix', 'mailDomainSettings', 'inbucketHost', 'inbucketMailbox', 'autoRunCount', 'autoRunInfinite', 'autoRotateMailProvider', 'accountSuccessOnly']
  );
});

test('buildTopSettingPayload keeps the current email source and related settings before a run starts', () => {
  assert.deepEqual(
    buildTopSettingPayload({
      vpsUrl: ' https://panel.example.com ',
      vpsCpaPassword: ' secret-key ',
      mailProvider: 'qq',
      emailSource: '2925',
      mail2925Prefix: ' Demo.User@2925.com ',
      mailDomainSettings: {
        '163': { emailDomain: ' alpha.33mail.com ' },
        qq: { emailDomain: '@beta.33mail.com' },
      },
      inbucketHost: ' mailbox.test ',
      inbucketMailbox: ' box-7 ',
      autoRunCount: '6',
      autoRunInfinite: 'true',
      autoRotateMailProvider: 'false',
      accountSuccessOnly: false,
    }),
    {
      vpsUrl: 'https://panel.example.com',
      vpsCpaPassword: 'secret-key',
      mailProvider: 'qq',
      emailSource: '2925',
      mail2925Prefix: 'demo.user',
      mailDomainSettings: {
        '163': { emailDomain: 'alpha.33mail.com' },
        qq: { emailDomain: 'beta.33mail.com' },
        inbucket: { emailDomain: '' },
      },
      inbucketHost: 'mailbox.test',
      inbucketMailbox: 'box-7',
      autoRunCount: 6,
      autoRunInfinite: true,
      autoRotateMailProvider: false,
      accountSuccessOnly: false,
    }
  );
});

test('getEmailInputPlaceholder updates the TMailor placeholder to describe the manual New Email step', () => {
  assert.equal(
    getEmailInputPlaceholder({
      emailSource: '2925',
      mailProvider: '163',
    }),
    'Step 3 will generate a 2925 address automatically'
  );
});

test('getAutoContinueHint describes the 2925 prefix-and-generate flow', () => {
  assert.equal(
    getAutoContinueHint({
      emailSource: '2925',
      mailProvider: '163',
      autoRotateMailProvider: false,
    }),
    'Enter a 2925 prefix, then generate an address and continue. Auto run will resume automatically.'
  );
});

test('sidepanel settings no longer expose VPS validation helpers', () => {
  const settings = require('../shared/sidepanel-settings.js');
  assert.equal('getVpsUrlValidationError' in settings, false);
  assert.equal('isSupportedVpsOauthSuffix' in settings, false);
});
