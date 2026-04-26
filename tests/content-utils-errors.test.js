const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUtilsContext(overrides = {}) {
  const sentMessages = [];
  const listeners = [];
  const context = {
    console: {
      log() {},
      warn() {},
      error() {},
    },
    location: { href: 'https://auth.openai.com/create-account' },
    document: {
      body: { innerText: '' },
      documentElement: {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    chrome: {
      runtime: {
        onMessage: {
          addListener(listener) {
            listeners.push(listener);
          },
        },
        sendMessage(message) {
          sentMessages.push(message);
        },
      },
    },
    MutationObserver: class {
      disconnect() {}
      observe() {}
    },
    Event: class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    MouseEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    KeyboardEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    InputEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    Date,
    setTimeout,
    clearTimeout,
    ...overrides,
  };

  context.window = context;
  context.top = context;
  context.__listeners = listeners;
  context.__sentMessages = sentMessages;

  const scriptPath = path.join(__dirname, '..', 'content', 'utils.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context, { filename: scriptPath });

  return context;
}

async function collectUnhandledRejections(run) {
  const reasons = [];
  const handler = (reason) => {
    reasons.push(reason);
  };

  process.on('unhandledRejection', handler);
  try {
    run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.off('unhandledRejection', handler);
  }

  return reasons;
}

test('reportError emits step error without a duplicate LOG message', () => {
  const context = loadUtilsContext();
  context.__sentMessages.length = 0;

  context.reportError(7, 'Phone verification required');

  assert.deepEqual(
    context.__sentMessages.map((message) => message.type),
    ['STEP_ERROR']
  );
});

test('reportComplete returns the runtime delivery promise for navigation-sensitive steps', async () => {
  const context = loadUtilsContext();
  context.__sentMessages.length = 0;

  let resolveDelivery;
  const deliveryPromise = new Promise((resolve) => {
    resolveDelivery = resolve;
  });

  context.chrome.runtime.sendMessage = (message) => {
    context.__sentMessages.push(message);
    return deliveryPromise;
  };

  const reportPromise = context.reportComplete(2, { recovered: false });

  assert.equal(reportPromise, deliveryPromise);
  assert.deepEqual(
    context.__sentMessages.map((message) => message.type),
    ['LOG', 'STEP_COMPLETE']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.__sentMessages.at(-1))),
    {
      type: 'STEP_COMPLETE',
      source: 'signup-page',
      step: 2,
      payload: { recovered: false },
      error: null,
    }
  );

  resolveDelivery({ ok: true });
  await reportPromise;
});

test('reportComplete ignores transient closed-channel errors when callers fire-and-forget the completion signal', async () => {
  const disconnectedError = new Error('A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received');
  const context = loadUtilsContext();
  context.chrome.runtime.sendMessage = (message) => {
    context.__sentMessages.push(message);
    return Promise.reject(disconnectedError);
  };

  context.__sentMessages.length = 0;

  const rejections = await collectUnhandledRejections(() => {
    context.reportComplete(5, { recovered: false });
  });

  assert.equal(rejections.length, 0);
  assert.deepEqual(
    context.__sentMessages.map((message) => message.type),
    ['LOG', 'STEP_COMPLETE']
  );
});

test('fire-and-forget runtime messages ignore transient receiving-end disconnects during extension reload', async () => {
  const disconnectedError = new Error('Could not establish connection. Receiving end does not exist.');
  const context = loadUtilsContext();
  context.chrome.runtime.sendMessage = () => Promise.reject(disconnectedError);

  context.__sentMessages.length = 0;

  const rejections = await collectUnhandledRejections(() => {
    context.log('still loading');
    context.reportReady();
    context.reportError(7, 'Phone verification required');
  });

  assert.equal(rejections.length, 0);
});

test('simulateClick prefers the element native click handler when available', () => {
  const context = loadUtilsContext();
  let nativeClickCalls = 0;
  let dispatchedClickCalls = 0;

  const button = {
    tagName: 'BUTTON',
    textContent: 'New Email',
    click() {
      nativeClickCalls += 1;
    },
    dispatchEvent(event) {
      if (event?.type === 'click') {
        dispatchedClickCalls += 1;
      }
      return true;
    },
  };

  context.simulateClick(button);

  assert.equal(nativeClickCalls, 1);
  assert.equal(dispatchedClickCalls, 0);
});

test('resetStopState does not clear a newer stop request than the current command', () => {
  const context = loadUtilsContext();
  const stopListener = context.__listeners[0];
  assert.equal(typeof stopListener, 'function');

  stopListener({ type: 'STOP_FLOW', controlSequence: 9 });
  context.resetStopState(7);

  assert.equal(context.__MULTIPAGE_UTILS_STATE.flowStopped, true);
  assert.throws(() => context.throwIfStopped(), /Flow stopped by user\./);
});

test('resetStopState clears an older stop request when a newer command starts', () => {
  const context = loadUtilsContext();
  const stopListener = context.__listeners[0];
  assert.equal(typeof stopListener, 'function');

  stopListener({ type: 'STOP_FLOW', controlSequence: 4 });
  context.resetStopState(8);

  assert.equal(context.__MULTIPAGE_UTILS_STATE.flowStopped, false);
  assert.doesNotThrow(() => context.throwIfStopped());
});
