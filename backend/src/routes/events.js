import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError, required } from '../http.js';
import { getActiveEvent } from '../queries.js';

const router = Router();

// Current typhoon / disaster (null when there is none)
router.get('/active', async (req, res) => {
  res.json(await getActiveEvent());
});

// Admin: start a new event, or update the active one (e.g. raise the signal level)
router.put('/active', requireAuth, requireAdmin, async (req, res) => {
  const { name, type = 'typhoon', signalLevel = null, description = null } = req.body ?? {};
  required({ name });
  if (signalLevel !== null && !(signalLevel >= 0 && signalLevel <= 5)) throw httpError(400, 'Signal level must be 0 to 5');

  const active = await getActiveEvent();
  if (active) {
    await query(
      'UPDATE disaster_events SET name = $2, type = $3, signal_level = $4, description = $5 WHERE id = $1',
      [active.id, name, type, signalLevel, description],
    );
  } else {
    await query(
      'INSERT INTO disaster_events (name, type, signal_level, description) VALUES ($1, $2, $3, $4)',
      [name, type, signalLevel, description],
    );
  }
  res.json(await getActiveEvent());
});

// Admin: end the active event. Everyone starts as "unaccounted" again on the next event.
router.post('/active/end', requireAuth, requireAdmin, async (req, res) => {
  await query('UPDATE disaster_events SET is_active = false, ended_at = now() WHERE is_active');
  res.json({ ok: true });
});

export default router;
