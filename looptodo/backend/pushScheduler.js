const webpush = require('web-push');
const supabase = require('./supabase');
const db       = require('./db');

// Returns YYYY-MM-DD for a given IANA timezone string
function localDateInTz(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find(p => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    const d = new Date();
    return [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, '0'),
      String(d.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }
}

// Returns the current hour (0-23) in a given IANA timezone
function localHourInTz(tz) {
  try {
    const s = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', hour12: false,
    }).format(new Date());
    return Number(s);
  } catch {
    return new Date().getUTCHours();
  }
}

async function sendDailyReminders() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return;

  webpush.setVapidDetails(subj, pub, priv);

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (error) { console.error('[push] fetch subs:', error.message); return; }
  if (!subs?.length) return;

  for (const sub of subs) {
    const tz    = sub.timezone || 'UTC';
    const today = localDateInTz(tz);
    const hour  = localHourInTz(tz);

    // Only send from 8 AM onwards in user's local time
    if (hour < 8) continue;

    // Don't send more than once per local calendar day
    if (sub.last_sent_date === today) continue;

    // Check if this user has any pending tasks for today
    const tasks = db.getTasks().filter(
      t => t.userId === sub.user_id &&
           t.isActive &&
           !t.deletedAt &&
           !t.isPaused &&
           t.nextDueDate <= today
    );
    if (tasks.length === 0) continue;

    const count = tasks.length;
    const payload = JSON.stringify({
      title: 'Stay With You 💙',
      body:  `You have ${count} task${count !== 1 ? 's' : ''} waiting for you today.`,
      url:   '/',
    });

    try {
      await webpush.sendNotification(sub.subscription, payload);
      await supabase.from('push_subscriptions')
        .update({ last_sent_date: today, last_sent_at: new Date().toISOString() })
        .eq('id', sub.id);
      console.log(`[push] sent daily reminder → user ${sub.user_id} (${tz})`);
    } catch (err) {
      console.error(`[push] send failed for ${sub.endpoint.slice(0, 60)}…:`, err.message);
      // 410 Gone / 404 = subscription no longer valid
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
        console.log(`[push] deactivated expired subscription (user ${sub.user_id})`);
      }
    }
  }
}

// ── Temporary scheduler test (2026-06-24 22:47 Asia/Shanghai) ─────────────
// Remove this block after confirming the test notification arrives.
async function sendSchedulerTestNotification() {
  console.log('[push-test] scheduler triggered');

  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    console.error('[push-test] VAPID keys not configured, aborting');
    return;
  }
  webpush.setVapidDetails(subj, pub, priv);

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (error) { console.error('[push-test] DB error:', error.message); return; }
  if (!subs?.length) { console.log('[push-test] no active subscriptions found'); return; }

  const payload = JSON.stringify({
    title: 'Stay With You 💙',
    body:  'This is an automatic scheduler test.\nIf you received this message, the daily reminder system is working correctly.',
    url:   '/',
  });

  for (const sub of subs) {
    console.log(`[push-test] sending notification to user: ${sub.user_id}`);
    try {
      await webpush.sendNotification(sub.subscription, payload);
      console.log(`[push-test] notification sent successfully → user ${sub.user_id}`);
    } catch (err) {
      console.error(`[push-test] send failed for user ${sub.user_id}:`, err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id);
      }
    }
  }
}

function scheduleOneTimeTest() {
  // Target: 2026-06-24 22:47:00 Asia/Shanghai (UTC+8) = 2026-06-24T14:47:00Z
  const TARGET_UTC = new Date('2026-06-24T14:47:00Z');
  const delay = TARGET_UTC.getTime() - Date.now();

  if (delay < 0) {
    console.log('[push-test] target time already passed, skipping one-time test');
    return;
  }

  const minutesUntil = Math.round(delay / 60000);
  console.log(`[push-test] one-time test scheduled for 22:47 Asia/Shanghai (~${minutesUntil} min from now)`);
  setTimeout(sendSchedulerTestNotification, delay);
}
// ── End temporary test block ───────────────────────────────────────────────

function startPushScheduler() {
  const configured = !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );

  if (!configured) {
    console.log('[push] VAPID keys not set — daily reminders disabled');
    return;
  }

  // Check every 10 minutes; sends once per user per local calendar day after 8 AM
  const INTERVAL_MS = 10 * 60 * 1000;
  setInterval(sendDailyReminders, INTERVAL_MS);

  // First run 30 s after startup (db.init() will have completed by then)
  setTimeout(sendDailyReminders, 30_000);

  console.log('[push] daily reminder scheduler started (checks every 10 min)');

  // Temporary one-time test — remove after confirmation
  scheduleOneTimeTest();
}

module.exports = { startPushScheduler, sendDailyReminders };
