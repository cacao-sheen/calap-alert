import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

// Public: used by the sign-up form.
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, name, city FROM barangays ORDER BY name');
  res.json(rows);
});

export default router;
