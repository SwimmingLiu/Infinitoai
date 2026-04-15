const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readSidepanelSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.js'), 'utf8');
}

test('auto-run reset clears both email and password fields in the side panel UI', () => {
  const source = readSidepanelSource();

  assert.match(
    source,
    /case 'AUTO_RUN_RESET':[\s\S]*inputEmail\.value = '';/,
  );
  assert.match(
    source,
    /case 'AUTO_RUN_RESET':[\s\S]*inputPassword\.value = '';/,
  );
});

test('manual reset clears both email and password fields in the side panel UI', () => {
  const source = readSidepanelSource();

  assert.match(
    source,
    /btnReset\.addEventListener\('click', async \(\) => \{[\s\S]*inputEmail\.value = '';/,
  );
  assert.match(
    source,
    /btnReset\.addEventListener\('click', async \(\) => \{[\s\S]*inputPassword\.value = '';/,
  );
});

test('paste-and-validate clears the current email field before picking the next TMailor candidate', () => {
  const source = readSidepanelSource();

  assert.match(
    source,
    /async function pasteAndValidateTmailorEmail\(\) \{[\s\S]*inputEmail\.value = '';[\s\S]*pickTmailorCandidate\(/,
  );
});

test('side panel exposes log round navigation controls next to the clear button', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'sidepanel', 'sidepanel.html'), 'utf8');

  assert.match(html, /id="btn-clear-log"[\s\S]*id="btn-log-round-prev"/);
  assert.match(html, /id="btn-log-round-next"/);
  assert.match(html, /id="display-log-round"/);
});

test('side panel restores and updates preserved log rounds instead of clearing the console every auto-run reset', () => {
  const source = readSidepanelSource();

  assert.match(source, /if \(state\.logRounds\) \{[\s\S]*setLogHistory\(/);
  assert.match(source, /case 'AUTO_RUN_RESET':[\s\S]*refreshLogHistoryFromBackground\(\);/);
  assert.doesNotMatch(source, /case 'AUTO_RUN_RESET':[\s\S]*clearLogArea\(\);/);
});
