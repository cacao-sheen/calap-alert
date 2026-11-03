// Creates all tables, the two barangays, and one admin account. No sample data.
// WARNING: this deletes ALL existing data. Run with:  npm run db:setup
//
// The admin login comes from backend/.env (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME).
// If they are not set, it uses admin@calapan.test / Admin123! — change it with:  npm run admin:password
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const email = process.env.ADMIN_EMAIL || 'admin@calapan.test';
const password = process.env.ADMIN_PASSWORD || 'Admin123!';
const name = process.env.ADMIN_NAME || 'CDRRMO Admin';

const client = await pool.connect();
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await client.query('BEGIN');
  await client.query(schema);
  for (const b of ['Ibaba East', 'Ibaba West']) {
    await client.query('INSERT INTO barangays (name) VALUES ($1)', [b]);
  }
  await client.query(
    `INSERT INTO users (email, password_hash, role, display_name) VALUES ($1, $2, 'admin', $3)`,
    [email.toLowerCase(), await bcrypt.hash(password, 10), name],
  );
  await client.query('COMMIT');
  console.log('Database is ready and empty (Brgy. Ibaba East and Ibaba West only).');
  console.log(`Admin login: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.log('Using the default password Admin123! — change it with: npm run admin:password');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Setup failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
