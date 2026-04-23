const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createContext() {
  const listeners = [];
  const state = {
    logs: [],
    runtimeMessages: [],
    stopRequested: false,
    resetStopStateCalls: 0,
    reportedErrors: [],
    sleepCalls: 0,
  };

  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    location: { href: 'https://2925.com/#/mailList' },
    chrome: {
      runtime: {
        sendMessage(message, callback) {
          state.runtimeMessages.push(message);
          const response = { ok: true };
          if (typeof callback === 'function') callback(response);
          return Promise.resolve(response);
        },
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
      },
    },
    MailMatching: require('../shared/mail-matching.js'),
    MailFreshness: require('../shared/mail-freshness.js'),
    LatestMail: require('../shared/latest-mail.js'),
    resetStopState() {
      state.resetStopStateCalls += 1;
      state.stopRequested = false;
    },
    isStopError(error) {
      return /stopped by user/i.test(String(error?.message || error || ''));
    },
    throwIfStopped() {
      if (state.stopRequested) {
        throw new Error('Flow stopped by user.');
      }
    },
    reportError(step, message) {
      state.reportedErrors.push({ step, message });
    },
    log(message, level = 'info') {
      state.logs.push({ message, level });
    },
    sleep: async () => {
      state.sleepCalls += 1;
    },
    setTimeout,
    clearTimeout,
    MouseEvent: function MouseEvent(type, init = {}) {
      return { type, ...init };
    },
    document: null,
    window: null,
    top: null,
  };

  const mailItem = {
    textContent: 'Your ChatGPT code is 654321',
    querySelector(selector) {
      if (selector === '.mail-content-title') {
        return {
          getAttribute(name) {
            return name === 'title' ? 'Your ChatGPT code is 654321' : '';
          },
          textContent: 'Your ChatGPT code is 654321',
        };
      }
      if (selector === '.mail-content-text') {
        return { textContent: 'OpenAI verification email' };
      }
      if (selector === 'td.content, .content, .mail-content') {
        return { textContent: 'Your ChatGPT code is 654321 OpenAI verification email' };
      }
      if (selector === 'td.sender, .sender') {
        return {
          querySelector(innerSelector) {
            if (innerSelector === '.ivu-tooltip-rel') {
              return { textContent: 'OpenAI' };
            }
            if (innerSelector === '.ivu-tooltip-inner') {
              return { textContent: 'noreply@tm.openai.com' };
            }
            return null;
          },
          textContent: 'OpenAI noreply@tm.openai.com',
        };
      }
      if (selector === '.date-time-text, [class*="date-time"], [class*="time"], td.time') {
        return null;
      }
      return null;
    },
    getAttribute() {
      return '';
    },
    dispatchEvent() {
      return true;
    },
  };

  context.document = {
    body: {
      innerText: 'Your ChatGPT code is 654321',
      textContent: 'Your ChatGPT code is 654321',
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.mail-item') {
        return [mailItem];
      }
      return [];
    },
  };
  context.window = context;
  context.top = context;
  context.__state = state;
  context.__listeners = listeners;
  return context;
}

