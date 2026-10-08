import { query } from './db.js';

export async function getActiveEvent() {
  const { rows } = await query(`
    SELECT id, name, type, signal_level AS "signalLevel", description, started_at AS "startedAt"
    FROM disaster_events WHERE is_active ORDER BY started_at DESC LIMIT 1`);
  return rows[0] ?? null;
}

// CTE "rs": every resident with their latest safety status for the active event.
// No check-in for the active event = 'unaccounted'.
export const RESIDENT_STATUS_CTE = `
WITH ev AS (
  SELECT id FROM disaster_events WHERE is_active ORDER BY started_at DESC LIMIT 1
),
rs AS (
  SELECT r.id,
         r.resident_code  AS "residentCode",
         r.first_name     AS "firstName",
         r.last_name      AS "lastName",
         date_part('year', age(r.birth_date))::int AS age,
         r.sex,
         r.contact_number AS "contactNumber",
         r.barangay_id    AS "barangayId",
         b.name           AS barangay,
         r.household_id   AS "householdId",
         r.relationship,
         r.purok,
         r.address,
         r.is_pwd         AS "isPwd",
         COALESCE(c.status, 'unaccounted') AS status,
         c.created_at     AS "checkedInAt",
         ec.name          AS "centerName",
         c.lat, c.lng
  FROM residents r
  JOIN barangays b ON b.id = r.barangay_id
  LEFT JOIN LATERAL (
    SELECT sc.* FROM safety_checkins sc
    WHERE sc.resident_id = r.id AND sc.event_id = (SELECT id FROM ev)
    ORDER BY sc.created_at DESC LIMIT 1
  ) c ON true
  LEFT JOIN evacuation_centers ec ON ec.id = c.evacuation_center_id
)`;

export const INCIDENT_TYPES = ['flood', 'fire', 'car_accident', 'landslide', 'medical', 'power_outage', 'fallen_tree', 'other'];
export const INCIDENT_STATUSES = ['pending', 'verified', 'responding', 'resolved'];
export const CHECKIN_STATUSES = ['safe', 'evacuated', 'need_help'];
