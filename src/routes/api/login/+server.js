// GET /api/login — check auth status; POST /api/login — authenticate with admin password
import { json } from '@sveltejs/kit';
import { ADMIN_PASSWORD } from '$env/static/private';
import { createSession, isAdmin } from '$lib/auth.js';

export async function GET({ cookies }) {
	return json({ authenticated: isAdmin(cookies) });
}

export async function POST({ request, cookies }) {
	const { password } = await request.json();

	if (!password || password !== ADMIN_PASSWORD) {
		return json({ error: 'Invalid password' }, { status: 401 });
	}

	createSession(cookies);
	return json({ authenticated: true });
}
