// PostgreSQL connection pool — connects to Neon with SSL for PostGIS spatial queries
import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const pool = new pg.Pool({
	connectionString: DATABASE_URL,
	ssl: { rejectUnauthorized: false }
});

export function query(text, params) {
	return pool.query(text, params);
}
