import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { getActiveEvent, RESIDENT_STATUS_CTE } from '../queries.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/summary', async (req, res) => {
  const [{ rows: barangays }, { rows: incidentRows }, { rows: [centers] }, event] = await Promise.all([
    query(`${RESIDENT_STATUS_CTE}
      SELECT b.id, b.name,
             (SELECT count(*) FROM households h WHERE h.barangay_id = b.id)::int AS households,
             count(rs.id)::int AS total,
             count(*) FILTER (WHERE rs.status = 'safe')::int AS safe,
             count(*) FILTER (WHERE rs.status = 'evacuated')::int AS evacuated,
             count(*) FILTER (WHERE rs.status = 'need_help')::int AS "needHelp",
             count(*) FILTER (WHERE rs.status = 'unaccounted')::int AS unaccounted,
             count(*) FILTER (WHERE rs.status IN ('unaccounted', 'need_help') AND (rs.age >= 60 OR rs."isPwd"))::int AS "vulnerableAtRisk"
      FROM barangays b LEFT JOIN rs ON rs."barangayId" = b.id
      GROUP BY b.id ORDER BY b.name`),
    query(`SELECT type, count(*)::int AS n FROM incidents WHERE status <> 'resolved' GROUP BY type ORDER BY n DESC`),
    query(`SELECT count(*) FILTER (WHERE is_open)::int AS open,
                  COALESCE(sum(capacity), 0)::int AS capacity,
                  COALESCE(sum(current_occupancy), 0)::int AS occupancy
           FROM evacuation_centers`),
    getActiveEvent(),
  ]);

  const sum = (key) => barangays.reduce((acc, b) => acc + b[key], 0);
  res.json({
    event,
    totals: {
      residents: sum('total'),
      households: sum('households'),
      safe: sum('safe'),
      evacuated: sum('evacuated'),
      needHelp: sum('needHelp'),
      unaccounted: sum('unaccounted'),
      activeIncidents: incidentRows.reduce((acc, r) => acc + r.n, 0),
    },
    barangays,
    incidentsByType: incidentRows,
    centers,
  });
});

export default router;
