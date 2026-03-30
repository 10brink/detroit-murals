// Automated tests for stateless admin session token signing and verification
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, SESSION_MAX_AGE, verifySessionToken } from '../src/lib/session.js';

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 0, 1);

test('session tokens verify with the same secret', () => {
	const token = createSessionToken(SECRET, NOW);
	assert.equal(verifySessionToken(token, SECRET, NOW + 1000), true);
});

test('session tokens expire after the configured max age', () => {
	const token = createSessionToken(SECRET, NOW);
	assert.equal(verifySessionToken(token, SECRET, NOW + (SESSION_MAX_AGE * 1000) + 1), false);
});

test('session tokens fail verification if tampered', () => {
	const token = createSessionToken(SECRET, NOW);
	const tampered = `${token}x`;
	assert.equal(verifySessionToken(tampered, SECRET, NOW + 1000), false);
});
