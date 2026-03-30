// Automated tests for the client flagging state helper
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFlagCount } from '../src/lib/flagging.js';

test('keeps the current flag count when the server rejects the flag', () => {
	assert.equal(nextFlagCount(2, false, { error: 'Already flagged' }), 2);
});

test('uses the returned flag count after a successful flag', () => {
	assert.equal(nextFlagCount(2, true, { flag_count: 3 }), 3);
});