function loadMail2925Script(context) {
  const scriptPath = path.join(__dirname, '..', 'content', 'mail-2925.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });
}

test('mail-2925 accepts the newest matching row even when the list timestamp is unavailable', async () => {
  const context = createContext();
  const state = context.__state;

  loadMail2925Script(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected the 2925 content script to register a runtime listener');

  const result = await new Promise((resolve, reject) => {
    const response = listener({
      type: 'POLL_EMAIL',
      step: 7,
      payload: {
        senderFilters: ['openai', 'tm.openai.com'],
        subjectFilters: ['chatgpt', 'code'],
        maxAttempts: 1,
        intervalMs: 0,
        filterAfterTimestamp: Date.now() - 60 * 1000,
        excludeCodes: [],
        targetEmail: 'demo_abcd@2925.com',
      },
    }, {}, (value) => resolve(value));

    if (response !== true) {
      reject(new Error('expected async response from mail-2925 listener'));
    }
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.code, '654321');
  assert.equal(state.resetStopStateCalls, 1);
  assert.ok(
    state.logs.some((entry) => /Starting email poll on 2925 Mail/i.test(entry.message)),
    'expected the 2925 poll flow to emit a start log'
  );
});

test('mail-2925 exits promptly when a stop request lands during polling', async () => {
  const context = createContext();
  const state = context.__state;

  context.document.querySelectorAll = () => [];
  context.sleep = async () => {
    state.sleepCalls += 1;
    state.stopRequested = true;
  };

  loadMail2925Script(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected the 2925 content script to register a runtime listener');

  const result = await new Promise((resolve, reject) => {
    const response = listener({
      type: 'POLL_EMAIL',
      step: 4,
      controlSequence: 7,
      payload: {
        senderFilters: ['openai'],
        subjectFilters: ['chatgpt'],
        maxAttempts: 2,
        intervalMs: 500,
        filterAfterTimestamp: Date.now() - 60 * 1000,
        excludeCodes: [],
        targetEmail: '',
      },
    }, {}, (value) => resolve(value));

    if (response !== true) {
      reject(new Error('expected async response from mail-2925 listener'));
    }
  });

  assert.equal(result?.stopped, true);
  assert.match(String(result?.error || ''), /Flow stopped by user/i);
  assert.equal(state.resetStopStateCalls, 1);
  assert.ok(
    state.logs.some((entry) => /Stopped by user/i.test(entry.message)),
    'expected stop handling to log a user stop message'
  );
  assert.equal(state.reportedErrors.length, 0);
});

test('mail-2925 opens the matching mail detail when the list row has no visible code yet', async () => {
  const context = createContext();
  const state = context.__state;
  let detailOpened = false;

  const mailItem = {
    textContent: 'OpenAI verification email',
    querySelector(selector) {
      if (selector === '.mail-content-title') {
        return {
          getAttribute(name) {
            return name === 'title' ? 'Your ChatGPT verification code' : '';
          },
          textContent: 'Your ChatGPT verification code',
        };
      }
      if (selector === '.mail-content-text') {
        return { textContent: 'OpenAI security message' };
      }
      if (selector === 'td.content, .content, .mail-content') {
        return { textContent: 'OpenAI security message' };
      }
      if (selector === 'td.sender, .sender') {
        return {
          querySelector(innerSelector) {
            if (innerSelector === '.ivu-tooltip-rel') {
              return { textContent: 'OpenAI' };
            }
            if (innerSelector === '.ivu-tooltip-inner') {
              return { textContent: 'noreply@tm.openai.com' };
            }
            return null;
          },
          textContent: 'OpenAI noreply@tm.openai.com',
        };
      }
      if (selector === '.date-time-text, [class*="date-time"], [class*="time"], td.time') {
        return null;
      }
      return null;
    },
    getAttribute() {
      return '';
    },
    dispatchEvent(event) {
      if (event?.type === 'click') {
        detailOpened = true;
      }
      return true;
    },
  };

  context.document.body = {
    get innerText() {
      return detailOpened ? 'Your ChatGPT code is 112233' : 'Inbox overview';
    },
    get textContent() {
      return detailOpened ? 'Your ChatGPT code is 112233' : 'Inbox overview';
    },
  };
  context.document.querySelectorAll = (selector) => {
    if (selector === '.mail-item') {
      return [mailItem];
    }
    return [];
  };

  loadMail2925Script(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected the 2925 content script to register a runtime listener');

  const result = await new Promise((resolve, reject) => {
    const response = listener({
      type: 'POLL_EMAIL',
      step: 4,
      payload: {
        senderFilters: ['openai', 'tm.openai.com'],
        subjectFilters: ['verify', 'email'],
        maxAttempts: 1,
        intervalMs: 0,
        filterAfterTimestamp: Date.now() - 60 * 1000,
        excludeCodes: [],
        targetEmail: '',
      },
    }, {}, (value) => resolve(value));

    if (response !== true) {
      reject(new Error('expected async response from mail-2925 listener'));
    }
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.code, '112233');
  assert.equal(detailOpened, true);
});

test('mail-2925 waits for the detail view to finish loading before reading the code from body text', async () => {
  const context = createContext();
  const state = context.__state;
  let detailOpened = false;
  let detailReady = false;

  const mailItem = {
    textContent: 'OpenAI verification email',
    querySelector(selector) {
      if (selector === '.mail-content-title') {
        return {
          getAttribute(name) {
            return name === 'title' ? 'Your ChatGPT verification code' : '';
          },
          textContent: 'Your ChatGPT verification code',
        };
      }
      if (selector === '.mail-content-text') {
        return { textContent: 'OpenAI security message' };
      }
      if (selector === 'td.content, .content, .mail-content') {
        return { textContent: 'OpenAI security message' };
      }
      if (selector === 'td.sender, .sender') {
        return {
          querySelector(innerSelector) {
            if (innerSelector === '.ivu-tooltip-rel') {
              return { textContent: 'OpenAI' };
            }
            if (innerSelector === '.ivu-tooltip-inner') {
              return { textContent: 'noreply@tm.openai.com' };
            }
            return null;
          },
          textContent: 'OpenAI noreply@tm.openai.com',
        };
      }
      if (selector === '.date-time-text, [class*="date-time"], [class*="time"], td.time') {
        return null;
      }
      return null;
    },
    getAttribute() {
      return '';
    },
    dispatchEvent(event) {
      if (event?.type === 'click') {
        detailOpened = true;
      }
      return true;
    },
  };

  context.sleep = async () => {
    state.sleepCalls += 1;
    if (detailOpened && state.sleepCalls >= 20) {
      detailReady = true;
    }
  };
  context.document.body = {
    get innerText() {
      return detailReady ? 'Your ChatGPT code is 445566' : 'Opening message...';
    },
    get textContent() {
      return detailReady ? 'Your ChatGPT code is 445566' : 'Opening message...';
    },
  };
  context.document.querySelector = (selector) => {
    if (detailReady && selector === 'div.delete[data-t="删除"][title="删除"].tool-common') {
      return { offsetParent: {} };
    }
    return null;
  };
  context.document.querySelectorAll = (selector) => {
    if (selector === '.mail-item') {
      return [mailItem];
    }
    return [];
  };

  loadMail2925Script(context);

  const listener = context.__listeners[0];
  assert.ok(listener, 'expected the 2925 content script to register a runtime listener');

  const result = await new Promise((resolve, reject) => {
    const response = listener({
      type: 'POLL_EMAIL',
      step: 4,
      payload: {
        senderFilters: ['openai', 'tm.openai.com'],
        subjectFilters: ['verify', 'email'],
        maxAttempts: 1,
        intervalMs: 0,
        filterAfterTimestamp: Date.now() - 60 * 1000,
        excludeCodes: [],
        targetEmail: '',
      },
    }, {}, (value) => resolve(value));

    if (response !== true) {
      reject(new Error('expected async response from mail-2925 listener'));
    }
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.code, '445566');
  assert.equal(detailOpened, true);
  assert.equal(detailReady, true);
});
