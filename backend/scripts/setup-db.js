// Creates all tables and fills them with SAMPLE data for Brgy. Ibaba East and Ibaba West.
// WARNING: this deletes existing data. Run with:  npm run db:setup
//
// Sample logins created here (development only — change or delete before going live):
//   Admin portal:  admin@calapan.test     / Admin123!
//   Resident app:  juan@calapan.test      / Resident123!
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

// NOTE: coordinates are approximate sample points near Calapan City proper.
// Replace them with the real locations of each evacuation center.
const CENTERS = [
  ['Ibaba East Elementary School', 'Ibaba East', 13.4152, 121.1822, 500, 312, ['Water', 'Medical', 'Food', 'Sleeping area']],
  ['Ibaba East Barangay Hall', 'Ibaba East', 13.4138, 121.1834, 150, 100, ['Water', 'Food', 'Sleeping area']],
  ['Ibaba West Covered Court', 'Ibaba West', 13.4129, 121.1771, 300, 280, ['Water', 'Medical', 'Food']],
  ['Ibaba West Multi-purpose Hall', 'Ibaba West', 13.4111, 121.1785, 150, 38, ['Water', 'Sleeping area']],
];

// [first, last, age, sex, contact, relationship, isPwd, status, centerName]
// status: 'safe' | 'evacuated' | 'need_help' | null (= unaccounted)
const HOUSEHOLDS = [
  { brgy: 'Ibaba East', family: 'Dela Cruz', purok: 'Purok 1', address: 'J.P. Rizal St.', members: [
    ['Juan', 'Dela Cruz', 34, 'male', '09170001234', 'Head', false, null],
    ['Maria', 'Dela Cruz', 32, 'female', '09170002231', 'Wife', false, 'safe'],
    ['Rosa', 'Dela Cruz', 78, 'female', null, 'Grandmother', false, null],
  ] },
  { brgy: 'Ibaba East', family: 'Manalo', purok: 'Purok 2', address: 'Del Pilar St.', members: [
    ['Pedro', 'Manalo', 45, 'male', '09280008812', 'Head', false, 'evacuated', 'Ibaba East Elementary School'],
    ['Liza', 'Manalo', 41, 'female', '09280008813', 'Wife', false, 'evacuated', 'Ibaba East Elementary School'],
  ] },
  { brgy: 'Ibaba East', family: 'Bautista', purok: 'Purok 3', address: 'M.H. del Pilar St.', members: [
    ['Ramon', 'Bautista', 60, 'male', '09150004420', 'Head', false, 'safe'],
  ] },
  { brgy: 'Ibaba East', family: 'Torres', purok: 'Purok 3', address: 'Leuterio St.', members: [
    ['Grace', 'Torres', 27, 'female', '09660007310', 'Head', false, 'safe'],
  ] },
  { brgy: 'Ibaba East', family: 'Castillo', purok: 'Purok 4', address: 'Aurora St.', members: [
    ['Andres', 'Castillo', 52, 'male', '09070001189', 'Head', true, null],
  ] },
  { brgy: 'Ibaba East', family: 'Reyes', purok: 'Purok 4', address: 'Aurora St.', members: [
    ['Josefina', 'Reyes', 69, 'female', '09190006604', 'Head', false, 'evacuated', 'Ibaba East Barangay Hall'],
  ] },
  { brgy: 'Ibaba East', family: 'Aquino', purok: 'Purok 5', address: 'Mabini St.', members: [
    ['Kevin', 'Aquino', 19, 'male', '09950003027', 'Head', false, 'safe'],
  ] },
  { brgy: 'Ibaba West', family: 'Ocampo', purok: 'Purok 1', address: 'Roxas Dr.', members: [
    ['Carmela', 'Ocampo', 29, 'female', '09170005530', 'Wife', false, 'safe'],
    ['Roberto', 'Ocampo', 31, 'male', '09170005531', 'Head', false, 'safe'],
  ] },
  { brgy: 'Ibaba West', family: 'Santiago', purok: 'Purok 2', address: 'Leuterio St.', members: [
    ['Leonora', 'Santiago', 74, 'female', null, 'Head', false, 'evacuated', 'Ibaba West Covered Court'],
  ] },
  { brgy: 'Ibaba West', family: 'Flores', purok: 'Purok 2', address: 'Leuterio St.', members: [
    ['Daniel', 'Flores', 38, 'male', '09280001402', 'Head', false, null],
  ] },
  { brgy: 'Ibaba West', family: 'Navarro', purok: 'Purok 3', address: 'Quezon Dr.', members: [
    ['Teresa', 'Navarro', 45, 'female', '09150009021', 'Head', false, 'evacuated', 'Ibaba West Covered Court'],
    ['Miguel', 'Navarro', 12, 'male', null, 'Son', false, 'evacuated', 'Ibaba West Covered Court'],
  ] },
  { brgy: 'Ibaba West', family: 'Domingo', purok: 'Purok 4', address: 'Coastal Rd.', members: [
    ['Felipe', 'Domingo', 66, 'male', '09070003348', 'Head', false, 'need_help'],
  ] },
  { brgy: 'Ibaba West', family: 'Ramos', purok: 'Purok 4', address: 'Coastal Rd.', members: [
    ['Angela', 'Ramos', 24, 'female', '09660002287', 'Head', false, 'safe'],
  ] },
  { brgy: 'Ibaba West', family: 'Mendoza', purok: 'Purok 5', address: 'Mabini St.', members: [
    ['Victor', 'Mendoza', 57, 'male', '09190007745', 'Head', true, 'evacuated', 'Ibaba West Multi-purpose Hall'],
  ] },
  { brgy: 'Ibaba West', family: 'Cruz', purok: 'Purok 5', address: 'Mabini St.', members: [
    ['Jasmine', 'Cruz', 21, 'female', '09950006150', 'Head', false, 'safe'],
  ] },
];

