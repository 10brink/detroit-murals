// Scrapes mural data from grkids.com, uploads images to Cloudinary, geocodes addresses, and inserts into DB
import 'dotenv/config';
import * as cheerio from 'cheerio';
import pg from 'pg';

const CLOUD_NAME = process.env.PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!CLOUD_NAME || !API_KEY || !API_SECRET || !DATABASE_URL) {
	console.error('Missing required env vars: DATABASE_URL, PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
	process.exit(1);
}

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const AUTH_HEADER = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
const SOURCE_URL = 'https://grkids.com/grand-rapids-murals/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Rate-limit helper: wait ms milliseconds
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage() {
	console.log(`→ Fetching ${SOURCE_URL}`);
	const res = await fetch(SOURCE_URL);
	if (!res.ok) throw new Error(`Failed to fetch page: HTTP ${res.status}`);
	return res.text();
}

function parseMurals(html) {
	const $ = cheerio.load(html);
	const murals = [];
	const seen = new Set();

	$('.mural-listing').each((_, el) => {
		const title = $(el).find('.mural-title').text().trim();
		const address = $(el).find('.mural-address').text().trim();
		const imageUrl = $(el).find('.mural-image img').attr('src') || null;

		// Extract artist — strip "Artist:" prefix and "// mural in ..." suffix
		let artist = $(el).find('.mural-artist').text().trim();
		artist = artist.replace(/^Artist:\s*/i, '').replace(/\/\/.*$/s, '').trim();
		if (!artist) artist = null;

		// Deduplicate (the page repeats CSS/style blocks but each title+address combo is unique)
		const key = `${title}|${address}`;
		if (seen.has(key)) return;
		seen.add(key);

		if (!title && !address) return; // skip empty entries

		murals.push({ title: title || null, artist, address: address || null, imageUrl });
	});

	return murals;
}

async function uploadToCloudinary(imageUrl, index) {
	const res = await fetch(CLOUDINARY_URL, {
		method: 'POST',
		headers: {
			Authorization: AUTH_HEADER,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			file: imageUrl,
			folder: 'grand-rapids-murals',
			public_id: `grkids-${index}`,
		}),
	});

	const data = await res.json();
	if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
	return data.secure_url;
}

async function geocode(address) {
	const params = new URLSearchParams({
		q: address,
		format: 'json',
		limit: '1',
	});

	const res = await fetch(`${NOMINATIM_URL}?${params}`, {
		headers: { 'User-Agent': 'MuralMapScraper/1.0' },
	});

	if (!res.ok) return null;
	const data = await res.json();
	if (!data.length) return null;
	return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function insertMural({ title, artist, address, imageUrl, lat, lng }) {
	const result = await pool.query(
		`INSERT INTO murals (title, artist, address, image_url, source, geom)
		 VALUES ($1, $2, $3, $4, 'grkids',
		   CASE WHEN $5::float IS NOT NULL AND $6::float IS NOT NULL
		     THEN ST_SetSRID(ST_MakePoint($6, $5), 4326)
		     ELSE NULL
		   END)
		 RETURNING id`,
		[title, artist, address, imageUrl, lat, lng]
	);
	return result.rows[0].id;
}

async function main() {
	const html = await fetchPage();
	const murals = parseMurals(html);
	console.log(`→ Parsed ${murals.length} murals`);

	let inserted = 0;
	let failed = 0;
	const failures = [];

	for (let i = 0; i < murals.length; i++) {
		const mural = murals[i];
		const label = mural.title || mural.address || `#${i + 1}`;

		try {
			// Upload image to Cloudinary (skip placeholder images)
			let cloudinaryUrl = null;
			const isPlaceholder = mural.imageUrl?.includes('placeholder');
			if (mural.imageUrl && !isPlaceholder) {
				cloudinaryUrl = await uploadToCloudinary(mural.imageUrl, i + 1);
			}

			// Geocode address
			let lat = null, lng = null;
			if (mural.address) {
				await sleep(1100); // Nominatim rate limit: 1 req/sec
				const coords = await geocode(mural.address);
				if (coords) {
					lat = coords.lat;
					lng = coords.lng;
				} else {
					console.warn(`  ⚠ No geocode result for: ${mural.address}`);
				}
			}

			// Insert into DB
			const id = await insertMural({
				title: mural.title,
				artist: mural.artist,
				address: mural.address,
				imageUrl: cloudinaryUrl,
				lat,
				lng,
			});

			inserted++;
			console.log(`[${i + 1}/${murals.length}] ✓ ${label} (id=${id})`);
		} catch (err) {
			failed++;
			failures.push({ label, error: err.message });
			console.error(`[${i + 1}/${murals.length}] ✗ ${label}: ${err.message}`);
		}
	}

	console.log(`\n→ Done. ${inserted} inserted, ${failed} failed.`);
	if (failures.length) {
		console.log('\nFailures:');
		failures.forEach((f) => console.log(`  - ${f.label}: ${f.error}`));
	}
}

main()
	.catch((err) => {
		console.error('Script error:', err);
		process.exit(1);
	})
	.finally(() => pool.end());
