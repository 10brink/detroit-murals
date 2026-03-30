// Admin session management — stateless signed cookie auth
import { ADMIN_PASSWORD } from '$env/static/private';
import { createSessionToken, SESSION_MAX_AGE, verifySessionToken } from './session.js';

const COOKIE_NAME = 'mural_admin_session';

export function createSession(cookies) {
	const token = createSessionToken(ADMIN_PASSWORD);
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: SESSION_MAX_AGE
	});
	return token;
}

export function destroySession(cookies) {
	cookies.delete(COOKIE_NAME, { path: '/' });
}

export function isAdmin(cookies) {
	const token = cookies.get(COOKIE_NAME);
	return verifySessionToken(token, ADMIN_PASSWORD);
}
