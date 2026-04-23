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
    log(message, level = 'info') {
      state.logs.push({ message, level });
    },
    sleep: async () => {},
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
  assert.ok(
    state.logs.some((entry) => /Starting email poll on 2925 Mail/i.test(entry.message)),
    'expected the 2925 poll flow to emit a start log'
  );
});