// [type, description, severity, status, address, brgy, lat, lng, reporter, minutesAgo]
const INCIDENTS = [
  ['flood', 'Knee-deep flood at the corner of J.P. Rizal and Del Pilar. Vehicles stranded.', 'high', 'responding', 'J.P. Rizal St., Ibaba East', 'Ibaba East', 13.4146, 121.1815, 'Maria Santos', 12],
  ['car_accident', 'Two vehicles collided due to low visibility. One injured.', 'high', 'pending', 'Roxas Dr., Ibaba West', 'Ibaba West', 13.4124, 121.1763, 'Jose Ramos', 39],
  ['fallen_tree', 'Acacia tree blocking both lanes of the road.', 'medium', 'responding', 'Leuterio St., Ibaba West', 'Ibaba West', 13.4118, 121.1779, 'Ana Villanueva', 56],
  ['power_outage', 'Power lines down near the barangay hall.', 'medium', 'pending', 'Aurora St., Ibaba East', 'Ibaba East', 13.4133, 121.1840, 'Rico Salazar', 70],
  ['fire', 'Electrical fire in a residential house, contained by BFP.', 'high', 'resolved', 'Purok 3, Ibaba West', 'Ibaba West', 13.4107, 121.1768, 'Mark Dizon', 94],
  ['flood', 'Waist-deep water, 6 families need rescue.', 'high', 'pending', 'Coastal Rd., Ibaba West', 'Ibaba West', 13.4135, 121.1758, 'Liza Garcia', 119],
  ['medical', 'Elderly resident needs an oxygen tank refill.', 'medium', 'responding', 'Purok 2, Ibaba East', 'Ibaba East', 13.4141, 121.1828, 'Nena Cruz', 134],
  ['flood', 'Ankle-deep water entering houses near the creek.', 'low', 'responding', 'Del Pilar St., Ibaba East', 'Ibaba East', 13.4150, 121.1808, 'Ben Lopez', 162],
];

const birthDate = (age) => `${new Date().getFullYear() - age}-03-15`;

