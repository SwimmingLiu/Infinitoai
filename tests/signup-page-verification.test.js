const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createContext({
  href = 'https://auth.openai.com/email-verification',
  bodyText = '',
  waitForElementImpl,
  querySelectorImpl,
  querySelectorAllImpl,
  reportCompleteImpl,
} = {}) {
  const listeners = [];
  const errors = [];
  const completions = [];

  class StubEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    location: { href },
    document: {
      body: { innerText: bodyText },
      documentElement: {},
      querySelector(selector) {
        return querySelectorImpl ? querySelectorImpl(selector) : null;
      },
      querySelectorAll(selector) {
        return querySelectorAllImpl ? querySelectorAllImpl(selector) : [];
      },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
        sendMessage() {
          return Promise.resolve({ ok: true });
        },
      },
    },
    VerificationCode: {
      isVerificationCodeRejectedText() {
        return false;
      },
      isVerificationRetryStateText(text) {
        return /retry/i.test(text);
      },
    },
    PhoneVerification: {
      isPhoneVerificationRequiredText() {
        return false;
      },
      getPhoneVerificationBlockedMessage(step) {
        return `Step ${step} blocked: phone verification is required on the auth page.`;
      },
    },
    AuthFatalErrors: {
      isAuthFatalErrorText() {
        return false;
      },
    },
    UnsupportedEmail: {
      isUnsupportedEmailText() {
        return false;
      },
      isUnsupportedEmailBlockingStep() {
        return false;
      },
      getUnsupportedEmailBlockedMessage(step) {
        return `Step ${step} blocked`;
      },
    },
    MutationObserver: class {
      disconnect() {}
      observe() {}
    },
    Event: StubEvent,
    MouseEvent: StubEvent,
    KeyboardEvent: StubEvent,
    InputEvent: StubEvent,
    setTimeout,
    clearTimeout,
    Date,
    getComputedStyle() {
      return {
        display: 'block',
        visibility: 'visible',
        opacity: '1',
      };
    },
    resetStopState() {},
    isStopError() {
      return false;
    },
    log() {},
    reportComplete(step, payload) {
      completions.push({ step, payload });
      if (typeof reportCompleteImpl === 'function') {
        reportCompleteImpl(step, payload);
      }
    },
    reportError(step, message) {
      errors.push({ step, message });
    },
    throwIfStopped() {},
    sleep() {
      return Promise.resolve();
    },
    humanPause() {
      return Promise.resolve();
    },
    simulateClick() {},
    fillInput() {},
    waitForElement(selector) {
      if (waitForElementImpl) {
        return waitForElementImpl(selector);
      }
      return Promise.reject(new Error('missing'));
    },
    waitForElementByText() {
      return Promise.reject(new Error('missing'));
    },
    isElementVisible() {
      return true;
    },
  };

  context.window = context;
  context.top = context;
  context.__listeners = listeners;
  context.__errors = errors;
  context.__completions = completions;
  return context;
}

function loadSignupPage(context) {
  const scriptPath = path.join(__dirname, '..', 'content', 'signup-page.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });
}

test('step 7 fails the round when email verification page has retry text but no code input', async () => {
  const context = createContext({
    bodyText: 'Something went wrong. Please retry.',
  });
  loadSignupPage(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected signup-page to register a runtime listener');

  const response = await new Promise((resolve, reject) => {
    const keepAlive = listener(
      { type: 'FILL_CODE', step: 7, payload: { code: '123456' } },
      {},
      (result) => resolve(result)
    );
    assert.equal(keepAlive, true);
    setTimeout(() => reject(new Error('timeout waiting for response')), 2000);
  });

  assert.match(
    response?.error || '',
    /retry state before the code input appeared/i
  );
  assert.deepEqual(context.__errors, [
    {
      step: 7,
      message: response.error,
    },
  ]);
});

test('step 7 does not treat a post-submit retry page as accepted when the code input disappears', async () => {
  const state = {
    bodyText: 'Enter the 6-digit code',
    hideInputsAfterSubmit: false,
  };
  const submitButton = {};
  const codeInput = {};

  const context = createContext({
    bodyText: state.bodyText,
    waitForElementImpl(selector) {
      if (/input/.test(selector)) {
        return Promise.resolve(codeInput);
      }
      return Promise.reject(new Error('missing'));
    },
    querySelectorImpl(selector) {
      if (selector === 'button[type="submit"]') {
        return submitButton;
      }
      return null;
    },
    querySelectorAllImpl(selector) {
      if (state.hideInputsAfterSubmit) {
        return [];
      }
      if (selector.includes('input')) {
        return [{}];
      }
      return [];
    },
  });
  context.fillInput = () => {};
  context.simulateClick = () => {
    state.bodyText = 'Something went wrong. Please retry.';
    context.document.body.innerText = state.bodyText;
    state.hideInputsAfterSubmit = true;
  };

  loadSignupPage(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected signup-page to register a runtime listener');

  const response = await new Promise((resolve, reject) => {
    const keepAlive = listener(
      { type: 'FILL_CODE', step: 7, payload: { code: '123456' } },
      {},
      (result) => resolve(result)
    );
    assert.equal(keepAlive, true);
    setTimeout(() => reject(new Error('timeout waiting for response')), 2000);
  });

  assert.match(
    response?.error || '',
    /retry state after submitting the verification code/i
  );
});

test('step 6 fails instead of completing when the login page shows incorrect email or password', async () => {
  const state = {
    bodyText: '输入密码',
    passwordVisible: true,
    submitCount: 0,
  };

  const createVisibleElement = () => ({
    getBoundingClientRect() {
      return { width: 120, height: 40 };
    },
  });

  const emailInput = createVisibleElement();
  const passwordInput = createVisibleElement();
  const submitButton = createVisibleElement();

  const context = createContext({
    href: 'https://auth.openai.com/u/login/password',
    bodyText: state.bodyText,
    waitForElementImpl(selector) {
      if (selector.includes('type="email"') || selector.includes('name="email"')) {
        return Promise.resolve(emailInput);
      }
      return Promise.reject(new Error(`missing: ${selector}`));
    },
    querySelectorImpl(selector) {
      if (selector === 'button[type="submit"]') {
        return submitButton;
      }
      return null;
    },
    querySelectorAllImpl(selector) {
      if (selector === 'input[type="password"]' && state.passwordVisible) {
        return [passwordInput];
      }
      return [];
    },
  });

  context.fillInput = () => {};
  context.simulateClick = () => {
    state.submitCount += 1;
    if (state.submitCount === 2) {
      state.bodyText = 'Incorrect email address or password';
      context.document.body.innerText = state.bodyText;
    }
  };

  loadSignupPage(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected signup-page to register a runtime listener');

  const response = await new Promise((resolve, reject) => {
    const keepAlive = listener(
      { type: 'EXECUTE_STEP', step: 6, payload: { email: 'demo@example.com', password: 'wrong-pass' } },
      {},
      (result) => resolve(result)
    );
    assert.equal(keepAlive, true);
    setTimeout(() => reject(new Error('timeout waiting for response')), 3000);
  });

  assert.match(response?.error || '', /incorrect email address or password/i);
  assert.deepEqual(context.__completions, []);
  assert.deepEqual(context.__errors, [
    {
      step: 6,
      message: response.error,
    },
  ]);
});
