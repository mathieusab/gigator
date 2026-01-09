const assert = require('assert');

/**
 * Simple example unit test file used by the repository's minimal test scripts.
 * Intended to be runnable with `node tests/sample.test.js` (no test framework required).
 */

function add(a, b) {
  return a + b;
}

try {
  // Basic correctness check
  assert.strictEqual(add(1, 2), 3, 'add(1,2) should return 3');

  // A second check to ensure tests actually run
  assert.strictEqual(add(0, 0), 0, 'add(0,0) should return 0');

  console.log('All sample tests passed');
  process.exit(0);
} catch (err) {
  console.error('Sample tests failed:', err.message || err);
  process.exit(1);
}