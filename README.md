# Calap Alert 🌀

**Calap Alert** is a disaster-response app for **Brgy. Ibaba East** and **Brgy. Ibaba West**, Calapan City.

| Folder | What it is | Tech |
|---|---|---|
| `backend/` | REST API and database | Node.js, Express, PostgreSQL |
| `mobile/` | Resident app | Ionic React (Capacitor for Android/iOS) |
| `admin/` | Admin web portal | Ionic React (runs in the browser) |

```
 [Ionic app: residents] ──┐
                          ├──►  [Express API: backend/]  ──►  [PostgreSQL (Neon)]
 [Ionic admin web: admin/] ┘
```

## Features

**Resident app**
- Live weather for Calapan City (Open-Meteo, free) and the typhoon signal / alert banner
- Report incidents (car accident, fire, flood, landslide, medical, power outage, fallen tree, other) with GPS location, photo and severity
- **3D map** (MapLibre + OpenFreeMap, free, no API key) with evacuation centers, incidents, your location, nearest center and directions
- Evacuation centers with live capacity
- Safety check-in: **I'm Safe**, **I'm at an evacuation center**, **I Need Help**, plus your household's status
- Sign up and log in

**Admin portal**
- Dashboard: totals, status per barangay (safe / evacuated / need help / unaccounted), weather, 3D map, recent incidents, evacuation capacity
- Start or update a typhoon alert (signal level) and **send alerts** to one or both barangays
- **Residents** per barangay: who is safe, evacuated, needs help or unaccounted, with seniors and PWD tagged. Officials can record a status for residents without phones. Add new residents.
- **Incident reports**: filter, view the photo and map, then verify, dispatch and resolve with a timeline
- **Evacuation centers**: update evacuee counts, capacity, and open/closed

---

## 1. What to install (one time)

1. **Node.js 20 or newer**: https://nodejs.org (choose LTS)
2. **Visual Studio Code**: https://code.visualstudio.com
3. A **PostgreSQL database**. The easiest free option is **Neon**:
   - Sign up at https://neon.tech, then create a project (region: Singapore is closest)
   - Copy the **connection string** (it looks like `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`)

## 2. Open in VS Code

Double-click `calap-alert.code-workspace` (or in VS Code: **File → Open Workspace from File…**).
You will see the three folders: backend, mobile, admin.

## 3. Start the backend (API)

Open a terminal in VS Code (**Terminal → New Terminal**) and pick the `backend` folder:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and paste your Neon connection string into `DATABASE_URL`. Then:

```bash
npm run db:setup
```

This creates the tables and sample data. **Warning: it erases existing data**, so run it only the first time or when you want to reset.

```bash
npm run dev
```

The API runs at http://localhost:4000 (test it: http://localhost:4000/api/health).

## 4. Start the admin portal

New terminal:

```bash
cd admin
npm install
npm run dev
```

Open http://localhost:5174

## 5. Start the resident app

New terminal:

```bash
cd mobile
npm install
npm run dev
```

Open http://localhost:5173. In Chrome, press F12 and click the phone icon to see it in phone size.

## Sample logins (development only)

Created by `npm run db:setup` (see `backend/scripts/setup-db.js`):

| App | Email | Password |
|---|---|---|
| Admin portal | `admin@calapan.test` | `Admin123!` |
| Resident app | `juan@calapan.test` | `Resident123!` |

Change these or delete them before real use. All names, numbers and the typhoon "Kiko" in the sample data are made up.
The evacuation-center and incident coordinates are approximate. Replace them with the real locations in `backend/scripts/setup-db.js`.

---

## Run the app on an Android phone

Requires **Android Studio** (https://developer.android.com/studio).

```bash
cd mobile
npx cap add android
```

Then set the API address so the phone can reach it. Create `mobile/.env`:

- Android emulator: `VITE_API_URL=http://10.0.2.2:4000`
- Real phone on the same Wi-Fi: `VITE_API_URL=http://<your-computer-IP>:4000`
- After deploying the API: `VITE_API_URL=https://your-api.onrender.com`

```bash
npm run android
```

This builds the app, copies it into the Android project, and opens Android Studio. Press ▶ Run.
For a phone to use `http://` (not https) you may need to allow cleartext traffic. Deploying the API with https avoids this.

## Put it online (free tiers)

| Part | Where | Notes |
|---|---|---|
| Database | Neon | already done in step 1 |
| API (`backend/`) | Render.com → New Web Service | Root directory `backend`, build `npm install`, start `npm start`. Add env vars `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your admin URL). The free plan sleeps when idle, so the first request takes ~30 s. |
| Admin (`admin/`) | Vercel or Netlify | Root directory `admin`, build `npm run build`, output `dist`, env var `VITE_API_URL` = your Render URL. Add a rewrite of all paths to `/index.html`. |
| Mobile app | Android Studio | set `VITE_API_URL` to your Render URL, then `npm run android` |

## API overview

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/register` | anyone |
| GET | `/api/auth/me` | logged in |
| GET | `/api/barangays`, `/api/weather`, `/api/events/active`, `/api/alerts`, `/api/evacuation-centers` | anyone |
| PUT / POST | `/api/events/active`, `/api/events/active/end` | admin |
| POST | `/api/alerts` | admin |
| PATCH | `/api/evacuation-centers/:id` | admin |
| GET / POST | `/api/incidents`, GET `/api/incidents/:id` | logged in |
| PATCH | `/api/incidents/:id/status` | admin |
| POST / GET | `/api/checkins`, `/api/checkins/me`, `/api/checkins/household` | resident |
| GET / POST | `/api/residents`, POST `/api/residents/:id/checkin` | admin |
| GET | `/api/dashboard/summary` | admin |

## Database tables

`barangays`, `households`, `residents`, `users`, `evacuation_centers`, `disaster_events`,
`safety_checkins`, `incidents`, `incident_updates`, `alerts`. See `backend/db/schema.sql`.

A resident with **no check-in for the active disaster event** counts as **unaccounted**.
When the admin ends an event, everyone starts fresh for the next one.

## Troubleshooting

- **`npm install` fails with an "esbuild" error**: the folder path is too long for Windows. Move the project to a shorter path like `C:\projects\Calap-Alert`.
- **"Cannot reach the server"**: start the backend first (`npm run dev` in `backend/`).
- **Login says "Wrong email or password"**: run `npm run db:setup` once to create the sample accounts.

## Ideas for next steps

- Push notifications for alerts (Firebase Cloud Messaging + `@capacitor/push-notifications`)
- Store photos in cloud storage instead of the database
- SMS alerts for residents without smartphones
- Offline mode for the resident app (cache centers and the last alert)
