const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildToastKey,
  canonicalizeToastMessage,
  getToastDuration,
  shouldSuppressToastMessage,
  TOAST_DURATIONS,
} = require('../shared/toast-feedback.js');

test('canonicalizeToastMessage removes repeated step and run failure prefixes', () => {
  assert.equal(
    canonicalizeToastMessage('[signup-page] Step 7 failed: Could not find verification code input.'),
    'Could not find verification code input.'
  );

  assert.equal(
    canonicalizeToastMessage('Run 1/5 failed: Could not find verification code input.'),
    'Could not find verification code input.'
  );
});

test('canonicalizeToastMessage keeps unrelated messages intact', () => {
  assert.equal(
    canonicalizeToastMessage('验证码错误，请返回邮箱刷新'),
    '验证码错误，请返回邮箱刷新'
  );
});

test('getToastDuration uses type defaults unless overridden', () => {
  assert.equal(getToastDuration('error'), TOAST_DURATIONS.error);
  assert.equal(getToastDuration('warn'), TOAST_DURATIONS.warn);
  assert.equal(getToastDuration('success', 3200), 3200);
});

test('buildToastKey merges repeated step error variants into one key', () => {
  assert.equal(
    buildToastKey('[signup-page] Step 7 failed: Could not find verification code input.', 'error'),
    buildToastKey('Run 1/5 failed: Could not find verification code input.', 'error')
  );
});

test('shouldSuppressToastMessage hides recoverable BFCache disconnect errors', () => {
  assert.equal(
    shouldSuppressToastMessage(
      'The page keeping the extension port is moved into back/forward cache, so the message channel is closed.',
      'error'
    ),
    true
  );
  assert.equal(
    shouldSuppressToastMessage(
      'Could not establish connection. Receiving end does not exist.',
      'error'
    ),
    true
  );
});

test('shouldSuppressToastMessage hides the manual stop progress toast', () => {
  assert.equal(
    shouldSuppressToastMessage('Stopping...', 'warn'),
    true
  );
});

test('shouldSuppressToastMessage keeps normal errors visible', () => {
  assert.equal(
    shouldSuppressToastMessage('No matching verification email found after 60s', 'error'),
    false
  );
});
