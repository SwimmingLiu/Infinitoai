const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const DEFAULT_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function resolveChromeExecutablePath(options = {}) {
  const explicitPath = options.explicitPath !== undefined
    ? options.explicitPath
    : process.env.PW_EXTENSION_BROWSER_PATH;
  const pathExists = typeof options.pathExists === 'function'
    ? options.pathExists
    : fs.existsSync;

  if (explicitPath) {
    return explicitPath;
  }

  for (const candidate of DEFAULT_CHROME_PATHS) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Chrome executable was not found. Set PW_EXTENSION_BROWSER_PATH to a Chrome browser path.');
}

async function waitForExtensionServiceWorker(browser, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 30000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const target = browser.targets().find((candidate) =>
      candidate.type() === 'service_worker'
      && /chrome-extension:\/\/.+\/background\.js$/i.test(candidate.url())
    );
    if (target) {
      return target;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for extension service worker ending in /background.js after ${timeoutMs}ms.`);
}

async function launchChromeExtension(extensionPath, options = {}) {
  const executablePath = resolveChromeExecutablePath({
    explicitPath: options.executablePath,
    pathExists: options.pathExists,
  });
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    pipe: true,
    enableExtensions: [extensionPath],
    defaultViewport: { width: 1280, height: 900 },
  });

  const serviceWorkerTarget = await waitForExtensionServiceWorker(browser, options);
  const extensionId = new URL(serviceWorkerTarget.url()).host;

  return {
    browser,
    extensionId,
    serviceWorkerTarget,
  };
}

async function openExtensionPage(browser, extensionId, relativePath) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = request.url();
    if (/^https:\/\/fonts\.googleapis\.com\//i.test(url)) {
      request.respond({
        status: 200,
        contentType: 'text/css',
        body: '',
      }).catch(() => {});
      return;
    }

    if (/^https:\/\/fonts\.gstatic\.com\//i.test(url)) {
      request.abort('blockedbyclient').catch(() => {});
      return;
    }

    request.continue().catch(() => {});
  });
  await page.goto(`chrome-extension://${extensionId}/${relativePath}`, {
    waitUntil: 'domcontentloaded',
    timeout: 3000,
  }).catch(async (error) => {
    const currentUrl = page.url();
    if (!currentUrl.includes(`chrome-extension://${extensionId}/${relativePath}`)) {
      throw error;
    }
  });
  return page;
}

module.exports = {
  launchChromeExtension,
  openExtensionPage,
  resolveChromeExecutablePath,
  waitForExtensionServiceWorker,
};
