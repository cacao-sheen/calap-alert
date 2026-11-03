// Adds new tables / columns to an existing database WITHOUT deleting any data.
// Safe to run any number of times:  npm run db:migrate
import { pool } from '../src/db.js';

const STEPS = [
  // Push notifications (Firebase tokens of residents' phones)
  `CREATE TABLE IF NOT EXISTS push_tokens (
     token       TEXT PRIMARY KEY,
     user_id     INT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     barangay_id INT  REFERENCES barangays(id),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Evacuation orders open Live View when the notification is tapped
  'ALTER TABLE alerts ADD COLUMN IF NOT EXISTS evacuate BOOLEAN NOT NULL DEFAULT false',
];

try {
  for (const sql of STEPS) await pool.query(sql);
  console.log(`Database is up to date (${STEPS.length} checks done, no data deleted).`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
