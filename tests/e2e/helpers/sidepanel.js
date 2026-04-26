async function prepareSidepanelPage(extension) {
  const page = await extension.openExtensionPage('sidepanel/sidepanel.html');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#input-vps-url').waitFor();
  await page.waitForFunction(() => {
    const select = document.querySelector('#select-email-source');
    const row33Mail = document.querySelector('#row-33mail-settings');
    const rowTmailor = document.querySelector('#row-tmailor-domains');
    if (!select || !row33Mail || !rowTmailor) {
      return false;
    }

    const isVisible = (element) => window.getComputedStyle(element).display !== 'none';
    const source = select.value;
    if (source === '33mail') {
      return isVisible(row33Mail) && !isVisible(rowTmailor);
    }
    if (source === 'tmailor') {
      return !isVisible(row33Mail) && isVisible(rowTmailor);
    }
    return !isVisible(row33Mail) && !isVisible(rowTmailor);
  });
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

    const cards = document.querySelectorAll('#data-section .data-card');
    cards.forEach((card) => {
      card.style.height = '637px';
      card.style.minHeight = '637px';
      card.style.boxSizing = 'border-box';
    });
  });
}

module.exports = {
  prepareSidepanelPage,
  stabilizeForScreenshot,
};
