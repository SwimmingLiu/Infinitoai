# Infinitoai Playwright Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为仓库补齐可执行的 Playwright 测试基座，覆盖本地扩展回归、视觉截图回归，以及通过环境变量门控的真实链路 e2e。

**Architecture:** 采用一套共享的扩展加载 fixture，使用 Playwright persistent Chromium context 加载 unpacked extension。测试分为 `local-extension` 与 `real-flow` 两个项目，前者默认稳定运行，后者只在显式提供真实环境变量时执行。

**Tech Stack:** Node.js, npm, @playwright/test, Chromium persistent context, Playwright screenshot assertions

---

### Task 1: Bootstrap Node And Playwright

**Files:**
- Create: `package.json`
- Create: `playwright.config.js`
- Modify: `.gitignore`
- Test: `tests/e2e/local-extension.spec.js`

- [ ] **Step 1: Write the failing Playwright smoke test**

```js
const { test, expect } = require('@playwright/test');

test('loads unpacked extension and finds the background service worker', async ({ extension }) => {
  expect(extension.id).toBeTruthy();
  await expect.poll(async () => {
    return extension.serviceWorker()?.url() || '';
  }).toContain('/background.js');
});
```

- [ ] **Step 2: Run the smoke test before Playwright is installed**

Run: `npx playwright test tests/e2e/local-extension.spec.js`
Expected: FAIL because Playwright config, dependencies, and fixtures do not exist yet.

- [ ] **Step 3: Create the minimal Node project scaffolding**

```json
{
  "name": "infinitoai",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test:unit": "node --test tests/*.test.js",
    "test:e2e": "playwright test --project=local-extension",
    "test:e2e:real": "playwright test --project=real-flow",
    "test:e2e:update": "playwright test --project=local-extension --update-snapshots",
    "test:all": "npm run test:unit && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.51.0"
  }
}
```

```js
// playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'local-extension', testMatch: /local-extension\.spec\.js/ },
    { name: 'real-flow', testMatch: /real-flow\.spec\.js/ },
  ],
});
```

```gitignore
node_modules/
playwright-report/
test-results/
tests/e2e/__screenshots__/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` created and `@playwright/test` installed successfully.

- [ ] **Step 5: Install the Playwright Chromium browser**

Run: `npx playwright install chromium`
Expected: Chromium download completes successfully.

- [ ] **Step 6: Re-run the smoke test to confirm the failure is now fixture-related**

Run: `npx playwright test tests/e2e/local-extension.spec.js`
Expected: FAIL because the shared `extension` fixture is not implemented yet.

- [ ] **Step 7: Commit the scaffolding**

```bash
git add package.json package-lock.json playwright.config.js .gitignore tests/e2e/local-extension.spec.js
git commit -m "test: bootstrap playwright extension harness"
```

### Task 2: Build The Extension Fixture And Local Smoke Coverage

**Files:**
- Create: `tests/e2e/fixtures/extension-fixture.js`
- Create: `tests/e2e/helpers/sidepanel.js`
- Modify: `tests/e2e/local-extension.spec.js`
- Test: `tests/e2e/local-extension.spec.js`

- [ ] **Step 1: Expand the local smoke spec with failing expectations**

```js
const { test, expect } = require('./fixtures/extension-fixture');

test('loads unpacked extension and finds the background service worker', async ({ extension }) => {
  expect(extension.id).toBeTruthy();
  await expect.poll(async () => extension.serviceWorker()?.url() || '').toContain('/background.js');
});

test('renders the sidepanel shell with core controls', async ({ extension }) => {
  const page = await extension.openSidepanelPage();
  await expect(page.locator('#input-vps-url')).toBeVisible();
  await expect(page.locator('#select-email-source')).toBeVisible();
  await expect(page.locator('#btn-auto-run')).toBeVisible();
});
```

- [ ] **Step 2: Run the local spec and verify it fails because the fixture module is missing**

Run: `npx playwright test tests/e2e/local-extension.spec.js --project=local-extension`
Expected: FAIL with missing fixture module or missing `extension` fixture.

- [ ] **Step 3: Implement the persistent extension fixture**

```js
const path = require('node:path');
const { test: base, expect, chromium } = require('@playwright/test');

const test = base.extend({
  extension: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, '..', '..', '..');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = new URL(serviceWorker.url()).host;

    await use({
      id: extensionId,
      context,
      serviceWorker: () => serviceWorker,
      openSidepanelPage: async () => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
        return page;
      },
    });

    await context.close();
  },
});

module.exports = { test, expect };
```

