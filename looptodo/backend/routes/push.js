const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const supabase = require('../supabase');

// Error codes for "relation/table does not exist"
// 42P01  = raw Postgres; PGRST205 = Supabase PostgREST wrapper
const TABLE_MISSING_CODES = new Set(['42P01', 'PGRST205']);

function vapidReady() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webpush.setVapidDetails(subj, pub, priv);
  return true;
}

// GET /api/push/health
router.get('/health', (_req, res) => {
  res.json({ ok: true, push: true, vapid: vapidReady() });
});

// POST /api/push/subscribe
// Body: { userId, subscription, timezone? }
router.post('/subscribe', async (req, res) => {
  const { userId, subscription, timezone } = req.body;
  if (!userId || !subscription?.endpoint) {
    return res.status(400).json({ error: 'userId and subscription.endpoint are required' });
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id:     userId,
    endpoint:    subscription.endpoint,
    subscription,
    timezone:    timezone || 'UTC',
    is_active:   true,
  }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push] subscribe error:', error.message, error.code);
    if (TABLE_MISSING_CODES.has(error.code)) {
      return res.status(503).json({
        error: 'push_subscriptions table does not exist — run the Supabase SQL migration first',
      });
    }
    return res.status(500).json({ error: 'Failed to save subscription: ' + error.message });
  }

  res.json({ ok: true });
});

// POST /api/push/unsubscribe
// Body: { userId, endpoint }
router.post('/unsubscribe', async (req, res) => {
  const { userId, endpoint } = req.body;
  if (!userId || !endpoint) {
    return res.status(400).json({ error: 'userId and endpoint are required' });
  }

  const { error } = await supabase.from('push_subscriptions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push] unsubscribe error:', error.message, error.code);
    if (TABLE_MISSING_CODES.has(error.code)) {
      return res.status(503).json({ error: 'push_subscriptions table does not exist' });
    }
    return res.status(500).json({ error: 'Failed to unsubscribe: ' + error.message });
  }

  res.json({ ok: true });
});

// POST /api/push/test
// Body: { userId }
router.post('/test', async (req, res) => {
  if (!vapidReady()) {
    return res.status(503).json({
      error: 'VAPID keys not configured — set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT on the server',
    });
  }

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('[push] test — DB fetch error:', error.message, error.code);
    if (TABLE_MISSING_CODES.has(error.code)) {
      return res.status(503).json({
        error: 'push_subscriptions table does not exist — run the Supabase SQL migration first',
      });
    }
    return res.status(500).json({ error: 'DB error: ' + error.message });
  }

  if (!subs?.length) {
    return res.status(404).json({
      error: 'No active push subscription found for this userId. Subscribe first from the browser.',
    });
  }

  const payload = JSON.stringify({
    title: 'Stay With You 💙',
    body:  'Test notification — your push reminders are working!',
    url:   '/',
  });

  let sent = 0;
  const errors = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (err) {
      errors.push(err.message);
      console.error('[push] test send failed:', err.message);
      // 410 Gone / 404 = browser revoked the subscription
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
        console.log('[push] deactivated expired subscription id', sub.id);
      }
    }
  }

  res.json({ sent, total: subs.length, errors: errors.length ? errors : undefined });
});

module.exports = router;
