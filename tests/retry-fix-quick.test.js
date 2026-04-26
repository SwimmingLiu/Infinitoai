const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createContext({
  href = 'https://auth.openai.com/email-verification',
  bodyText = '',
} = {}) {
  const errors = [];
  const completions = [];
  const listeners = [];

  class StubEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  const context = {
    console: { log() {}, warn() {}, error() {} },
    location: { href },
    document: {
      body: { innerText: bodyText },
      documentElement: {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      elementFromPoint() { return null; },
    },
    chrome: {
      runtime: {
        onMessage: { addListener(fn) { listeners.push(fn); } },
        sendMessage() { return Promise.resolve({ ok: true }); },
      },
    },
    VerificationCode: {
      isVerificationCodeRejectedText() { return false; },
      isVerificationRetryStateText(text) {
        return /retry|something went wrong|please retry/i.test(String(text || ''));
      },
    },
    PhoneVerification: {
      isPhoneVerificationRequiredText() { return false; },
      getPhoneVerificationBlockedMessage(step) { return `Step ${step} blocked: phone verification required.`; },
    },
    AuthFatalErrors: {
      isAuthOperationTimedOutText() { return false; },
      getAuthOperationTimedOutMessage() { return ''; },
      isAuthFatalErrorText() { return false; },
      isUnsupportedCountryRegionTerritoryText() { return false; },
      getUnsupportedCountryRegionTerritoryMessage() { return ''; },
    },
    UnsupportedEmail: {
      isUnsupportedEmailText() { return false; },
      isUnsupportedEmailBlockingStep() { return false; },
      getUnsupportedEmailBlockedMessage() { return ''; },
    },
    MutationObserver: class { disconnect() {} observe() {} },
    Event: StubEvent,
    MouseEvent: StubEvent,
    KeyboardEvent: StubEvent,
    InputEvent: StubEvent,
    setTimeout,
    clearTimeout,
    Date,
    getComputedStyle() {
      return { display: 'block', visibility: 'visible', opacity: '1' };
    },
    resetStopState() {},
    isStopError() { return false; },
    log() {},
    reportComplete(step, payload) { completions.push({ step, payload }); },
    reportError(step, message) { errors.push({ step, message }); },
    throwIfStopped() {},
    sleep() { return Promise.resolve(); },
    humanPause() { return Promise.resolve(); },
    simulateClick() {},
    fillInput() {},
    waitForElement() { return Promise.reject(new Error('missing')); },
    waitForElementByText() { return Promise.reject(new Error('missing')); },
    isElementVisible() { return true; },
  };

  context.window = context;
  context.top = context;
  context.__listeners = listeners;
  context.__errors = errors;
  context.__completions = completions;
  return context;
}

function loadSignupPageBundle(context) {
  const scriptPaths = [
    path.join(__dirname, '..', 'content', 'signup-page.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step3-flow.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step6-flow.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step2-handler.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step3-handler.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step5-handler.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step6-handler.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-step8-handler.js'),
    path.join(__dirname, '..', 'content', 'openai-auth-actions-handler.js'),
  ];

  vm.createContext(context);
  for (const scriptPath of scriptPaths) {
    vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });
  }
}

function createVerificationContext(step, clickBehavior) {
  const state = {
    bodyText: 'Enter the 6-digit code',
    hideInputsAfterSubmit: false,
    clickCount: 0,
  };
  const submitButton = {};
  const codeInput = {};
  const context = createContext({ bodyText: state.bodyText });

  context.waitForElement = (selector) => {
    if (/input/.test(selector)) {
      return Promise.resolve(codeInput);
    }
    return Promise.reject(new Error('missing'));
  };
  context.document.querySelector = (selector) => {
    if (selector === 'button[type="submit"]') {
      return submitButton;
    }
    return null;
  };
  context.document.querySelectorAll = (selector) => {
    if (state.hideInputsAfterSubmit) {
      return [];
    }
    if (selector.includes('input')) {
      return [{}];
    }
    return [];
  };
  context.fillInput = () => {};
  context.simulateClick = () => {
    state.clickCount += 1;
    clickBehavior({ context, state });
  };

  loadSignupPageBundle(context);

  return { context, state };
}

async function sendFillCode(context, step, code) {
  const listener = context.__listeners[0];
  assert.ok(listener, 'expected signup-page bundle to register a runtime listener');

  return await new Promise((resolve, reject) => {
    listener({ type: 'FILL_CODE', step, payload: { code } }, {}, (result) => resolve(result));
    setTimeout(() => reject(new Error('timeout')), 3000);
  });
}

test('step 4 returns to inbox polling when verification page enters retry state after submit', async () => {
  const { context } = createVerificationContext(4, ({ context, state }) => {
    state.bodyText = 'Something went wrong. Please retry.';
    context.document.body.innerText = state.bodyText;
    state.hideInputsAfterSubmit = true;
  });

  const response = await sendFillCode(context, 4, '123456');

  assert.equal(response?.ok, true);
  assert.equal(response?.retryInbox, true);
  assert.equal(response?.reason, 'verification-page-retry-state');
  assert.deepEqual(context.__errors, []);
  assert.deepEqual(context.__completions, []);
});

test('step 7 also returns to inbox polling when verification page enters retry state after submit', async () => {
  const { context } = createVerificationContext(7, ({ context, state }) => {
    state.bodyText = 'Please retry.';
    context.document.body.innerText = state.bodyText;
    state.hideInputsAfterSubmit = true;
  });

  const response = await sendFillCode(context, 7, '654321');

  assert.equal(response?.ok, true);
  assert.equal(response?.retryInbox, true);
  assert.equal(response?.reason, 'verification-page-retry-state');
  assert.deepEqual(context.__errors, []);
  assert.deepEqual(context.__completions, []);
});

test('step 4 still succeeds normally when verification code is accepted', async () => {
  const { context, state } = createVerificationContext(4, ({ context, state }) => {
    state.bodyText = 'Welcome';
    context.document.body.innerText = state.bodyText;
    state.hideInputsAfterSubmit = true;
  });

  const response = await sendFillCode(context, 4, '112233');

  assert.equal(response?.ok, true);
  assert.equal(response?.retryInbox, undefined);
  assert.equal(state.clickCount, 1);
  assert.deepEqual(context.__errors, []);
  assert.deepEqual(context.__completions, [{ step: 4, payload: undefined }]);
});
