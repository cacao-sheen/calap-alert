import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { CHECKIN_STATUSES, getActiveEvent, RESIDENT_STATUS_CTE } from '../queries.js';

const router = Router();
router.use(requireAuth);

function myResidentId(req) {
  if (!req.user.residentId) throw httpError(403, 'Only resident accounts can check in');
  return req.user.residentId;
}

// Resident: "I'm safe" / "I'm at an evacuation center" / "I need help"
router.post('/', async (req, res) => {
  const residentId = myResidentId(req);
  const { status, evacuationCenterId = null, lat = null, lng = null, note = null } = req.body ?? {};
  required({ status });
  oneOf(status, CHECKIN_STATUSES, 'status');
  if (status === 'evacuated' && !evacuationCenterId) throw httpError(400, 'Choose the evacuation center you are in');

  const event = await getActiveEvent();
  if (!event) throw httpError(409, 'There is no active disaster alert right now, so check-in is not needed.');

  const { rows: [checkin] } = await query(
    `INSERT INTO safety_checkins (resident_id, event_id, status, evacuation_center_id, lat, lng, note, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, status, created_at AS "createdAt"`,
    [residentId, event.id, status, evacuationCenterId, lat, lng, note, req.user.id],
  );
  res.status(201).json({ ...checkin, event });
});

// Resident: my current status
router.get('/me', async (req, res) => {
  const residentId = myResidentId(req);
  const { rows } = await query(`${RESIDENT_STATUS_CTE} SELECT * FROM rs WHERE id = $1`, [residentId]);
  res.json({ event: await getActiveEvent(), me: rows[0] ?? null });
});

// Resident: everyone in my household and their status
router.get('/household', async (req, res) => {
  const residentId = myResidentId(req);
  const { rows } = await query(
    `${RESIDENT_STATUS_CTE}
     SELECT * FROM rs
     WHERE id = $1 OR "householdId" = (SELECT household_id FROM residents WHERE id = $1)
     ORDER BY (id = $1) DESC, age DESC NULLS LAST`,
    [residentId],
  );
  res.json(rows);
});

export default router;
