// GET /api/murals — returns approved murals filtered by viewport bbox or neighborhood (admin can query by status)
// POST /api/murals — flags a mural as no longer existing, with duplicate prevention and auto-hide threshold
import { json } from '@sveltejs/kit';
import { query } from '$lib/db.js';
import { isAdmin } from '$lib/auth.js';
import { isValidId } from '$lib/validate.js';

const COLS = `id, mural_id, name, title, address, artist,
	neighborhood, image_url, notes, flag_count, status, created_at,
	ST_X(geom) AS lng, ST_Y(geom) AS lat`;

const FLAG_THRESHOLD = 3;

// Track ip:muralId pairs to prevent duplicate flags (resets on server restart)
const flaggedPairs = new Set();

export async function GET({ url, cookies }) {
	const neighborhood = url.searchParams.get('neighborhood');
	const bbox = url.searchParams.get('bbox');
	const statusParam = url.searchParams.get('status');

	// Only admin can query non-approved statuses
	const admin = isAdmin(cookies);
	const statusFilter = (statusParam && admin) ? statusParam : 'approved';

	try {
		let result;

		if (neighborhood) {
			result = await query(
				`SELECT ${COLS} FROM murals WHERE status = $1 AND neighborhood = $2 LIMIT 500`,
				[statusFilter, neighborhood]
			);
		} else if (bbox) {
			const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);

			if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
				return json({ error: 'Invalid bbox' }, { status: 400 });
			}

			result = await query(
				`SELECT ${COLS} FROM murals
				WHERE status = $1 AND geom && ST_MakeEnvelope($2, $3, $4, $5, 4326) LIMIT 500`,
				[statusFilter, minLng, minLat, maxLng, maxLat]
			);
		} else {
			result = await query(
				`SELECT ${COLS} FROM murals WHERE status = $1 LIMIT 500`,
				[statusFilter]
			);
		}

		return json(result.rows);
	} catch (err) {
		console.error('Murals query error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}

export async function POST({ request, getClientAddress }) {
	try {
		const { id } = await request.json();

		if (!isValidId(id)) {
			return json({ error: 'Valid mural id required' }, { status: 400 });
		}

		// Duplicate flag prevention per IP
		const ip = getClientAddress();
		const pairKey = `${ip}:${id}`;
		if (flaggedPairs.has(pairKey)) {
			return json({ error: 'Already flagged' }, { status: 409 });
		}

		const result = await query(
			`UPDATE murals
			SET flag_count = flag_count + 1, flagged_at = NOW()
			WHERE id = $1
			RETURNING id, flag_count`,
			[id]
		);

		if (result.rows.length === 0) {
			return json({ error: 'Mural not found' }, { status: 404 });
		}

		flaggedPairs.add(pairKey);

		const { flag_count } = result.rows[0];

		// Auto-hide murals that reach the flag threshold
		if (flag_count >= FLAG_THRESHOLD) {
			await query(
				`UPDATE murals SET status = 'pending' WHERE id = $1 AND status = 'approved'`,
				[id]
			);
		}

		return json(result.rows[0]);
	} catch (err) {
		console.error('Flag mural error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
