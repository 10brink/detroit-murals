// GET /api/neighborhoods — returns GeoJSON boundaries derived from mural point clusters per neighborhood
import { json } from '@sveltejs/kit';
import { query } from '$lib/db.js';
import { buildNeighborhoodsQuery } from '$lib/public-queries.js';

export async function GET() {
	try {
		const result = await query(buildNeighborhoodsQuery());

		const features = result.rows.map((row) => ({
			type: 'Feature',
			properties: {
				neighborhood: row.neighborhood,
				count: parseInt(row.count)
			},
			geometry: JSON.parse(row.geojson)
		}));

		return json({
			type: 'FeatureCollection',
			features
		});
	} catch (err) {
		console.error('Neighborhoods query error:', err);
		return json({ error: 'Database error' }, { status: 500 });
	}
}
