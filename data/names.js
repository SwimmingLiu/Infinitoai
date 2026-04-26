// data/names.js — English name lists for random generation

const FIRST_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Christopher',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Andrew', 'Paul', 'Joshua', 'Kenneth',
  'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

function pickSharedProfileSeed(randomFn = Math.random) {
  if (typeof pickRandomProfileSeed === 'function') {
    return pickRandomProfileSeed(randomFn);
  }

  if (globalThis.ProfileSeeds?.pickRandomProfileSeed) {
    return globalThis.ProfileSeeds.pickRandomProfileSeed(randomFn);
  }

  return null;
}

/**
 * Generate a random full name.
 * @returns {{ firstName: string, lastName: string }}
 */
function generateRandomName(randomFn = Math.random) {
  const sharedSeed = pickSharedProfileSeed(randomFn);
  if (sharedSeed) {
    return {
      firstName: sharedSeed.firstName,
      lastName: sharedSeed.lastName,
    };
  }

  const firstName = FIRST_NAMES[Math.floor(randomFn() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(randomFn() * LAST_NAMES.length)];
  return { firstName, lastName };
}

/**
 * Generate a random birthday (age 19-25).
 * @returns {{ year: number, month: number, day: number }}
 */
function generateRandomBirthday(randomFn = Math.random) {
  const sharedSeed = pickSharedProfileSeed(randomFn);
  if (sharedSeed) {
    return {
      year: sharedSeed.year,
      month: sharedSeed.month,
      day: sharedSeed.day,
    };
  }

  const currentYear = new Date().getFullYear();
  const age = 19 + Math.floor(randomFn() * 7); // 19 to 25
  const year = currentYear - age;
  const month = 1 + Math.floor(randomFn() * 12); // 1 to 12
  const maxDay = new Date(year, month, 0).getDate(); // days in that month
  const day = 1 + Math.floor(randomFn() * maxDay);
  return { year, month, day };
}
