const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  launchChromeExtension,
  openExtensionPage,
} = require('./fixtures/chrome-extension-fixture.js');

const extensionPath = path.resolve(__dirname, '..', '..');

test('chrome stable loads the unpacked extension and exposes the background service worker', async () => {
  const { browser, serviceWorkerTarget } = await launchChromeExtension(extensionPath);

  try {
    assert.match(serviceWorkerTarget.url(), /\/background\.js$/i);
  } finally {
    await browser.close();
  }
});

test('chrome stable renders the sidepanel shell with core controls', async () => {
  const { browser, extensionId } = await launchChromeExtension(extensionPath);

  try {
    const page = await openExtensionPage(browser, extensionId, 'sidepanel/sidepanel.html');
    await page.waitForSelector('#input-vps-url', { timeout: 30000 });
    await page.waitForSelector('#select-email-source', { timeout: 30000 });
    await page.waitForSelector('#btn-auto-run', { timeout: 30000 });
    await page.close();
  } finally {
    await browser.close();
  }
});

test('chrome stable toggles source-specific sections for the extension sidepanel', async () => {
  const { browser, extensionId } = await launchChromeExtension(extensionPath);

  try {
    const page = await openExtensionPage(browser, extensionId, 'sidepanel/sidepanel.html');
    await page.waitForSelector('#select-email-source', { timeout: 30000 });

    await page.select('#select-email-source', '33mail');
    await page.waitForFunction(() => {
      const row = document.querySelector('#row-33mail-settings');
      return row && getComputedStyle(row).display !== 'none';
    }, { timeout: 10000 });

    await page.select('#select-email-source', '2925');
    await page.waitForFunction(() => {
      const row = document.querySelector('#row-2925-prefix');
      return row && getComputedStyle(row).display !== 'none';
    }, { timeout: 10000 });

    await page.close();
  } finally {
    await browser.close();
  }
});
