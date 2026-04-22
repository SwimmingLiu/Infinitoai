const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test: base, expect, chromium } = require('@playwright/test');

function resolveBrowserLaunchOptions() {
  const explicitPath = process.env.PW_EXTENSION_BROWSER_PATH;
  if (explicitPath) {
    return {
      executablePath: explicitPath,
      headless: false,
    };
  }

  const windowsEdgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (process.platform === 'win32' && fs.existsSync(windowsEdgePath)) {
    return {
      executablePath: windowsEdgePath,
      headless: false,
    };
  }

  return {
    channel: 'chromium',
    headless: false,
  };
}

async function waitForServiceWorker(context) {
  const existing = context.serviceWorkers();
  if (existing.length > 0) {
    return existing[0];
  }
  return await context.waitForEvent('serviceworker', { timeout: 30000 });
}

const test = base.extend({
  extension: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '..', '..', '..');
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'infinitoai-playwright-'));
    const launchOptions = resolveBrowserLaunchOptions();

    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOptions,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      const serviceWorker = await waitForServiceWorker(context);
      const extensionId = new URL(serviceWorker.url()).host;

      await use({
        id: extensionId,
        context,
        serviceWorker: () => serviceWorker,
        openExtensionPage: async (relativePath) => {
          const page = await context.newPage();
          await page.goto(`chrome-extension://${extensionId}/${relativePath}`, {
            waitUntil: 'domcontentloaded',
          });
          return page;
        },
        openSidepanelPage: async () => {
          const page = await context.newPage();
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`, {
            waitUntil: 'domcontentloaded',
          });
          return page;
        },
      });
    } finally {
      await context.close();
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  },
});

module.exports = { test, expect };
