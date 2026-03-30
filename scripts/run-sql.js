// Helper — runs a SQL file against the database using DATABASE_URL from .env
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

const file = process.argv[2];
if (!file) {
	console.error('Usage: node scripts/run-sql.js <file.sql>');
	process.exit(1);
}

const sql = readFileSync(file, 'utf-8');
try {
	await pool.query(sql);
	console.log('SQL executed successfully');
} catch (err) {
	console.error('SQL error:', err.message);
	process.exit(1);
} finally {
	await pool.end();
}
