// Migration runner — applies pending SQL migrations from migrations/ in filename order, tracks applied ones in schema_migrations table
import 'dotenv/config';
import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL environment variable required');
	process.exit(1);
}

const INIT_MODE = process.argv.includes('--init');
const MIGRATIONS_DIR = resolve(import.meta.dirname, '../migrations');

const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

async function run() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id SERIAL PRIMARY KEY,
			name TEXT UNIQUE NOT NULL,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`);

	const files = readdirSync(MIGRATIONS_DIR)
		.filter(f => f.endsWith('.sql'))
		.sort();

	if (files.length === 0) {
		console.log('No migration files found.');
		return;
	}

	const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
	const appliedSet = new Set(applied.map(r => r.name));

	const pending = files.filter(f => !appliedSet.has(f));

	if (pending.length === 0) {
		console.log('No pending migrations.');
		return;
	}

	if (INIT_MODE) {
		for (const file of pending) {
			await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
			console.log(`[init] Marked ${file} as applied`);
		}
		console.log(`Initialized ${pending.length} migration(s) as applied (no SQL executed).`);
		return;
	}

	for (const file of pending) {
		const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
		console.log(`Running ${file}...`);
		await pool.query(sql);
		await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
		console.log(`✓ ${file}`);
	}

	console.log(`\nApplied ${pending.length} migration(s).`);
}

run()
	.catch(err => {
		console.error('Migration failed:', err.message);
		process.exit(1);
	})
	.finally(() => pool.end());
