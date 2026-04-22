const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('background service worker bundle parses without syntax errors', () => {
  const backgroundPath = path.join(__dirname, '..', 'background.js');
  const source = fs.readFileSync(backgroundPath, 'utf8');

  assert.doesNotThrow(() => {
    new vm.Script(source, { filename: backgroundPath });
  });
});
