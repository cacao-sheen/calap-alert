# Calap Alert — project notes for Claude

Disaster-response app for **Brgy. Ibaba East** and **Brgy. Ibaba West**, Calapan City (Oriental Mindoro, PH).
School final project. The student is a beginner: explain steps simply, one command at a time, in plain English.

## Structure
| Folder | Tech | Port |
|---|---|---|
| `backend/` | Node.js (ESM) + Express 5 + `pg` (PostgreSQL, hosted on Neon) + JWT auth | 4000 |
| `mobile/` | **Ionic React** 8 + Vite + Capacitor 7, react-router v5 — resident app | 5173 |
| `admin/` | **Ionic React** 8 + Vite, react-router v5 — admin web portal (IonSplitPane + IonMenu) | 5174 |

- Both frontends MUST stay Ionic React (school requirement). Use Ionic components (IonPage, IonCard, IonButton, IonModal, IonToast, etc.), not plain HTML widgets, unless Ionic has no equivalent (e.g. tables).
- Only two barangays: Ibaba East and Ibaba West. Do not add others.
- Maps: MapLibre GL + OpenFreeMap "liberty" style (free, no API key), 3D buildings. Weather: Open-Meteo (free, no key), proxied by `backend/src/routes/weather.js`.
- Frontends call the API through `src/api.ts` (`VITE_API_URL`, default `http://localhost:4000`).
- Pages load data with `usePageLoad()` from `src/hooks.ts` (runs on mount AND on Ionic view enter). Use it instead of bare `useIonViewWillEnter`.
- Maps resize themselves with a ResizeObserver (Ionic creates pages before they're visible).

## Backend
- Entry `backend/src/index.js`; routes in `backend/src/routes/`; shared SQL in `backend/src/queries.js`.
- Schema: `backend/db/schema.sql`. Seed + sample logins: `backend/scripts/setup-db.js` (`npm run db:setup` — **erases all data**).
- Safety status per resident = latest `safety_checkins` row for the active `disaster_events` row; no row = `unaccounted`.
- Errors meant for users: `throw httpError(status, message)` from `src/http.js`. Express 5 catches async errors.
- Env vars in `backend/.env` (copy from `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`. Never commit `.env`.

## Commands
```
cd backend && npm install && npm run db:setup && npm run dev
cd admin   && npm install && npm run dev
cd mobile  && npm install && npm run dev
npm run build      # in admin/ or mobile/ — runs tsc + vite build; use it to check for errors
```

## Sample logins (dev only, created by db:setup)
- Admin: admin@calapan.test / Admin123!
- Resident: juan@calapan.test / Resident123!

## Rules for changes
- Keep code style: TypeScript strict, small components, comments only where the "why" isn't obvious.
- After changing a frontend, run `npm run build` in that folder to make sure it compiles.
- After changing the database schema, update `schema.sql` AND `setup-db.js`, and tell the user to re-run `npm run db:setup`.
- Don't put the database URL or passwords in frontend code.
