// Seed script — loads 550 murals from muralsdb.csv into PostGIS database
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

const CSV_FILE = process.argv[2] || 'data/muralsdb.csv';

function parseCSV(text) {
	const lines = text.split('\n').filter((l) => l.trim());
	const headers = lines[0].split(',').map((h) => h.trim());

	return lines.slice(1).map((line) => {
		const values = [];
		let current = '';
		let inQuotes = false;

		for (const char of line) {
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				values.push(current.trim());
				current = '';
			} else {
				current += char;
			}
		}
		values.push(current.trim());

		const row = {};
		headers.forEach((h, i) => {
			row[h] = values[i] || '';
		});
		return row;
	});
}

async function seed() {
	const text = readFileSync(CSV_FILE, 'utf-8');
	const rows = parseCSV(text);

	console.log(`Parsed ${rows.length} murals from CSV`);

	await pool.query('DELETE FROM murals');
	console.log('Cleared existing murals');

	let inserted = 0;
	let skipped = 0;

	for (const row of rows) {
		const lat = parseFloat(row.latitude);
		const lng = parseFloat(row.longitude);

		if (isNaN(lat) || isNaN(lng)) {
			skipped++;
			continue;
		}

		const muralId = row.id || null;
		const artist = row.artists && row.artists !== 'unknown' ? row.artists : null;
		const title = artist ? `${row.address} — ${artist}` : row.address || `Mural ${muralId}`;
		const imageUrl = row.images || `https://raw.githubusercontent.com/10brink/Mural2.0/main/images/${muralId}.jpg`;

		await pool.query(
			`INSERT INTO murals (mural_id, title, address, artist, neighborhood, image_url, notes, geom)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8, $9), 4326))
			 ON CONFLICT (mural_id) DO NOTHING`,
			[muralId, title, row.address, artist, row.neighborhood, imageUrl, row.notes || null, lng, lat]
		);
		inserted++;
	}

	console.log(`Inserted ${inserted} murals, skipped ${skipped}`);
	await pool.end();
}

seed().catch((err) => {
	console.error('Seed error:', err);
	process.exit(1);
});
