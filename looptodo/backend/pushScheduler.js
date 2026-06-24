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
}

module.exports = { startPushScheduler, sendDailyReminders };
