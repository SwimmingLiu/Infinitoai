const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildLogRoundClipboardText } = require('../shared/sidepanel-log-copy.js');

test('buildLogRoundClipboardText formats the selected round logs into copyable plain text', () => {
  const text = buildLogRoundClipboardText({
    label: 'Run 2',
    logs: [
      { time: '10:01:02', level: 'info', step: 1, message: 'Opened OAuth page' },
      { time: '10:01:08', level: 'ok', message: 'Signup completed' },
      { time: '10:01:15', level: 'warn', step: 9, message: 'Callback retried once' },
    ],
  });

  assert.equal(
    text,
    [
      '# Run 2',
      '[10:01:02] [INFO] [S1] Opened OAuth page',
      '[10:01:08] [OK] Signup completed',
      '[10:01:15] [WARN] [S9] Callback retried once',
    ].join('\n'),
  );
});

test('buildLogRoundClipboardText falls back gracefully when the selected round has no logs', () => {
  assert.equal(
    buildLogRoundClipboardText({ label: 'Current', logs: [] }),
    '# Current\n(No logs on this page)',
  );
});

test('side panel loads a copy-current-log button before the round navigation controls', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');

  assert.match(
    html,
    /id="btn-copy-log-round"[\s\S]*id="btn-log-round-prev"/,
  );
  assert.match(
    html,
    /<script src="\.\.\/shared\/sidepanel-log-copy\.js"><\/script>/,
  );
});
