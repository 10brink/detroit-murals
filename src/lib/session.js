// Stateless admin session helpers — sign and verify cookie tokens without in-memory storage
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(payload, secret) {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(secret, now = Date.now()) {
	const expiresAt = now + (SESSION_MAX_AGE * 1000);
	const nonce = randomBytes(16).toString('base64url');
	const payload = `${expiresAt}.${nonce}`;
	return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, now = Date.now()) {
	if (!token || typeof token !== 'string') return false;
	if (!secret || typeof secret !== 'string') return false;

	const lastDot = token.lastIndexOf('.');
	if (lastDot <= 0) return false;

	const payload = token.slice(0, lastDot);
	const providedSig = token.slice(lastDot + 1);
	const expectedSig = sign(payload, secret);

	const provided = Buffer.from(providedSig);
	const expected = Buffer.from(expectedSig);

	if (provided.length !== expected.length) return false;
	if (!timingSafeEqual(provided, expected)) return false;

	const [expiresAtRaw] = payload.split('.');
	const expiresAt = Number(expiresAtRaw);
	if (!Number.isFinite(expiresAt)) return false;

	return now <= expiresAt;
}
