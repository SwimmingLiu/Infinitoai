const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadProfileSeeds() {
  const profileSeedsPath = path.join(__dirname, '..', 'data', 'profile-seeds.js');
  const source = fs.readFileSync(profileSeedsPath, 'utf8');
  const context = {
    console,
    Math,
    Date,
    globalThis: {},
  };

  context.global = context.globalThis;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: profileSeedsPath });
  return context.globalThis.ProfileSeeds;
}

test('profile seed dataset provides at least 10000 reusable profiles', () => {
  const profileSeeds = loadProfileSeeds();

  assert.ok(profileSeeds, 'expected globalThis.ProfileSeeds to be defined');
  assert.ok(Array.isArray(profileSeeds.PROFILE_SEEDS), 'expected PROFILE_SEEDS array');
  assert.ok(
    profileSeeds.PROFILE_SEEDS.length >= 10000,
    `expected at least 10000 profile seeds, got ${profileSeeds.PROFILE_SEEDS.length}`,
  );

  const sample = profileSeeds.PROFILE_SEEDS[0];
  assert.equal(typeof sample.firstName, 'string');
  assert.equal(typeof sample.lastName, 'string');
  assert.equal(typeof sample.password, 'string');
  assert.equal(typeof sample.year, 'number');
  assert.equal(typeof sample.month, 'number');
  assert.equal(typeof sample.day, 'number');
  assert.match(sample.firstName, /^[A-Za-z]+$/);
  assert.match(sample.lastName, /^[A-Za-z]+$/);
  assert.match(sample.password, /^[A-Za-z0-9!@#$%&*?]{14}$/);
  assert.ok(sample.month >= 1 && sample.month <= 12);
  assert.ok(sample.day >= 1 && sample.day <= 31);
});

test('background imports and uses the shared profile seed dataset', () => {
  const backgroundPath = path.join(__dirname, '..', 'background.js');
  const source = fs.readFileSync(backgroundPath, 'utf8');

  assert.match(
    source,
    /importScripts\([\s\S]*'data\/profile-seeds\.js'[\s\S]*'data\/names\.js'[\s\S]*\);/,
  );
  assert.match(source, /profileSeed\.password/);
  assert.match(source, /pickRandomProfileSeed\(/);
});
