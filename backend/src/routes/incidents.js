import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { INCIDENT_STATUSES, INCIDENT_TYPES } from '../queries.js';

const router = Router();
router.use(requireAuth);

const SELECT = `
  SELECT i.id,
         'INC-' || to_char(i.created_at AT TIME ZONE 'Asia/Manila', 'YYYYMMDD') || '-' || lpad(i.id::text, 3, '0') AS code,
         i.type, i.description, i.severity, i.status, i.lat, i.lng, i.address,
         i.barangay_id AS "barangayId", b.name AS barangay,
         i.reporter_name AS "reporterName", (i.photo IS NOT NULL) AS "hasPhoto",
         i.created_at AS "createdAt", i.updated_at AS "updatedAt"
  FROM incidents i LEFT JOIN barangays b ON b.id = i.barangay_id`;

// List. Filters: ?status=active|pending|...&type=flood&barangayId=1&limit=50
router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };
  const { status, type, barangayId } = req.query;
  if (status === 'active') where.push(`i.status <> 'resolved'`);
  else if (status) add('i.status = ?', status);
  if (type) add('i.type = ?', type);
  if (barangayId) add('i.barangay_id = ?', Number(barangayId));
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const { rows } = await query(
    `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY i.created_at DESC LIMIT ${limit}`,
    params,
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await query(`${SELECT.replace('FROM incidents i', ', i.photo FROM incidents i')} WHERE i.id = $1`, [req.params.id]);
  if (!rows[0]) throw httpError(404, 'Incident not found');
  const { rows: updates } = await query(
    `SELECT u.id, u.status, u.note, u.created_at AS "createdAt", us.display_name AS "byName"
     FROM incident_updates u LEFT JOIN users us ON us.id = u.created_by
     WHERE u.incident_id = $1 ORDER BY u.created_at`,
    [req.params.id],
  );
  res.json({ ...rows[0], updates });
});

// Residents report an incident from the app
router.post('/', async (req, res) => {
  const b = req.body ?? {};
  required({ type: b.type, description: b.description });
  oneOf(b.type, INCIDENT_TYPES, 'type');
  oneOf(b.severity ?? 'medium', ['low', 'medium', 'high'], 'severity');
  if (b.photo && (typeof b.photo !== 'string' || !b.photo.startsWith('data:image/'))) throw httpError(400, 'Photo must be an image');

  // Default the barangay and reporter name from the reporter's resident record
  const { rows: [me] } = await query(
    `SELECT u.display_name, r.barangay_id, r.first_name, r.last_name
     FROM users u LEFT JOIN residents r ON r.id = u.resident_id WHERE u.id = $1`,
    [req.user.id],
  );
  const reporterName = me?.first_name ? `${me.first_name} ${me.last_name}` : me?.display_name ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO incidents (type, description, severity, lat, lng, address, barangay_id, photo, reported_by, reporter_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [b.type, b.description, b.severity ?? 'medium', b.lat ?? null, b.lng ?? null, b.address ?? null,
        b.barangayId ?? me?.barangay_id ?? null, b.photo ?? null, req.user.id, reporterName],
    );
    await client.query(
      `INSERT INTO incident_updates (incident_id, status, note, created_by) VALUES ($1, 'pending', 'Reported via the app', $2)`,
      [created.id, req.user.id],
    );
    await client.query('COMMIT');
    const { rows } = await query(`${SELECT} WHERE i.id = $1`, [created.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Admin: verify / dispatch / resolve
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status, note = null } = req.body ?? {};
  required({ status });
  oneOf(status, INCIDENT_STATUSES, 'status');
  const { rowCount } = await query('UPDATE incidents SET status = $2, updated_at = now() WHERE id = $1', [req.params.id, status]);
  if (!rowCount) throw httpError(404, 'Incident not found');
  await query(
    'INSERT INTO incident_updates (incident_id, status, note, created_by) VALUES ($1, $2, $3, $4)',
    [req.params.id, status, note, req.user.id],
  );
  const { rows } = await query(`${SELECT} WHERE i.id = $1`, [req.params.id]);
  res.json(rows[0]);
});

export default router;
