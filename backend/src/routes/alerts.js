import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { oneOf, required } from '../http.js';

const router = Router();

const SELECT = `
  SELECT a.id, a.title, a.message, a.level, a.barangay_id AS "barangayId", b.name AS barangay, a.created_at AS "createdAt"
  FROM alerts a LEFT JOIN barangays b ON b.id = a.barangay_id`;

// Latest alerts. ?barangayId=1 returns alerts for that barangay plus alerts for everyone.
router.get('/', async (req, res) => {
  const barangayId = req.query.barangayId ? Number(req.query.barangayId) : null;
  const { rows } = await query(
    `${SELECT} WHERE ($1::int IS NULL OR a.barangay_id IS NULL OR a.barangay_id = $1)
     ORDER BY a.created_at DESC LIMIT 10`,
    [barangayId],
  );
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, message, level = 'warning', barangayId = null } = req.body ?? {};
  required({ title, message });
  oneOf(level, ['info', 'warning', 'danger'], 'level');
  const { rows: [created] } = await query(
    'INSERT INTO alerts (title, message, level, barangay_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [title, message, level, barangayId || null, req.user.id],
  );
  const { rows } = await query(`${SELECT} WHERE a.id = $1`, [created.id]);
  res.status(201).json(rows[0]);
});

export default router;
