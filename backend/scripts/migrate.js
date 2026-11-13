// Adds new tables / columns to an existing database WITHOUT deleting any data.
// Safe to run any number of times:  npm run db:migrate
import { pool } from '../src/db.js';
import { CALAPAN_BARANGAYS } from '../src/geo.js';

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
  // The admin can end an alert; ended alerts leave the Home screen but stay in the notifications list
  'ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ',
  // Residents invite family members' accounts into their household; the family member must accept
  `CREATE TABLE IF NOT EXISTS household_invites (
     id               SERIAL PRIMARY KEY,
     from_resident_id INT  NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
     to_resident_id   INT  NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
     relationship     TEXT NOT NULL,
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (from_resident_id, to_resident_id)
   )`,
  // Each resident's own Family members list (family and friends), so accepting an invite
  // no longer moves anyone out of their household
  `CREATE TABLE IF NOT EXISTS family_links (
     owner_resident_id  INT  NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
     member_resident_id INT  NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
     relationship       TEXT NOT NULL,
     created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (owner_resident_id, member_resident_id)
   )`,
  // Residents' current spot while "Share my location" is on, for the admin Live Map
  `CREATE TABLE IF NOT EXISTS resident_locations (
     resident_id INT PRIMARY KEY REFERENCES residents(id) ON DELETE CASCADE,
     lat         DOUBLE PRECISION NOT NULL,
     lng         DOUBLE PRECISION NOT NULL,
     accuracy    REAL,
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

try {
  for (const sql of STEPS) await pool.query(sql);
  // The system covers all of Calapan City (Ibaba East & West hold the test data): add any missing barangays
  for (const name of CALAPAN_BARANGAYS) {
    await pool.query('INSERT INTO barangays (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  console.log(`Database is up to date (${STEPS.length} checks done, no data deleted).`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
