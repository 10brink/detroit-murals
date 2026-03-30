// POST /api/murals/submit — accepts user-submitted murals with validation, sets status to pending
import { json } from '@sveltejs/kit';
import { PUBLIC_CLOUDINARY_CLOUD_NAME } from '$env/static/public';
import { query } from '$lib/db.js';
import { sanitizeString, isValidCloudinaryUrl, isValidCoordinates } from '$lib/validate.js';

export async function POST({ request }) {
	try {
		const body = await request.json();
		const { image_url, lat, lng } = body;

		if (
			!isValidCloudinaryUrl(image_url, {
				cloudName: PUBLIC_CLOUDINARY_CLOUD_NAME,
				folderPrefix: 'detroit-murals/'
			})
		) {
			return json({ error: 'Valid Cloudinary image URL required' }, { status: 400 });
		}

		if (!isValidCoordinates(lat, lng)) {
			return json({ error: 'Valid Detroit-area coordinates required' }, { status: 400 });
		}

		const address = sanitizeString(body.address, 200);
		const artist = sanitizeString(body.artist, 200);

		const title = artist
			? `${address || 'Unknown location'} — ${artist}`
			: address || 'User submitted mural';

		const result = await query(
			`INSERT INTO murals (title, address, artist, image_url, source, status, geom)
			 VALUES ($1, $2, $3, $4, 'user', 'pending', ST_SetSRID(ST_MakePoint($5, $6), 4326))
			 RETURNING id, title, name, address, artist, neighborhood, image_url,
				source, status, flag_count, created_at,
				ST_X(geom) AS lng, ST_Y(geom) AS lat`,
			[title, address, artist, image_url, lng, lat]
		);

		return json(
			{ ...result.rows[0], message: 'Submitted for review — thanks!' },
			{ status: 201 }
		);
	} catch (err) {
		console.error('Submit mural error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
