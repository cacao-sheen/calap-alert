import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy backend/.env.example to backend/.env and fill it in.');
  process.exit(1);
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);
