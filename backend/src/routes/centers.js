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

export default router;
