import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { httpError } from '../http.js';

const router = Router();

// The app sends its Firebase token after login, so this phone gets alerts for the resident's barangay
router.post('/register', requireAuth, async (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  if (token.length < 20) throw httpError(400, 'Invalid push token');
  const { rows: [me] } = await query('SELECT barangay_id FROM residents WHERE id = $1', [req.user.residentId ?? null]);
  await query(
    `INSERT INTO push_tokens (token, user_id, barangay_id) VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, barangay_id = EXCLUDED.barangay_id, updated_at = now()`,
    [token, req.user.id, me?.barangay_id ?? null],
  );
  res.json({ ok: true });
});

// Logging out: this phone stops getting alerts
router.post('/unregister', requireAuth, async (req, res) => {
  await query('DELETE FROM push_tokens WHERE token = $1 AND user_id = $2', [String(req.body?.token ?? ''), req.user.id]);
  res.json({ ok: true });
});

export default router;
