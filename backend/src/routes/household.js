import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { sendPush } from '../push.js';

// A resident's own "Family members" list (family and friends): add people without an account,
// or invite other residents' accounts. Invites must be accepted; then both appear in each other's list.
// (Routes keep the /household path from before.)
const router = Router();
router.use(requireAuth);

function myResidentId(req) {
  if (!req.user.residentId) throw httpError(403, 'Only resident accounts have family members');
  return req.user.residentId;
}

// Adds or updates "member is <relationship> to owner" in owner's list
const LINK_SQL = `INSERT INTO family_links (owner_resident_id, member_resident_id, relationship) VALUES ($1, $2, $3)
  ON CONFLICT (owner_resident_id, member_resident_id) DO UPDATE SET relationship = EXCLUDED.relationship`;

async function inTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Add someone who has no account (e.g. a child or a senior without a phone)
router.post('/members', async (req, res) => {
  const residentId = myResidentId(req);
  const b = req.body ?? {};
  required({ firstName: b.firstName, lastName: b.lastName, relationship: b.relationship });
  if (b.sex) oneOf(b.sex, ['male', 'female'], 'sex');

  const id = await inTransaction(async (client) => {
    // They are counted as residents too, so they get the adder's barangay and address
    const { rows: [me] } = await client.query('SELECT barangay_id, purok, address FROM residents WHERE id = $1', [residentId]);
    const { rows: [added] } = await client.query(
      `INSERT INTO residents (first_name, last_name, birth_date, sex, barangay_id, purok, address, is_pwd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [b.firstName.trim(), b.lastName.trim(), b.birthDate || null, b.sex || null, me.barangay_id, me.purok, me.address, Boolean(b.isPwd)],
    );
    await client.query(`UPDATE residents SET resident_code = 'RES-' || lpad(id::text, 5, '0') WHERE id = $1`, [added.id]);
    await client.query(LINK_SQL, [residentId, added.id, b.relationship]);
    return added.id;
  });
  res.status(201).json({ id });
});

// Invites I received and invites I sent that are still waiting
router.get('/invites', async (req, res) => {
  const residentId = myResidentId(req);
  const { rows } = await query(
    `SELECT i.id, i.relationship, i.created_at AS "createdAt",
            (i.to_resident_id = $1) AS received,
            f.first_name || ' ' || f.last_name AS "fromName",
            t.first_name || ' ' || t.last_name AS "toName"
     FROM household_invites i
     JOIN residents f ON f.id = i.from_resident_id
     JOIN residents t ON t.id = i.to_resident_id
     WHERE i.from_resident_id = $1 OR i.to_resident_id = $1
     ORDER BY i.created_at DESC`,
    [residentId],
  );
  res.json({
    received: rows.filter((r) => r.received).map(({ received, toName, ...r }) => r),
    sent: rows.filter((r) => !r.received).map(({ received, fromName, ...r }) => r),
  });
});

// Find accounts to invite by full name (partial is fine) or by email (must be typed in full,
// so nobody can fish for other people's emails). Emails are never sent back.
router.get('/search', async (req, res) => {
  const residentId = myResidentId(req);
  const q = String(req.query.q ?? '').trim();
  if (q.length < 3) return res.json([]);
  const { rows } = await query(
    `SELECT r.id, r.first_name || ' ' || r.last_name AS name, b.name AS barangay, r.purok
     FROM users u JOIN residents r ON r.id = u.resident_id JOIN barangays b ON b.id = r.barangay_id
     WHERE r.id <> $1
       AND (lower(u.email) = lower($2) OR r.first_name || ' ' || r.last_name ILIKE $3)
     ORDER BY r.last_name, r.first_name LIMIT 8`,
    [residentId, q, `%${q.replace(/[%_\\]/g, '\\$&')}%`],
  );
  res.json(rows);
});

// Invite someone's account (picked from the search)
router.post('/invites', async (req, res) => {
  const residentId = myResidentId(req);
  const { residentId: toId, relationship } = req.body ?? {};
  required({ residentId: toId, relationship });

  const { rows: [to] } = await query(
    `SELECT u.id AS user_id, r.id, r.household_id FROM users u JOIN residents r ON r.id = u.resident_id
     WHERE r.id = $1`,
    [toId],
  );
  if (!to) throw httpError(404, 'That account was not found. Ask them to sign up first.');
  if (to.id === residentId) throw httpError(400, 'That is your own account');
  const { rows: [me] } = await query(
    `SELECT first_name, last_name, household_id,
            EXISTS (SELECT 1 FROM family_links WHERE owner_resident_id = $1 AND member_resident_id = $2) AS linked
     FROM residents WHERE id = $1`,
    [residentId, to.id],
  );
  if (me.linked || (me.household_id && me.household_id === to.household_id)) {
    throw httpError(409, 'They are already in your Family members');
  }

  try {
    await query(
      'INSERT INTO household_invites (from_resident_id, to_resident_id, relationship) VALUES ($1, $2, $3)',
      [residentId, to.id, relationship],
    );
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'You already invited this person. Wait for them to accept.');
    throw err;
  }

  sendPush({
    userId: to.user_id,
    title: 'Family members invite',
    body: `${me.first_name} ${me.last_name} wants to add you to their Family members. Open the app to accept.`,
    route: '/tabs/me',
  }).catch((err) => console.warn('Push failed:', err.message));
  res.status(201).json({ ok: true });
});

// The invited person accepts and says what the inviter is to them (e.g. Friend).
// Both are then in each other's Family members list.
router.post('/invites/:id/accept', async (req, res) => {
  const residentId = myResidentId(req);
  const { relationship } = req.body ?? {};
  required({ relationship });
  await inTransaction(async (client) => {
    const { rows: [invite] } = await client.query(
      'DELETE FROM household_invites WHERE id = $1 AND to_resident_id = $2 RETURNING from_resident_id, relationship',
      [req.params.id, residentId],
    );
    if (!invite) throw httpError(404, 'This invite was cancelled or already answered');
    await client.query(LINK_SQL, [invite.from_resident_id, residentId, invite.relationship]);
    await client.query(LINK_SQL, [residentId, invite.from_resident_id, relationship]);
    // If I had also invited them, that invite is no longer needed
    await client.query(
      'DELETE FROM household_invites WHERE from_resident_id = $1 AND to_resident_id = $2',
      [residentId, invite.from_resident_id],
    );
  });
  res.json({ ok: true });
});

// The invited person declines, or the inviter cancels
router.delete('/invites/:id', async (req, res) => {
  const residentId = myResidentId(req);
  const { rowCount } = await query(
    'DELETE FROM household_invites WHERE id = $1 AND (to_resident_id = $2 OR from_resident_id = $2)',
    [req.params.id, residentId],
  );
  if (!rowCount) throw httpError(404, 'This invite was cancelled or already answered');
  res.json({ ok: true });
});

export default router;
