const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'),
  );
}

test('manifest declares the minimum Chrome version required by the Side Panel API', () => {
  const manifest = readManifest();

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '114');
  assert.ok(Array.isArray(manifest.permissions));
  assert.ok(manifest.permissions.includes('sidePanel'));
  assert.deepEqual(manifest.side_panel, {
    default_path: 'sidepanel/sidepanel.html',
  });
});