- [ ] **Step 4: Add a sidepanel helper for stable navigation**

```js
async function prepareSidepanelPage(extension) {
  const page = await extension.openSidepanelPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#input-vps-url').waitFor();
  return page;
}

module.exports = { prepareSidepanelPage };
```

- [ ] **Step 5: Re-run the local smoke tests**

Run: `npx playwright test tests/e2e/local-extension.spec.js --project=local-extension`
Expected: PASS for service worker and core sidepanel shell checks.

- [ ] **Step 6: Commit the fixture and smoke coverage**

```bash
git add tests/e2e/fixtures/extension-fixture.js tests/e2e/helpers/sidepanel.js tests/e2e/local-extension.spec.js
git commit -m "test: add playwright extension fixture and smoke coverage"
```

### Task 3: Add Stable UI Interaction And Visual Regression

**Files:**
- Modify: `tests/e2e/local-extension.spec.js`
- Create: `tests/e2e/__screenshots__/.gitkeep`
- Test: `tests/e2e/local-extension.spec.js`

- [ ] **Step 1: Add a failing UI-state and screenshot regression test**

```js
test('toggles source specific sections and keeps the stable panel form visually unchanged', async ({ extension }) => {
  const page = await extension.openSidepanelPage();

  await page.selectOption('#select-email-source', '33mail');
  await expect(page.locator('#row-33mail-settings')).toBeVisible();

  await page.selectOption('#select-email-source', 'tmailor');
  await expect(page.locator('#row-tmailor-domains')).toBeVisible();

  const stableForm = page.locator('#data-section .data-card').first();
  await expect(stableForm).toHaveScreenshot('sidepanel-stable-form.png');
});
```

- [ ] **Step 2: Run the UI-state test and verify the screenshot assertion fails on first run**

Run: `npx playwright test tests/e2e/local-extension.spec.js --project=local-extension`
Expected: FAIL because no screenshot baseline exists yet.

- [ ] **Step 3: Stabilize the page before taking screenshots**

```js
async function stabilizeForScreenshot(page) {
  await page.evaluate(() => {
    const logArea = document.querySelector('#log-area');
    if (logArea) {
      logArea.textContent = '';
    }
    const timer = document.querySelector('#run-target-email-timer');
    if (timer) {
      timer.textContent = 'Timer hidden for visual baseline';
    }
  });
}
```

- [ ] **Step 4: Update the spec to use the stable helper and capture a locator screenshot**

```js
const { prepareSidepanelPage, stabilizeForScreenshot } = require('./helpers/sidepanel');

test('toggles source specific sections and keeps the stable panel form visually unchanged', async ({ extension }) => {
  const page = await prepareSidepanelPage(extension);

  await page.selectOption('#select-email-source', '33mail');
  await expect(page.locator('#row-33mail-settings')).toBeVisible();

  await page.selectOption('#select-email-source', 'tmailor');
  await expect(page.locator('#row-tmailor-domains')).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page.locator('#data-section .data-card').first()).toHaveScreenshot('sidepanel-stable-form.png');
});
```

- [ ] **Step 5: Generate the baseline snapshot**

Run: `npx playwright test tests/e2e/local-extension.spec.js --project=local-extension --update-snapshots`
Expected: PASS and baseline screenshot written under Playwright snapshot output.

- [ ] **Step 6: Re-run the local Playwright suite without updating snapshots**

Run: `npx playwright test --project=local-extension`
Expected: PASS with no visual diffs.

- [ ] **Step 7: Commit the local UI and screenshot coverage**

```bash
git add tests/e2e/local-extension.spec.js tests/e2e/helpers/sidepanel.js tests/e2e/__screenshots__
git commit -m "test: add sidepanel visual regression coverage"
```

### Task 4: Add Real-Flow Environment Gating And Real E2E

**Files:**
- Create: `tests/e2e/helpers/env.js`
- Create: `tests/e2e/real-flow.spec.js`
- Modify: `playwright.config.js`
- Test: `tests/e2e/real-flow.spec.js`

- [ ] **Step 1: Write the failing real-flow test with environment gating**

