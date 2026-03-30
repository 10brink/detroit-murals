// POST /api/murals/edit — admin-only: updates mural metadata and status (approve/reject)
import { json } from '@sveltejs/kit';
import { query } from '$lib/db.js';
import { isAdmin } from '$lib/auth.js';
import { isValidId, sanitizeString } from '$lib/validate.js';

const VALID_STATUSES = ['approved', 'pending', 'rejected'];

export async function POST({ request, cookies }) {
	if (!isAdmin(cookies)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { id } = body;

		if (!isValidId(id)) {
			return json({ error: 'Valid mural id required' }, { status: 400 });
		}

		const name = sanitizeString(body.name, 200);
		const address = sanitizeString(body.address, 200);
		const artist = sanitizeString(body.artist, 200);
		const neighborhood = sanitizeString(body.neighborhood, 100);
		const status = VALID_STATUSES.includes(body.status) ? body.status : undefined;

		const title = artist
			? `${address || 'Unknown location'} — ${artist}`
			: address || 'Mural';

		let sql, params;
		if (status) {
			sql = `UPDATE murals
				SET name = $1, title = $2, address = $3, artist = $4, neighborhood = $5, status = $6
				WHERE id = $7
				RETURNING id, name, title, address, artist, neighborhood, image_url, flag_count, status,
					ST_X(geom) AS lng, ST_Y(geom) AS lat`;
			params = [name, title, address, artist, neighborhood, status, id];
		} else {
			sql = `UPDATE murals
				SET name = $1, title = $2, address = $3, artist = $4, neighborhood = $5
				WHERE id = $6
				RETURNING id, name, title, address, artist, neighborhood, image_url, flag_count, status,
					ST_X(geom) AS lng, ST_Y(geom) AS lat`;
			params = [name, title, address, artist, neighborhood, id];
		}

		const result = await query(sql, params);

		if (result.rows.length === 0) {
			return json({ error: 'Mural not found' }, { status: 404 });
		}

		return json(result.rows[0]);
	} catch (err) {
		console.error('Edit mural error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
