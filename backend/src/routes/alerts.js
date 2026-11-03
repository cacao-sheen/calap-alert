import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { sendPush } from '../push.js';

const router = Router();

const SELECT = `
  SELECT a.id, a.title, a.message, a.level, a.evacuate, a.barangay_id AS "barangayId", b.name AS barangay,
         a.created_at AS "createdAt", a.ended_at AS "endedAt"
  FROM alerts a LEFT JOIN barangays b ON b.id = a.barangay_id`;

// Phone notifications are sent through Firebase; a failure there must not stop the alert itself
async function notify(message) {
  try {
    return await sendPush(message);
  } catch (err) {
    console.warn('Push failed:', err.message);
    return { sent: 0, reason: 'Sending to phones failed' };
  }
}

// Alerts, newest first. ?barangayId=1 returns alerts for that barangay plus alerts for everyone.
// ?active=1 leaves out ended alerts. ?limit= up to 50 (default 10).
router.get('/', async (req, res) => {
  const barangayId = req.query.barangayId ? Number(req.query.barangayId) : null;
  const activeOnly = req.query.active === '1';
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const { rows } = await query(
    `${SELECT} WHERE ($1::int IS NULL OR a.barangay_id IS NULL OR a.barangay_id = $1)
       AND (NOT $2 OR a.ended_at IS NULL)
     ORDER BY a.created_at DESC LIMIT $3`,
    [barangayId, activeOnly, limit],
  );
  res.json(rows);
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, message, level = 'warning', barangayId = null, evacuate = false } = req.body ?? {};
  required({ title, message });
  oneOf(level, ['info', 'warning', 'danger'], 'level');
  const { rows: [created] } = await query(
    'INSERT INTO alerts (title, message, level, barangay_id, evacuate, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [title, message, level, barangayId || null, !!evacuate, req.user.id],
  );
  const { rows } = await query(`${SELECT} WHERE a.id = $1`, [created.id]);

  // Tapping an evacuation order opens Live View to the nearest center; other alerts open the notifications page
  const push = await notify({
    title: evacuate ? `EVACUATE NOW: ${title}` : title,
    body: message,
    route: evacuate ? '/tabs/map?live=1' : '/tabs/alerts',
    barangayId: barangayId || null,
  });
  res.status(201).json({ ...rows[0], push });
});

// Admin: the alert is over. It leaves residents' Home screen and they get an "all clear" notification.
router.post('/:id/end', requireAuth, requireAdmin, async (req, res) => {
  const { rows: [ended] } = await query(
    'UPDATE alerts SET ended_at = now() WHERE id = $1 AND ended_at IS NULL RETURNING id, title, evacuate, barangay_id',
    [req.params.id],
  );
  if (!ended) throw httpError(404, 'Alert not found or already ended');
  const push = await notify({
    title: ended.evacuate ? `All clear: ${ended.title}` : `Alert ended: ${ended.title}`,
    body: ended.evacuate
      ? 'The evacuation order has been lifted. Follow your barangay officials before going home.'
      : 'This alert is no longer in effect.',
    route: '/tabs/alerts',
    barangayId: ended.barangay_id,
  });
  const { rows } = await query(`${SELECT} WHERE a.id = $1`, [ended.id]);
  res.json({ ...rows[0], push });
});

export default router;
