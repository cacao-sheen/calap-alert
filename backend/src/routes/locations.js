import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError } from '../http.js';
import { RESIDENT_STATUS_CTE } from '../queries.js';

// Live locations of residents who turned on "Share my location" in the app
const router = Router();
router.use(requireAuth);

function myResidentId(req) {
  if (!req.user.residentId) throw httpError(403, 'Only resident accounts share a location');
  return req.user.residentId;
}

// Resident: here is where I am now (the app sends this only while sharing is on)
router.post('/me', async (req, res) => {
  const residentId = myResidentId(req);
  const lat = Number(req.body?.lat);
  const lng = Number(req.body?.lng);
  const accuracy = Number.isFinite(Number(req.body?.accuracy)) ? Number(req.body.accuracy) : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw httpError(400, 'lat and lng are required');
  }
  await query(
    `INSERT INTO resident_locations (resident_id, lat, lng, accuracy) VALUES ($1, $2, $3, $4)
     ON CONFLICT (resident_id) DO UPDATE SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, accuracy = EXCLUDED.accuracy, updated_at = now()`,
    [residentId, lat, lng, accuracy],
  );
  res.json({ ok: true });
});

// Resident: stop sharing, so forget where I was
router.delete('/me', async (req, res) => {
  await query('DELETE FROM resident_locations WHERE resident_id = $1', [myResidentId(req)]);
  res.json({ ok: true });
});

// Admin: residents who shared their spot in the last 24 hours, with their safety status
router.get('/', requireAdmin, async (req, res) => {
  const { rows } = await query(
    `${RESIDENT_STATUS_CTE}
     SELECT rs.id, rs."firstName", rs."lastName", rs.barangay, rs.status, rs."contactNumber",
            l.lat, l.lng, l.accuracy, l.updated_at AS "updatedAt"
     FROM rs JOIN resident_locations l ON l.resident_id = rs.id
     WHERE l.updated_at > now() - interval '24 hours'
     ORDER BY l.updated_at DESC`,
  );
  res.json(rows);
});

export default router;
