// One-time migration — adds name column to murals table
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

await pool.query(`ALTER TABLE murals ADD COLUMN IF NOT EXISTS name TEXT`);
console.log('Added name column to murals');
await pool.end();
