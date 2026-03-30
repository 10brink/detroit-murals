// One-time script — sets created_at to July 2019 for all Detroit murals
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

const result = await pool.query(
	`UPDATE murals SET created_at = '2019-07-01' WHERE source != 'user' RETURNING id`
);

console.log(`Updated ${result.rows.length} murals to July 2019`);
await pool.end();
