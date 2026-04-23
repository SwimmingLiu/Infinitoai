const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('package.json exposes a dedicated Chrome stable e2e script', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );

  assert.equal(typeof packageJson.scripts?.['test:e2e:chrome'], 'string');
  assert.match(packageJson.scripts['test:e2e:chrome'], /chrome/i);
  assert.equal(typeof packageJson.scripts?.['test:e2e:playwright'], 'string');
  assert.match(packageJson.scripts['test:e2e'], /test:e2e:chrome/);
  assert.match(packageJson.scripts['test:all'], /test:e2e/);
});

test('chrome stable e2e fixture exists for Puppeteer-based extension loading', () => {
  const fixturePath = path.join(__dirname, 'chrome-e2e', 'fixtures', 'chrome-extension-fixture.js');

  assert.equal(fs.existsSync(fixturePath), true);
});
