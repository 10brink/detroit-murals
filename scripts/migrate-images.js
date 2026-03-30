// One-time migration script — uploads seed mural images from GitHub to Cloudinary and updates DB URLs
import 'dotenv/config';
import pg from 'pg';
import { writeFileSync, appendFileSync } from 'fs';

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
const CONCURRENCY = 3;
const FAILURE_LOG = 'migration-failures.log';

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function uploadToCloudinary(imageUrl, muralId) {
	const body = {
		file: imageUrl,
		folder: 'detroit-murals',
		public_id: `mural-${muralId}`,
	};

	const res = await fetch(CLOUDINARY_URL, {
		method: 'POST',
		headers: {
			Authorization: AUTH_HEADER,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const data = await res.json();
	if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
	return data.secure_url;
}

async function migrateOne(row, index, total) {
	try {
		const cloudinaryUrl = await uploadToCloudinary(row.image_url, row.mural_id || row.id);
		await pool.query('UPDATE murals SET image_url = $1 WHERE id = $2', [cloudinaryUrl, row.id]);
		console.log(`[${index}/${total}] Migrated id=${row.id} → ${cloudinaryUrl}`);
		return true;
	} catch (err) {
		const msg = `id=${row.id},mural_id=${row.mural_id},url=${row.image_url},error=${err.message}`;
		console.error(`[FAIL] ${msg}`);
		appendFileSync(FAILURE_LOG, msg + '\n');
		return false;
	}
}

async function migrate() {
	const { rows } = await pool.query(`
		SELECT id, mural_id, image_url
		FROM murals
		WHERE image_url IS NOT NULL
		  AND image_url != ''
		  AND image_url NOT LIKE '%res.cloudinary.com%'
		ORDER BY id
	`);

	if (rows.length === 0) {
		console.log('Nothing to migrate — all images already on Cloudinary.');
		return;
	}

	console.log(`Migrating ${rows.length} murals to Cloudinary...`);
	writeFileSync(FAILURE_LOG, '');

	let succeeded = 0;
	let failed = 0;

	for (let i = 0; i < rows.length; i += CONCURRENCY) {
		const batch = rows.slice(i, i + CONCURRENCY);
		const results = await Promise.all(
			batch.map((row, j) => migrateOne(row, i + j + 1, rows.length))
		);
		results.forEach((ok) => (ok ? succeeded++ : failed++));
	}

	console.log(`\nMigration complete. ${succeeded} succeeded, ${failed} failed.`);
	if (failed > 0) console.log(`Failed IDs logged to ${FAILURE_LOG}`);
}

migrate()
	.catch((err) => {
		console.error('Migration error:', err);
		process.exit(1);
	})
	.finally(() => pool.end());
