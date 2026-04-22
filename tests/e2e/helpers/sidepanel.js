async function prepareSidepanelPage(extension) {
  const page = await extension.openExtensionPage('sidepanel/sidepanel.html');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#input-vps-url').waitFor();
  return page;
}

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

module.exports = {
  prepareSidepanelPage,
  stabilizeForScreenshot,
};
