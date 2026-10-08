import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import barangayRoutes from './routes/barangays.js';
import weatherRoutes from './routes/weather.js';
import eventRoutes from './routes/events.js';
import alertRoutes from './routes/alerts.js';
import centerRoutes from './routes/centers.js';
import incidentRoutes from './routes/incidents.js';
import checkinRoutes from './routes/checkins.js';
import residentRoutes from './routes/residents.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();

const origins = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins?.length ? origins : true }));
app.use(express.json({ limit: '6mb' })); // incident photos are sent as data URLs

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/barangays', barangayRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/evacuation-centers', centerRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  if (err.code === '23505') return res.status(409).json({ error: 'That record already exists' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The photo is too large' });
  if (!err.expose) console.error(err);
  res.status(err.status || 500).json({ error: err.expose ? err.message : 'Something went wrong on the server' });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Calap Alert API running on http://localhost:${port}`));
