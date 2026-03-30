// POST /api/logout — destroy admin session and clear cookie
import { json } from '@sveltejs/kit';
import { destroySession } from '$lib/auth.js';

export async function POST({ cookies }) {
	destroySession(cookies);
	return json({ authenticated: false });
}
