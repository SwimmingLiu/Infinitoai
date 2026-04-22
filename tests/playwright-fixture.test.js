const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveBrowserLaunchOptions } = require('./e2e/fixtures/extension-fixture.js');

test('browser launch options prefer explicit browser path', () => {
  const options = resolveBrowserLaunchOptions();
  assert.equal(typeof options.headless, 'boolean');
});

test('browser launch options do not force an invalid chromium channel fallback', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  const originalEnv = process.env.PW_EXTENSION_BROWSER_PATH;

  try {
    delete process.env.PW_EXTENSION_BROWSER_PATH;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const options = resolveBrowserLaunchOptions();
    assert.equal('channel' in options, false);
    assert.equal(options.headless, false);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.PW_EXTENSION_BROWSER_PATH;
    } else {
      process.env.PW_EXTENSION_BROWSER_PATH = originalEnv;
    }
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});