```js
const { test, expect } = require('./fixtures/extension-fixture');
const { getRealFlowConfig, hasRealFlowConfig } = require('./helpers/env');

test.describe('real flow', () => {
  test.skip(!hasRealFlowConfig(), 'PW_REAL_E2E is disabled or required variables are missing');

  test('runs the real sidepanel flow up to a verifiable milestone', async ({ extension }) => {
    const config = getRealFlowConfig();
    const page = await extension.openSidepanelPage();

    await page.fill('#input-vps-url', config.vpsUrl);
    await page.fill('#input-vps-cpa-password', config.vpsPassword);
    await page.selectOption('#select-email-source', config.emailSource);
    await page.selectOption('#select-mail-provider', config.mailProvider);

    await page.click('[data-step="1"] .step-btn');
    await expect(page.locator('#display-oauth-url')).not.toHaveValue('');
  });
});
```

- [ ] **Step 2: Run the real-flow spec without variables**

Run: `npx playwright test tests/e2e/real-flow.spec.js --project=real-flow`
Expected: SKIP with an explicit reason.

- [ ] **Step 3: Implement environment parsing helpers**

```js
function hasRealFlowConfig() {
  return process.env.PW_REAL_E2E === '1' && Boolean(process.env.PW_REAL_VPS_URL);
}

function getRealFlowConfig() {
  return {
    vpsUrl: process.env.PW_REAL_VPS_URL || '',
    vpsPassword: process.env.PW_REAL_VPS_CPA_PASSWORD || '',
    emailSource: process.env.PW_REAL_EMAIL_SOURCE || 'tmailor',
    mailProvider: process.env.PW_REAL_MAIL_PROVIDER || 'inbucket',
    inbucketHost: process.env.PW_REAL_INBUCKET_HOST || '',
    inbucketMailbox: process.env.PW_REAL_INBUCKET_MAILBOX || '',
  };
}

module.exports = { hasRealFlowConfig, getRealFlowConfig };
```

- [ ] **Step 4: Extend the real-flow test to support Inbucket-first controlled scenarios**

```js
if (config.mailProvider === 'inbucket') {
  await page.fill('#input-inbucket-host', config.inbucketHost);
  await page.fill('#input-inbucket-mailbox', config.inbucketMailbox);
}

await page.click('[data-step="1"] .step-btn');
await expect(page.locator('#display-oauth-url')).not.toHaveValue('');
await expect(page.locator('[data-step="1"] + .step-status, .step-status[data-step="1"]')).toBeVisible();
```

- [ ] **Step 5: Configure Playwright to retain stronger evidence for real-flow**

```js
projects: [
  { name: 'local-extension', testMatch: /local-extension\.spec\.js/ },
  {
    name: 'real-flow',
    testMatch: /real-flow\.spec\.js/,
    use: {
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
    },
  },
]
```

- [ ] **Step 6: Run the real-flow suite in both modes**

Run: `npx playwright test --project=real-flow`
Expected: SKIP when env vars are absent.

Run: `set PW_REAL_E2E=1 && set PW_REAL_VPS_URL=... && set PW_REAL_VPS_CPA_PASSWORD=... && npx playwright test --project=real-flow`
Expected: PASS or fail with retained trace/video/screenshot artifacts.

- [ ] **Step 7: Commit the real-flow harness**

```bash
git add tests/e2e/helpers/env.js tests/e2e/real-flow.spec.js playwright.config.js
git commit -m "test: add gated real flow playwright coverage"
```

### Task 5: Document Commands, Env Vars, And Verification

**Files:**
- Modify: `README.md`
- Test: `package.json`

- [ ] **Step 1: Add a failing documentation checklist in your head and compare README**

Checklist:
- installation command missing
- local Playwright run command missing
- snapshot update command missing
- real-flow env var usage missing

Expected: README does not yet contain this information.

- [ ] **Step 2: Add Playwright usage documentation**

```md
## Playwright Testing

### Install

```bash
npm install
npx playwright install chromium
```

### Local extension regression

```bash
npm run test:e2e
```

### Update local visual baselines

```bash
npm run test:e2e:update
```

### Real flow e2e

Set the required `PW_REAL_*` environment variables, then run:

```bash
npm run test:e2e:real
```
```

- [ ] **Step 3: Run the unit and local Playwright suites**

Run: `npm run test:unit`
Expected: Existing unit tests run with known current repository status.

Run: `npm run test:e2e`
Expected: local-extension Playwright suite passes.

- [ ] **Step 4: Run the full default verification command**

Run: `npm run test:all`
Expected: unit + local-extension coverage complete successfully, or any existing unrelated failures are reported explicitly.

- [ ] **Step 5: Commit the documentation and final verification changes**

```bash
git add README.md package.json playwright.config.js tests/e2e
git commit -m "docs: document playwright test workflows"
```
