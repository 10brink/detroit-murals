// Server hooks — rate limiting per IP on write endpoints and payload size guard
import { json } from '@sveltejs/kit';

const RATE_LIMITS = {
	'/api/murals/submit': { max: 5, windowMs: 15 * 60 * 1000 },
	'/api/murals/edit': { max: 10, windowMs: 15 * 60 * 1000 },
	'/api/murals': { max: 10, windowMs: 15 * 60 * 1000 },
	'/api/login': { max: 5, windowMs: 15 * 60 * 1000 }
};

const MAX_PAYLOAD_BYTES = 10 * 1024; // 10KB for JSON payloads

// Map<"endpoint:ip", { count, resetAt }>
const hits = new Map();

// Clean stale entries every 60s
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of hits) {
		if (now > entry.resetAt) hits.delete(key);
	}
}, 60_000);

function checkRateLimit(ip, endpoint) {
	const config = RATE_LIMITS[endpoint];
	if (!config) return null;

	const key = `${endpoint}:${ip}`;
	const now = Date.now();
	const entry = hits.get(key);

	if (!entry || now > entry.resetAt) {
		hits.set(key, { count: 1, resetAt: now + config.windowMs });
		return null;
	}

	entry.count++;
	if (entry.count > config.max) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return retryAfter;
	}

	return null;
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	if (event.request.method !== 'POST') {
		return resolve(event);
	}

	const path = event.url.pathname;

	// Payload size guard for mutation endpoints
	if (path.startsWith('/api/murals') || path === '/api/login') {
		const contentLength = parseInt(event.request.headers.get('content-length') || '0', 10);
		if (contentLength > MAX_PAYLOAD_BYTES) {
			return json({ error: 'Payload too large' }, { status: 413 });
		}
	}

	// Rate limiting — match most specific path first
	const endpoint = Object.keys(RATE_LIMITS)
		.sort((a, b) => b.length - a.length)
		.find(ep => path === ep);

	if (endpoint) {
		const ip = event.getClientAddress();
		const retryAfter = checkRateLimit(ip, endpoint);
		if (retryAfter !== null) {
			return json(
				{ error: 'Too many requests' },
				{ status: 429, headers: { 'Retry-After': String(retryAfter) } }
			);
		}
	}

	return resolve(event);
}
