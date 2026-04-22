const { test, expect } = require('./fixtures/extension-fixture');
const { getRealFlowConfig, getRealFlowSkipReason, hasRealFlowConfig } = require('./helpers/env');
const { prepareSidepanelPage } = require('./helpers/sidepanel');

test.describe('real flow', () => {
  const skipReason = getRealFlowSkipReason();
  test.skip(!hasRealFlowConfig(), skipReason);

  test('runs the real sidepanel flow up to a verifiable oauth milestone', async ({ extension }) => {
    const config = getRealFlowConfig();
    const usesMailProvider = config.emailSource !== 'tmailor';
    const page = await prepareSidepanelPage(extension);

    await page.fill('#input-vps-url', config.vpsUrl);

    if (config.vpsPassword) {
      await page.fill('#input-vps-cpa-password', config.vpsPassword);
    }

    await page.selectOption('#select-email-source', config.emailSource);

    if (usesMailProvider) {
      await page.selectOption('#select-mail-provider', config.mailProvider);
      if (config.mailProvider === 'inbucket') {
        await page.fill('#input-inbucket-host', config.inbucketHost);
        await page.fill('#input-inbucket-mailbox', config.inbucketMailbox);
      }
    }

    await page.locator('.step-btn[data-step="1"]').click();

    await expect
      .poll(async () => await page.inputValue('#display-oauth-url'), {
        timeout: 60000,
      })
      .not.toBe('');

    await expect(page.locator('.step-status[data-step="1"]')).toBeVisible();
  });
});
