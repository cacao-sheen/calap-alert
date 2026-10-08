-- Calap Alert database schema (PostgreSQL)
-- Covers Brgy. Ibaba East and Brgy. Ibaba West, Calapan City.
-- WARNING: running this file DELETES the existing tables and their data.

DROP TABLE IF EXISTS incident_updates, incidents, safety_checkins, alerts,
  disaster_events, users, residents, households, evacuation_centers, barangays CASCADE;

CREATE TABLE barangays (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL DEFAULT 'Calapan City'
);

CREATE TABLE households (
  id          SERIAL PRIMARY KEY,
  barangay_id INT  NOT NULL REFERENCES barangays(id),
  family_name TEXT NOT NULL,
  purok       TEXT,
  address     TEXT
);

CREATE TABLE residents (
  id             SERIAL PRIMARY KEY,
  resident_code  TEXT UNIQUE,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  birth_date     DATE,
  sex            TEXT CHECK (sex IN ('male', 'female')),
  contact_number TEXT,
  barangay_id    INT  NOT NULL REFERENCES barangays(id),
  household_id   INT  REFERENCES households(id) ON DELETE SET NULL,
  relationship   TEXT,                 -- e.g. Head, Wife, Son, Grandmother
  purok          TEXT,
  address        TEXT,
  is_pwd         BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX residents_barangay_idx ON residents (barangay_id);

-- Login accounts. Residents are linked to a resident record; admins are not.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'resident')),
  resident_id   INT UNIQUE REFERENCES residents(id) ON DELETE CASCADE,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE evacuation_centers (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  barangay_id       INT  NOT NULL REFERENCES barangays(id),
  address           TEXT,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  capacity          INT  NOT NULL CHECK (capacity > 0),
  current_occupancy INT  NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  facilities        TEXT[] NOT NULL DEFAULT '{}',
  is_open           BOOLEAN NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A typhoon / flood / etc. Safety check-ins belong to the active event.
CREATE TABLE disaster_events (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'typhoon',
  signal_level INT CHECK (signal_level BETWEEN 0 AND 5),
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at     TIMESTAMPTZ
);

-- "I'm safe" / "I'm at an evacuation center" / "I need help".
-- A resident with no check-in for the active event is counted as unaccounted.
CREATE TABLE safety_checkins (
  id                   SERIAL PRIMARY KEY,
  resident_id          INT  NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  event_id             INT  NOT NULL REFERENCES disaster_events(id) ON DELETE CASCADE,
  status               TEXT NOT NULL CHECK (status IN ('safe', 'evacuated', 'need_help')),
  evacuation_center_id INT  REFERENCES evacuation_centers(id) ON DELETE SET NULL,
  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  note                 TEXT,
  recorded_by          INT  REFERENCES users(id) ON DELETE SET NULL,  -- set when an admin records it
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX safety_checkins_latest_idx ON safety_checkins (resident_id, event_id, created_at DESC);

CREATE TABLE incidents (
  id            SERIAL PRIMARY KEY,
  type          TEXT NOT NULL CHECK (type IN ('flood', 'fire', 'car_accident', 'landslide',
                                              'medical', 'power_outage', 'fallen_tree', 'other')),
  description   TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'responding', 'resolved')),
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  address       TEXT,
  barangay_id   INT  REFERENCES barangays(id),
  photo         TEXT,                  -- image as a data URL (fine for a prototype; use file storage later)
  reported_by   INT  REFERENCES users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX incidents_created_idx ON incidents (created_at DESC);

-- Timeline of status changes for an incident
CREATE TABLE incident_updates (
  id          SERIAL PRIMARY KEY,
  incident_id INT  NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  created_by  INT  REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Announcements sent by the admin ("Send Alert")
CREATE TABLE alerts (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('info', 'warning', 'danger')),
  barangay_id INT  REFERENCES barangays(id),   -- NULL = both barangays
  created_by  INT  REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
