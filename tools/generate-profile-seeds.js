const fs = require('node:fs');
const path = require('node:path');

const PROFILE_SEED_COUNT = 12000;
const PROFILE_SEED_PRNG_SEED = 20260424;
const CURRENT_YEAR = new Date().getFullYear();

const FIRST_NAMES = Array.from(new Set([
  'Aaron', 'Adam', 'Adrian', 'Aiden', 'Alan', 'Albert', 'Alexander', 'Amelia', 'Amy', 'Andrew',
  'Anthony', 'Aria', 'Arthur', 'Aubrey', 'Audrey', 'Ava', 'Benjamin', 'Bella', 'Blake', 'Brandon',
  'Brian', 'Brooklyn', 'Caleb', 'Cameron', 'Caroline', 'Carter', 'Charlotte', 'Chloe', 'Christian', 'Claire',
  'Clara', 'Cooper', 'Daniel', 'David', 'Dominic', 'Dylan', 'Eleanor', 'Elena', 'Elijah', 'Elizabeth',
  'Ella', 'Ellie', 'Emily', 'Emma', 'Ethan', 'Eva', 'Evelyn', 'Ezra', 'Fiona', 'Gabriel',
  'Gavin', 'Grace', 'Grayson', 'Hannah', 'Harper', 'Hazel', 'Henry', 'Hunter', 'Isaac', 'Isabella',
  'Jack', 'Jacob', 'James', 'Jasmine', 'Jason', 'Jayden', 'John', 'Jonathan', 'Joseph', 'Joshua',
  'Julian', 'Justin', 'Katherine', 'Kayla', 'Kevin', 'Leo', 'Levi', 'Liam', 'Lillian', 'Lily',
  'Logan', 'Lucas', 'Lucy', 'Madeline', 'Madison', 'Mason', 'Matthew', 'Maya', 'Michael', 'Mia',
  'Mila', 'Natalie', 'Nathan', 'Nicholas', 'Noah', 'Nora', 'Olivia', 'Oliver', 'Owen', 'Parker',
  'Penelope', 'Quinn', 'Riley', 'Ruby', 'Ryan', 'Samantha', 'Samuel', 'Sarah', 'Scarlett', 'Sebastian',
  'Sophia', 'Stella', 'Steven', 'Sydney', 'Theodore', 'Thomas', 'Tristan', 'Valerie', 'Victoria', 'Violet',
  'William', 'Wyatt', 'Zoe', 'Addison', 'Ariana', 'Colin', 'Declan', 'Elise', 'Miles', 'Rowan',
]));

const LAST_NAMES = Array.from(new Set([
  'Adams', 'Allen', 'Alvarez', 'Anderson', 'Bailey', 'Baker', 'Barnes', 'Bell', 'Bennett', 'Brooks',
  'Brown', 'Bryant', 'Butler', 'Campbell', 'Carter', 'Chavez', 'Clark', 'Collins', 'Cook', 'Cooper',
  'Cox', 'Davis', 'Diaz', 'Edwards', 'Evans', 'Fisher', 'Flores', 'Foster', 'Garcia', 'Gomez',
  'Gonzalez', 'Gray', 'Green', 'Griffin', 'Hall', 'Harris', 'Hayes', 'Henderson', 'Hernandez', 'Hill',
  'Howard', 'Hughes', 'Jackson', 'James', 'Jenkins', 'Johnson', 'Kelly', 'King', 'Lee', 'Lewis',
  'Long', 'Lopez', 'Martin', 'Martinez', 'Mason', 'Miller', 'Mitchell', 'Moore', 'Morgan', 'Morris',
  'Murphy', 'Nelson', 'Nguyen', 'Ortiz', 'Parker', 'Patterson', 'Perez', 'Perry', 'Peterson', 'Phillips',
  'Powell', 'Price', 'Ramirez', 'Reed', 'Reyes', 'Richardson', 'Rivera', 'Roberts', 'Robinson', 'Rogers',
  'Ross', 'Russell', 'Sanders', 'Scott', 'Simmons', 'Smith', 'Stewart', 'Sullivan', 'Taylor', 'Thomas',
  'Thompson', 'Torres', 'Turner', 'Walker', 'Ward', 'Watson', 'White', 'Williams', 'Wilson', 'Wood',
  'Wright', 'Young', 'Coleman', 'Diaz', 'Fernandez', 'Gutierrez', 'Kim', 'Ortega', 'Stone', 'Warren',
]));

function createMulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(values, randomFn) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function generatePassword(randomFn) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;
  const characters = [
    upper[Math.floor(randomFn() * upper.length)],
    lower[Math.floor(randomFn() * lower.length)],
    digits[Math.floor(randomFn() * digits.length)],
    symbols[Math.floor(randomFn() * symbols.length)],
  ];

  for (let index = characters.length; index < 14; index += 1) {
    characters.push(all[Math.floor(randomFn() * all.length)]);
  }

  shuffleInPlace(characters, randomFn);
  return characters.join('');
}

function generateBirthday(randomFn) {
  const age = 19 + Math.floor(randomFn() * 7);
  const year = CURRENT_YEAR - age;
  const month = 1 + Math.floor(randomFn() * 12);
  const maxDay = new Date(year, month, 0).getDate();
  const day = 1 + Math.floor(randomFn() * maxDay);
  return { year, month, day };
}

function buildProfileSeeds(count = PROFILE_SEED_COUNT) {
  const uniqueFirstNames = Array.from(new Set(FIRST_NAMES));
  const uniqueLastNames = Array.from(new Set(LAST_NAMES));
  const maxCombinations = uniqueFirstNames.length * uniqueLastNames.length;

  if (count > maxCombinations) {
    throw new Error(`Requested ${count} profile seeds, but only ${maxCombinations} unique name pairs are available.`);
  }

  const randomFn = createMulberry32(PROFILE_SEED_PRNG_SEED);
  const namePairs = [];
  for (const firstName of uniqueFirstNames) {
    for (const lastName of uniqueLastNames) {
      namePairs.push({ firstName, lastName });
    }
  }

  shuffleInPlace(namePairs, randomFn);

  return namePairs.slice(0, count).map(({ firstName, lastName }) => {
    const { year, month, day } = generateBirthday(randomFn);
    return {
      firstName,
      lastName,
      password: generatePassword(randomFn),
      year,
      month,
      day,
    };
  });
}

function buildProfileSeedsSource(profileSeeds) {
  const serializedSeeds = JSON.stringify(profileSeeds, null, 2);

  return `// data/profile-seeds.js — Generated profile seed dataset for signup flows.
// Regenerate with: node tools/generate-profile-seeds.js

const PROFILE_SEEDS = ${serializedSeeds};

function normalizeProfileSeed(seed = {}) {
  if (!seed || typeof seed !== 'object') {
    return null;
  }

  const firstName = String(seed.firstName || '').trim();
  const lastName = String(seed.lastName || '').trim();
  const password = String(seed.password || '').trim();
  const year = Number(seed.year);
  const month = Number(seed.month);
  const day = Number(seed.day);

  if (!firstName || !lastName || !password) {
    return null;
  }

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return {
    firstName,
    lastName,
    password,
    year,
    month,
    day,
  };
}

function pickRandomProfileSeed(randomFn = Math.random) {
  if (!Array.isArray(PROFILE_SEEDS) || PROFILE_SEEDS.length === 0) {
    return null;
  }

  const index = Math.floor(randomFn() * PROFILE_SEEDS.length);
  return normalizeProfileSeed(PROFILE_SEEDS[index]);
}

const ProfileSeeds = {
  PROFILE_SEEDS,
  normalizeProfileSeed,
  pickRandomProfileSeed,
};

globalThis.ProfileSeeds = ProfileSeeds;
globalThis.normalizeProfileSeed = normalizeProfileSeed;
globalThis.pickRandomProfileSeed = pickRandomProfileSeed;
`;
}

function main() {
  const profileSeeds = buildProfileSeeds(PROFILE_SEED_COUNT);
  const outputPath = path.join(__dirname, '..', 'data', 'profile-seeds.js');
  fs.writeFileSync(outputPath, buildProfileSeedsSource(profileSeeds), 'utf8');
  console.log(`Generated ${profileSeeds.length} profile seeds at ${outputPath}`);
}

main();
