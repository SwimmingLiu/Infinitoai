const { test, expect } = require('./fixtures/extension-fixture');
const { prepareSidepanelPage, stabilizeForScreenshot } = require('./helpers/sidepanel');

test('loads unpacked extension and finds the background service worker', async ({ extension }) => {
  expect(extension.id).toBeTruthy();
  await expect
    .poll(async () => extension.serviceWorker()?.url() || '')
    .toContain('/background.js');
});

test('renders the sidepanel shell with core controls', async ({ extension }) => {
  const page = await prepareSidepanelPage(extension);
  await expect(page.locator('#input-vps-url')).toBeVisible();
  await expect(page.locator('#select-email-source')).toBeVisible();
  await expect(page.locator('#btn-auto-run')).toBeVisible();
});

test('toggles source specific sections and keeps the stable panel form visually unchanged', async ({ extension }) => {
  const page = await prepareSidepanelPage(extension);

  await page.selectOption('#select-email-source', '33mail');
  await expect(page.locator('#row-33mail-settings')).toBeVisible();

  await page.selectOption('#select-email-source', 'tmailor');
  await expect(page.locator('#row-tmailor-domains')).toBeVisible();

  await stabilizeForScreenshot(page);
  await expect(page.locator('#data-section .data-card').first()).toHaveScreenshot('sidepanel-stable-form.png');
});
