// Changes the admin's password without touching any other data.
// Usage:  npm run admin:password -- admin@calapan.test "MyNewPassword123"
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.log('Usage: npm run admin:password -- <admin email> "<new password, at least 8 characters>"');
  process.exit(1);
}
const { rowCount } = await pool.query(
  `UPDATE users SET password_hash = $2 WHERE lower(email) = lower($1) AND role = 'admin'`,
  [email.toLowerCase(), await bcrypt.hash(password, 10)],
);
console.log(rowCount ? `Password changed for ${email}` : `No admin account with the email ${email}`);
await pool.end();
