import { Router } from 'express';
import { pool, query } from '../db.js';
import { requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { CHECKIN_STATUSES, getActiveEvent, RESIDENT_STATUS_CTE } from '../queries.js';

const router = Router();
router.use(requireAuth);

function myResidentId(req) {
  if (!req.user.residentId) throw httpError(403, 'Only resident accounts can check in');
  return req.user.residentId;
}

// "I need help" works even when no disaster check-in is running. Check-ins belong to an event,
// so without one the request is saved as a high-severity incident, which admins see on the
// Incidents page and map.
async function createRescueRequest(userId, residentId, lat, lng) {
  const { rows: [r] } = await query(
    'SELECT first_name, last_name, contact_number, barangay_id, purok, address FROM residents WHERE id = $1',
    [residentId],
  );
  const name = `${r.first_name} ${r.last_name}`;
  const description = `RESCUE REQUEST: ${name} tapped "I need help" in the app.`
    + (r.contact_number ? ` Contact: ${r.contact_number}.` : '');
  const address = [r.purok, r.address].filter(Boolean).join(', ') || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO incidents (type, description, severity, lat, lng, address, barangay_id, reported_by, reporter_name)
       VALUES ('other', $1, 'high', $2, $3, $4, $5, $6, $7) RETURNING id, created_at AS "createdAt"`,
      [description, lat, lng, address, r.barangay_id, userId, name],
    );
    await client.query(
      `INSERT INTO incident_updates (incident_id, status, note, created_by) VALUES ($1, 'pending', 'Rescue request via the app', $2)`,
      [created.id, userId],
    );
    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Resident: "I'm safe" / "I'm at an evacuation center" / "I need help"
router.post('/', async (req, res) => {
  const residentId = myResidentId(req);
  const { status, evacuationCenterId = null, lat = null, lng = null, note = null } = req.body ?? {};
  required({ status });
  oneOf(status, CHECKIN_STATUSES, 'status');
  if (status === 'evacuated' && !evacuationCenterId) throw httpError(400, 'Choose the evacuation center you are in');

  const event = await getActiveEvent();
  if (!event && status === 'need_help') {
    const incident = await createRescueRequest(req.user.id, residentId, lat, lng);
    return res.status(201).json({ status, incident, event: null });
  }
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
