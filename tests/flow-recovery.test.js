const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMailTabOpenUrlForStep,
  getStep6RecoveryReasonForUnexpectedAuthPage,
  isVpsAuthorizationNotPendingText,
} = require('../shared/flow-recovery.js');

test('step 7 reopens the TMailor home page before polling the login code', () => {
  assert.equal(
    getMailTabOpenUrlForStep({
      step: 7,
      mailSource: 'tmailor-mail',
      defaultUrl: 'https://tmailor.com/inbox?emailid=old-detail',
    }),
    'https://tmailor.com/'
  );
});

test('non-TMailor providers keep their original mailbox URL at step 7', () => {
  assert.equal(
    getMailTabOpenUrlForStep({
      step: 7,
      mailSource: 'mail-163',
      defaultUrl: 'https://mail.163.com/js6/main.jsp?df=mail163_letter',
    }),
    'https://mail.163.com/js6/main.jsp?df=mail163_letter'
  );
});

test('VPS verify detects an expired authorization link when the status says not pending', () => {
  assert.equal(
    isVpsAuthorizationNotPendingText('This authorization link is not pending anymore.'),
    true
  );
  assert.equal(
    isVpsAuthorizationNotPendingText('授权链接 is not pending，请重新获取后再试。'),
    true
  );
});

test('VPS verify ignores unrelated status text when checking not-pending auth errors', () => {
  assert.equal(
    isVpsAuthorizationNotPendingText('认证成功！'),
    false
  );
  assert.equal(
    isVpsAuthorizationNotPendingText('502 Bad Gateway'),
    false
  );
});

test('step 8 recovery detects when the auth flow lands on a non-localhost page', () => {
  assert.equal(
    getStep6RecoveryReasonForUnexpectedAuthPage({
      currentUrl: 'https://status.openai.com/error?request_id=test',
      currentPageText: 'OpenAI status incident',
      expectedUrl: 'https://auth.openai.com/oauth/authorize?client_id=test',
    }),
    'unexpected_auth_redirect'
  );
});

test('step 8 recovery detects transient auth server error pages before localhost', () => {
  assert.equal(
    getStep6RecoveryReasonForUnexpectedAuthPage({
      currentUrl: 'https://auth.openai.com/oauth/authorize?client_id=test',
      currentPageText: '502 Bad Gateway',
      expectedUrl: 'https://auth.openai.com/oauth/authorize?client_id=test',
    }),
    'auth_server_error'
  );
});

test('step 8 recovery ignores the expected localhost callback', () => {
  assert.equal(
    getStep6RecoveryReasonForUnexpectedAuthPage({
      currentUrl: 'http://localhost:1455/auth/callback?code=test',
      currentPageText: '',
      expectedUrl: 'https://auth.openai.com/oauth/authorize?client_id=test',
    }),
    ''
  );
});

test('step 8 recovery ignores normal OpenAI auth-domain pages before localhost', () => {
  assert.equal(
    getStep6RecoveryReasonForUnexpectedAuthPage({
      currentUrl: 'https://auth.openai.com/u/login/identifier?state=test',
      currentPageText: 'Continue to Codex',
      expectedUrl: 'https://auth.openai.com/oauth/authorize?client_id=test',
    }),
    ''
  );
});
