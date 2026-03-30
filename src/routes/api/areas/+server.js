// GET /api/areas — returns distinct neighborhoods with mural counts
import { json } from '@sveltejs/kit';
import { query } from '$lib/db.js';
import { buildAreasQuery } from '$lib/public-queries.js';

export async function GET() {
	try {
		const result = await query(buildAreasQuery());
		return json(result.rows);
	} catch (err) {
		console.error('Areas query error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
