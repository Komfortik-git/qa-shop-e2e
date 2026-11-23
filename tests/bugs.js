const { test } = require('@playwright/test');

// Mark only the known failing assertion, after setup has succeeded.
// STRICT_BUGS exposes ordinary red failures; an unexpected fix fails the suite.
function knownBug(id) {
  test.info().annotations.push({ type: 'bug', description: id + ': README.md' });
  test.fail(process.env.STRICT_BUGS !== '1', id + ': see README.md');
}
module.exports = { knownBug };
