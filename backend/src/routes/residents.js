import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError, oneOf, required } from '../http.js';
import { CHECKIN_STATUSES, getActiveEvent, RESIDENT_STATUS_CTE } from '../queries.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Admin: residents of a barangay with their safety status.
// ?barangayId=1&status=safe|evacuated|need_help|unaccounted&search=juan&page=1&pageSize=20
router.get('/', async (req, res) => {
  const params = [];
  const where = [];
  const add = (sql, value) => {
    params.push(value);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (req.query.barangayId) add('"barangayId" = ?', Number(req.query.barangayId));
  if (req.query.search) add(`("firstName" || ' ' || "lastName" ILIKE ? OR "residentCode" ILIKE ?)`, `%${req.query.search}%`);
  const baseWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Counts per status (for the tabs), before filtering by status
  const { rows: countRows } = await query(
    `${RESIDENT_STATUS_CTE} SELECT status, count(*)::int AS n FROM rs ${baseWhere} GROUP BY status`,
    params,
  );
  const counts = { all: 0, safe: 0, evacuated: 0, need_help: 0, unaccounted: 0 };
  for (const r of countRows) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }

  if (req.query.status) add('status = ?', req.query.status);
  const pageSize = Math.min(Number(req.query.pageSize) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const { rows } = await query(
    `${RESIDENT_STATUS_CTE}
     SELECT *, count(*) OVER()::int AS "totalRows" FROM rs
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY purok NULLS LAST, "lastName", "firstName"
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );
  const total = rows[0]?.totalRows ?? 0;
  res.json({ items: rows.map(({ totalRows, ...r }) => r), total, page, pageSize, counts });
});

// Admin: add a resident (e.g. from the barangay census)
router.post('/', async (req, res) => {
  const b = req.body ?? {};
  required({ firstName: b.firstName, lastName: b.lastName, barangayId: b.barangayId });
  const { rows: [r] } = await query(
    `INSERT INTO residents (first_name, last_name, birth_date, sex, contact_number, barangay_id, purok, address, relationship, is_pwd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [b.firstName, b.lastName, b.birthDate || null, b.sex || null, b.contactNumber || null, b.barangayId,
      b.purok || null, b.address || null, b.relationship || null, Boolean(b.isPwd)],
  );
  await query(`UPDATE residents SET resident_code = 'RES-' || lpad(id::text, 5, '0') WHERE id = $1`, [r.id]);
  const { rows } = await query(`${RESIDENT_STATUS_CTE} SELECT * FROM rs WHERE id = $1`, [r.id]);
  res.status(201).json(rows[0]);
});

// Admin: record a resident's status for them (e.g. a senior without a phone was seen at the center)
router.post('/:id/checkin', async (req, res) => {
  const { status, evacuationCenterId = null, note = null } = req.body ?? {};
  required({ status });
  oneOf(status, CHECKIN_STATUSES, 'status');
  if (status === 'evacuated' && !evacuationCenterId) throw httpError(400, 'Choose the evacuation center');
  const event = await getActiveEvent();
  if (!event) throw httpError(409, 'Start a disaster event on the dashboard first');
  await query(
    `INSERT INTO safety_checkins (resident_id, event_id, status, evacuation_center_id, note, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [req.params.id, event.id, status, evacuationCenterId, note, req.user.id],
  );
  const { rows } = await query(`${RESIDENT_STATUS_CTE} SELECT * FROM rs WHERE id = $1`, [req.params.id]);
  if (!rows[0]) throw httpError(404, 'Resident not found');
  res.json(rows[0]);
});

export default router;
