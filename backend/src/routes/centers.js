import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { httpError } from '../http.js';

const router = Router();

const SELECT = `
  SELECT c.id, c.name, c.address, c.lat, c.lng, c.capacity,
         c.current_occupancy AS "currentOccupancy", c.facilities, c.is_open AS "isOpen",
         c.barangay_id AS "barangayId", b.name AS barangay, c.updated_at AS "updatedAt"
  FROM evacuation_centers c JOIN barangays b ON b.id = c.barangay_id`;

router.get('/', async (req, res) => {
  const { rows } = await query(`${SELECT} ORDER BY b.name, c.name`);
  res.json(rows);
});

// Admin: add a new evacuation center
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, barangay, address, lat, lng, capacity, facilities } = req.body ?? {};
  if (!String(name ?? '').trim()) throw httpError(400, 'Name is required');
  if (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90) throw httpError(400, 'Latitude must be a number between -90 and 90');
  if (!Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180) throw httpError(400, 'Longitude must be a number between -180 and 180');
  if (!(Number(capacity) > 0)) throw httpError(400, 'Capacity must be more than 0');
  const b = await query('SELECT id FROM barangays WHERE name = $1', [barangay]);
  if (!b.rows.length) throw httpError(400, 'Choose Ibaba East or Ibaba West');
  const list = Array.isArray(facilities) ? facilities.map((f) => String(f).trim()).filter(Boolean) : [];
  const { rows } = await query(
    `INSERT INTO evacuation_centers (name, barangay_id, address, lat, lng, capacity, facilities)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [String(name).trim(), b.rows[0].id, String(address ?? '').trim() || null, Number(lat), Number(lng), Number(capacity), list],
  );
  const created = await query(`${SELECT} WHERE c.id = $1`, [rows[0].id]);
  res.status(201).json(created.rows[0]);
});

// Admin: update how many evacuees are inside, capacity, or open/closed
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { currentOccupancy, capacity, isOpen } = req.body ?? {};
  if (currentOccupancy !== undefined && !(Number(currentOccupancy) >= 0)) throw httpError(400, 'Occupancy must be 0 or more');
  if (capacity !== undefined && !(Number(capacity) > 0)) throw httpError(400, 'Capacity must be more than 0');
  const { rowCount } = await query(
    `UPDATE evacuation_centers
     SET current_occupancy = COALESCE($2, current_occupancy),
         capacity = COALESCE($3, capacity),
         is_open = COALESCE($4, is_open),
         updated_at = now()
     WHERE id = $1`,
    [req.params.id, currentOccupancy ?? null, capacity ?? null, isOpen ?? null],
  );
  if (!rowCount) throw httpError(404, 'Evacuation center not found');
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [req.params.id]);
  res.json(rows[0]);
});

// Admin: delete an evacuation center (residents' past check-ins keep working, they just lose the center link)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rowCount } = await query('DELETE FROM evacuation_centers WHERE id = $1', [req.params.id]);
  if (!rowCount) throw httpError(404, 'Evacuation center not found');
  res.json({ ok: true });
});

export default router;
