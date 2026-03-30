// Seed script — inserts Detroit neighborhood polygon boundaries for area filtering
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL environment variable required');
	process.exit(1);
}

const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

// Detroit neighborhood boundaries (approximate polygons)
const areas = [
	{
		name: 'Midtown',
		slug: 'midtown',
		geojson: {
			type: 'MultiPolygon',
			coordinates: [[[[
				[-83.0720, 42.3550],
				[-83.0720, 42.3700],
				[-83.0550, 42.3700],
				[-83.0550, 42.3550],
				[-83.0720, 42.3550]
			]]]]
		}
	},
	{
		name: 'Corktown',
		slug: 'corktown',
		geojson: {
			type: 'MultiPolygon',
			coordinates: [[[[
				[-83.0700, 42.3280],
				[-83.0700, 42.3400],
				[-83.0520, 42.3400],
				[-83.0520, 42.3280],
				[-83.0700, 42.3280]
			]]]]
		}
	},
	{
		name: 'Eastern Market',
		slug: 'eastern-market',
		geojson: {
			type: 'MultiPolygon',
			coordinates: [[[[
				[-83.0500, 42.3480],
				[-83.0500, 42.3600],
				[-83.0350, 42.3600],
				[-83.0350, 42.3480],
				[-83.0500, 42.3480]
			]]]]
		}
	},
	{
		name: 'Southwest Detroit',
		slug: 'southwest',
		geojson: {
			type: 'MultiPolygon',
			coordinates: [[[[
				[-83.1100, 42.2950],
				[-83.1100, 42.3250],
				[-83.0700, 42.3250],
				[-83.0700, 42.2950],
				[-83.1100, 42.2950]
			]]]]
		}
	},
	{
		name: 'Downtown',
		slug: 'downtown',
		geojson: {
			type: 'MultiPolygon',
			coordinates: [[[[
				[-83.0600, 42.3250],
				[-83.0600, 42.3450],
				[-83.0380, 42.3450],
				[-83.0380, 42.3250],
				[-83.0600, 42.3250]
			]]]]
		}
	}
];

async function seed() {
	await pool.query('DELETE FROM areas');
	console.log('Cleared existing areas');

	for (const area of areas) {
		await pool.query(
			`INSERT INTO areas (name, slug, geom)
			 VALUES ($1, $2, ST_GeomFromGeoJSON($3))`,
			[area.name, area.slug, JSON.stringify(area.geojson)]
		);
		console.log(`Inserted area: ${area.name}`);
	}

	console.log(`Seeded ${areas.length} areas`);
	await pool.end();
}

seed().catch((err) => {
	console.error('Seed error:', err);
	process.exit(1);
});
