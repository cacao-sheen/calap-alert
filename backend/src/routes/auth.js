import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db.js';
import { requireAuth, signToken } from '../auth.js';
import { httpError, required } from '../http.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  residentId: u.resident_id,
  name: u.display_name,
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  required({ email, password });
  const { rows } = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw httpError(401, 'Wrong email or password');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Resident sign-up from the mobile app. Creates a resident record and a login.
router.post('/register', async (req, res) => {
  const b = req.body ?? {};
  required({ firstName: b.firstName, lastName: b.lastName, email: b.email, password: b.password, barangayId: b.barangayId });
  if (String(b.password).length < 8) throw httpError(400, 'Password must be at least 8 characters');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [resident] } = await client.query(
      `INSERT INTO residents (first_name, last_name, birth_date, sex, contact_number, barangay_id, purok, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [b.firstName, b.lastName, b.birthDate || null, b.sex || null, b.contactNumber || null, b.barangayId, b.purok || null, b.address || null],
    );
    await client.query(`UPDATE residents SET resident_code = 'RES-' || lpad(id::text, 5, '0') WHERE id = $1`, [resident.id]);
    const hash = await bcrypt.hash(b.password, 10);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password_hash, role, resident_id, display_name)
       VALUES ($1, $2, 'resident', $3, $4) RETURNING *`,
      [b.email.trim(), hash, resident.id, `${b.firstName} ${b.lastName}`],
    );
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw httpError(409, 'That email is already registered');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, r.first_name, r.last_name, r.barangay_id, r.purok, r.address, b.name AS barangay
     FROM users u
     LEFT JOIN residents r ON r.id = u.resident_id
     LEFT JOIN barangays b ON b.id = r.barangay_id
     WHERE u.id = $1`,
    [req.user.id],
  );
  const u = rows[0];
  if (!u) throw httpError(404, 'User not found');
  res.json({
    ...publicUser(u),
    firstName: u.first_name,
    lastName: u.last_name,
    barangayId: u.barangay_id,
    barangay: u.barangay,
    purok: u.purok,
    address: u.address,
  });
});

export default router;
