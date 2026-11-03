import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { query } from './db.js';

// Push notifications go through Firebase Cloud Messaging (free). They reach the phone even when the app is closed.
// FIREBASE_SERVICE_ACCOUNT holds the Firebase service-account key: either the JSON itself (Render) or a file path (local).
// Without it the app still works; alerts just aren't pushed to phones.
let messaging = null;
function firebase() {
  if (messaging) return messaging;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    initializeApp({ credential: cert(raw.startsWith('{') ? JSON.parse(raw) : raw) });
    messaging = getMessaging();
  } catch (err) {
    console.warn('Firebase setup failed:', err.message);
  }
  return messaging;
}

// Send a notification to every registered phone (or only one barangay's).
// `route` is the app page to open when the resident taps the notification.
export async function sendPush({ title, body, route, barangayId = null }) {
  const fcm = firebase();
  if (!fcm) return { sent: 0, reason: 'Push notifications are not set up yet (FIREBASE_SERVICE_ACCOUNT is missing)' };

  const { rows } = await query(
    'SELECT token FROM push_tokens WHERE $1::int IS NULL OR barangay_id = $1 OR barangay_id IS NULL',
    [barangayId],
  );
  const tokens = rows.map((r) => r.token);
  let sent = 0;
  // FCM accepts at most 500 phones per call
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const result = await fcm.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: { route },
      android: { priority: 'high', notification: { channelId: 'alerts', sound: 'default', defaultVibrateTimings: true } },
    });
    sent += result.successCount;
    // Forget phones that uninstalled the app
    const dead = result.responses
      .map((r, j) => (!r.success && /registration-token-not-registered|invalid-registration-token/.test(r.error?.code ?? '') ? batch[j] : null))
      .filter(Boolean);
    if (dead.length) await query('DELETE FROM push_tokens WHERE token = ANY($1)', [dead]);
  }
  return { sent, phones: tokens.length };
}
