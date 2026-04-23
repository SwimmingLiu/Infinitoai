// content/mail-2925.js - Content script for 2925 Mail polling (steps 4, 7)

if (window.__MULTIPAGE_MAIL_2925_LOADED) {
  console.log('[Infinitoai:mail-2925] Content script already loaded on', location.href);
} else {
  window.__MULTIPAGE_MAIL_2925_LOADED = true;

  const MAIL2925_PREFIX = '[Infinitoai:mail-2925]';
  const MAIL_ITEM_SELECTORS = [
    '.mail-item',
    '.letter-item',
    '.el-table__row',
    'tr[class*="mail"]',
    '[class*="mail-item"]',
    '[class*="mailItem"]',
    '[class*="list-item"]',
    '[class*="listItem"]',
  ];
  const MAIL_TIME_GRACE_MS = 65 * 1000;

  console.log(MAIL2925_PREFIX, 'Content script loaded on', location.href, 'frame:', window === window.top ? 'top' : 'child');

  if (window !== window.top) {
    console.log(MAIL2925_PREFIX, 'Skipping child frame');
  } else {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type !== 'POLL_EMAIL') {
        return undefined;
      }

      if (typeof resetStopState === 'function') {
        resetStopState(message.controlSequence);
      }

      handlePollEmail(message.step, message.payload || {})
        .then((result) => sendResponse(result))
        .catch((error) => {
          if (typeof isStopError === 'function' && isStopError(error)) {
            log(`Step ${message.step}: Stopped by user.`, 'warn');
            sendResponse({ stopped: true, error: error.message });
            return;
          }

          if (typeof reportError === 'function') {
            reportError(message.step, error?.message || String(error || 'unknown error'));
          }
          sendResponse({ error: error?.message || String(error || 'unknown error') });
        });
      return true;
    });
  }

  function normalizeText(value) {
    if (typeof MailMatching?.normalizeText === 'function') {
      return MailMatching.normalizeText(value).toLowerCase();
    }
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function extractVerificationCode(text) {
    const source = String(text || '');
    const patterns = [
      /your\s+chatgpt\s+code\s+is\s+(\d{6})/i,
      /verification\s+code(?:\s+is)?[:\s]+(\d{6})/i,
      /code(?:\s+is)?[:\s]+(\d{6})/i,
      /验证码[^0-9]*(\d{6})/,
      /\b(\d{6})\b/,
    ];

    for (const pattern of patterns) {
      const match = source.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return '';
  }

  function getMailItems() {
    for (const selector of MAIL_ITEM_SELECTORS) {
      const items = Array.from(document.querySelectorAll(selector));
      if (items.length > 0) {
        return items;
      }
    }
    return [];
  }

  function getMailItemSubject(item) {
    const titleNode = item?.querySelector('.mail-content-title');
    return String(titleNode?.getAttribute?.('title') || titleNode?.textContent || '').trim();
  }

  function getMailItemSnippet(item) {
    const snippetNode = item?.querySelector('.mail-content-text');
    return String(snippetNode?.textContent || '').trim();
  }

  function getMailItemSender(item) {
    const senderCell = item?.querySelector('td.sender, .sender');
    if (!senderCell) {
      return '';
    }

    return [
      senderCell.querySelector?.('.ivu-tooltip-rel')?.textContent || '',
      senderCell.querySelector?.('.ivu-tooltip-inner')?.textContent || '',
      senderCell.textContent || '',
    ].join(' ').trim();
  }

  function getMailItemText(item) {
    return [
      getMailItemSender(item),
      getMailItemSubject(item),
      getMailItemSnippet(item),
      item?.querySelector('td.content, .content, .mail-content')?.textContent || '',
      item?.textContent || '',
    ].join(' ').replace(/\s+/g, ' ').trim();
  }

  function getMailItemTimeText(item) {
    const node = item?.querySelector('.date-time-text, [class*="date-time"], [class*="time"], td.time');
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function parseMailTimestamp(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return 0;
    }

    const now = Date.now();
    const todayMatch = raw.match(/^今天\s*(\d{1,2}):(\d{2})$/);
    if (todayMatch) {
      const date = new Date(now);
      date.setHours(Number(todayMatch[1]), Number(todayMatch[2]), 0, 0);
      return date.getTime();
    }

    const yesterdayMatch = raw.match(/^昨天\s*(\d{1,2}):(\d{2})$/);
    if (yesterdayMatch) {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      date.setHours(Number(yesterdayMatch[1]), Number(yesterdayMatch[2]), 0, 0);
      return date.getTime();
    }

    return MailFreshness?.parseMailTimestampCandidates?.([raw], { now }) || 0;
  }

  function isFreshMail(itemTimestamp, filterAfterTimestamp, allowMissingTimestamp = false) {
    if (!filterAfterTimestamp) {
      return true;
    }
    if (!itemTimestamp) {
      return allowMissingTimestamp;
    }

    return Boolean(
      MailFreshness?.isMailFresh?.(itemTimestamp, { filterAfterTimestamp })
      && itemTimestamp + MAIL_TIME_GRACE_MS >= filterAfterTimestamp
    );
  }

  function matchesTargetEmail(item, targetEmail) {
    const normalizedTargetEmail = normalizeText(targetEmail);
    if (!normalizedTargetEmail) {
      return true;
    }

    const rawCandidateText = getMailItemText(item);
    const candidateText = normalizeText(rawCandidateText);
    if (candidateText.includes(normalizedTargetEmail)
      || candidateText.includes(normalizedTargetEmail.replace('@', '='))) {
      return true;
    }

    return !/[a-z0-9._-]+(?:@|=)2925\.com/i.test(String(rawCandidateText || ''));
  }

  function matchesMailFilters(item, step, senderFilters, subjectFilters, targetEmail) {
    if (!matchesTargetEmail(item, targetEmail)) {
      return false;
    }

    const senderText = normalizeText(getMailItemSender(item));
    const subjectText = normalizeText(getMailItemSubject(item));
    const fullText = normalizeText(getMailItemText(item));
    const matchProfile = typeof MailMatching?.getStepMailMatchProfile === 'function'
      ? MailMatching.getStepMailMatchProfile(step)
      : null;

    const senderMatched = (senderFilters || []).length === 0
      ? true
      : senderFilters.some((filter) => {
        const normalizedFilter = normalizeText(filter);
        return senderText.includes(normalizedFilter) || fullText.includes(normalizedFilter);
      });

    const subjectMatched = (subjectFilters || []).length === 0
      ? true
      : subjectFilters.some((filter) => {
        const normalizedFilter = normalizeText(filter);
        return subjectText.includes(normalizedFilter) || fullText.includes(normalizedFilter);
      });

    if (!senderMatched && !subjectMatched) {
      return false;
    }

    if (typeof MailMatching?.matchesSubjectPatterns === 'function') {
      return MailMatching.matchesSubjectPatterns(subjectText || fullText, matchProfile);
    }

    return true;
  }

  async function refreshInbox() {
    guardStop();
    const refreshButton = document.querySelector(
      '[class*="refresh"], [title*="刷新"], [aria-label*="刷新"], [class*="Refresh"]'
    );

    if (refreshButton) {
      simulateClick(refreshButton);
      await sleepWithStop(900);
      return;
    }

    const inboxLink = document.querySelector(
      'a[href*="mailList"], [class*="inbox"], [class*="Inbox"], [title*="收件箱"]'
    );

    if (inboxLink) {
      simulateClick(inboxLink);
      await sleepWithStop(900);
    }
  }

  async function openMailDetailAndReadText(item) {
    guardStop();
    simulateClick(item);
    await sleepWithStop(800);
    return String(document.body?.innerText || document.body?.textContent || '');
  }

  async function handlePollEmail(step, payload) {
    const senderFilters = Array.isArray(payload.senderFilters) ? payload.senderFilters : [];
    const subjectFilters = Array.isArray(payload.subjectFilters) ? payload.subjectFilters : [];
    const excludeCodes = Array.isArray(payload.excludeCodes) ? payload.excludeCodes : [];
    const maxAttempts = Number.parseInt(String(payload.maxAttempts ?? 20), 10) || 20;
    const intervalMs = Number.parseInt(String(payload.intervalMs ?? 3000), 10) || 3000;
    const filterAfterTimestamp = Number.parseInt(String(payload.filterAfterTimestamp ?? 0), 10) || 0;
    const targetEmail = String(payload.targetEmail || '').trim();

    guardStop();
    log(`Step ${step}: Starting email poll on 2925 Mail (max ${maxAttempts} attempts)`);
    await sleepWithStop(800);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      guardStop();
      log(`Polling 2925 Mail... attempt ${attempt}/${maxAttempts}`);

      if (attempt > 1) {
        await refreshInbox();
      }

      const items = getMailItems();
      if (items.length === 0) {
        if (attempt < maxAttempts) {
          await sleepWithStop(intervalMs);
          continue;
        }
        break;
      }

      const matchingItems = items.filter((item) => matchesMailFilters(item, step, senderFilters, subjectFilters, targetEmail));
      const latestMatchingItem = typeof LatestMail?.findLatestMatchingItem === 'function'
        ? LatestMail.findLatestMatchingItem(matchingItems, () => true)
        : (matchingItems[0] || null);

      for (const item of matchingItems) {
        const candidateText = getMailItemText(item);
        const code = extractVerificationCode(candidateText);
        if (!code) {
          const detailText = await openMailDetailAndReadText(item);
          const detailCode = extractVerificationCode(detailText);
          if (detailCode) {
            log(`Step ${step}: Code found in 2925 mail detail: ${detailCode}`, 'ok');
            return {
              ok: true,
              code: detailCode,
              emailTimestamp: parseMailTimestamp(getMailItemTimeText(item)) || Date.now(),
            };
          }
          continue;
        }
        if (excludeCodes.includes(code)) {
          log(`Step ${step}: Skipping excluded 2925 code: ${code}`, 'info');
          continue;
        }

        const timestamp = parseMailTimestamp(getMailItemTimeText(item));
        const fresh = isFreshMail(timestamp, filterAfterTimestamp, item === latestMatchingItem);
        if (!fresh) {
          log(`Step ${step}: Skipping stale 2925 mail candidate`, 'info');
          continue;
        }

        log(`Step ${step}: Code found on 2925 Mail: ${code}`, 'ok');
        return {
          ok: true,
          code,
          emailTimestamp: timestamp || Date.now(),
        };
      }

      if (attempt < maxAttempts) {
        await sleepWithStop(intervalMs);
      }
    }

    throw new Error(
      `No matching verification email found on 2925 Mail after ${(maxAttempts * intervalMs / 1000).toFixed(0)}s. ` +
      'Check the 2925 inbox manually and confirm the latest mail is visible.'
    );
  }

  function simulateClick(element) {
    if (!element) {
      return;
    }

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  function guardStop() {
    if (typeof throwIfStopped === 'function') {
      throwIfStopped();
    }
  }

  async function pause(ms) {
    if (typeof globalThis.sleep === 'function' && globalThis.sleep !== pause) {
      await globalThis.sleep(ms);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function sleepWithStop(ms) {
    let remaining = Math.max(0, Number(ms) || 0);
    while (remaining > 0) {
      guardStop();
      const chunk = Math.min(100, remaining);
      await pause(chunk);
      remaining -= chunk;
    }
    guardStop();
  }
}