const client = await pool.connect();
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await client.query('BEGIN');
  await client.query(schema);
  const one = async (sql, params) => (await client.query(sql, params)).rows[0];

  const brgy = {};
  for (const name of ['Ibaba East', 'Ibaba West']) {
    brgy[name] = (await one('INSERT INTO barangays (name) VALUES ($1) RETURNING id', [name])).id;
  }

  const center = {};
  for (const [name, b, lat, lng, capacity, occupancy, facilities] of CENTERS) {
    center[name] = (await one(
      `INSERT INTO evacuation_centers (name, barangay_id, address, lat, lng, capacity, current_occupancy, facilities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, brgy[b], `Brgy. ${b}, Calapan City`, lat, lng, capacity, occupancy, facilities],
    )).id;
  }

  const admin = await one(
    `INSERT INTO users (email, password_hash, role, display_name) VALUES ($1, $2, 'admin', $3) RETURNING id`,
    ['admin@calapan.test', await bcrypt.hash('Admin123!', 10), 'Engr. A. Reyes'],
  );

  const event = await one(
    `INSERT INTO disaster_events (name, type, signal_level, description, started_at)
     VALUES ($1, 'typhoon', 2, $2, now() - interval '6 hours') RETURNING id`,
    ['Typhoon "Kiko" (sample)', 'Expected landfall near Calapan City at 8:00 PM. Pre-emptive evacuation ongoing in Brgy. Ibaba East and Ibaba West.'],
  );

  let juanId = null;
  const counters = { 'Ibaba East': 0, 'Ibaba West': 0 };
  for (const h of HOUSEHOLDS) {
    const household = await one(
      'INSERT INTO households (barangay_id, family_name, purok, address) VALUES ($1, $2, $3, $4) RETURNING id',
      [brgy[h.brgy], h.family, h.purok, h.address],
    );
    for (const [first, last, age, sex, contact, rel, pwd, status, centerName] of h.members) {
      counters[h.brgy] += 1;
      const code = `RES-${h.brgy === 'Ibaba East' ? 'E' : 'W'}-${String(counters[h.brgy]).padStart(4, '0')}`;
      const r = await one(
        `INSERT INTO residents (resident_code, first_name, last_name, birth_date, sex, contact_number, barangay_id,
                                household_id, relationship, purok, address, is_pwd)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [code, first, last, birthDate(age), sex, contact, brgy[h.brgy], household.id, rel, h.purok, h.address, pwd],
      );
      if (first === 'Juan' && last === 'Dela Cruz') juanId = r.id;
      if (status) {
        await client.query(
          `INSERT INTO safety_checkins (resident_id, event_id, status, evacuation_center_id, created_at)
           VALUES ($1, $2, $3, $4, now() - (random() * interval '90 minutes'))`,
          [r.id, event.id, status, centerName ? center[centerName] : null],
        );
      }
    }
  }

  await client.query(
    `INSERT INTO users (email, password_hash, role, resident_id, display_name) VALUES ($1, $2, 'resident', $3, $4)`,
    ['juan@calapan.test', await bcrypt.hash('Resident123!', 10), juanId, 'Juan Dela Cruz'],
  );

  for (const [type, desc, sev, status, address, b, lat, lng, reporter, minsAgo] of INCIDENTS) {
    const inc = await one(
      `INSERT INTO incidents (type, description, severity, status, address, barangay_id, lat, lng, reporter_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - ($10 || ' minutes')::interval, now()) RETURNING id`,
      [type, desc, sev, status, address, brgy[b], lat, lng, reporter, minsAgo],
    );
    const steps = { pending: ['pending'], verified: ['pending', 'verified'], responding: ['pending', 'verified', 'responding'], resolved: ['pending', 'verified', 'responding', 'resolved'] }[status];
    const notes = { pending: 'Reported via the app', verified: 'Verified by CDRRMO operator', responding: 'Response team dispatched', resolved: 'Incident resolved' };
    for (const [i, s] of steps.entries()) {
      await client.query(
        `INSERT INTO incident_updates (incident_id, status, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, now() - ($5 || ' minutes')::interval)`,
        [inc.id, s, notes[s], s === 'pending' ? null : admin.id, Math.max(minsAgo - i * 4, 0)],
      );
    }
  }

  await client.query(
    `INSERT INTO alerts (title, message, level, created_by) VALUES ($1, $2, 'danger', $3)`,
    ['Typhoon Signal No. 2', 'Bagyong "Kiko" may hit Oriental Mindoro tonight. Prepare go-bags and be ready to evacuate.', admin.id],
  );

  await client.query('COMMIT');
  console.log('Database ready with sample data for Brgy. Ibaba East and Ibaba West.');
  console.log('Admin portal login:  admin@calapan.test / Admin123!');
  console.log('Resident app login:  juan@calapan.test / Resident123!');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
