const webpush = require('web-push');
const supabase = require('./supabase');
const db       = require('./db');

// All daily reminder timing is pinned to this timezone.
// America/Phoenix = UTC-7 year-round (no daylight saving time).
const REMINDER_TZ     = 'America/Phoenix';
const SEND_AFTER_HOUR = 9;
const SEND_AFTER_MIN  = 30;   // send on or after 09:30 Phoenix time

// ── Timezone helpers ──────────────────────────────────────────────────────────

// Returns YYYY-MM-DD for a given IANA timezone string.
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

// Returns { hour, minute } for the current moment in a given IANA timezone.
function localTimeInTz(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:   'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    return {
      hour:   Number(parts.find(p => p.type === 'hour')?.value   ?? 0),
      minute: Number(parts.find(p => p.type === 'minute')?.value ?? 0),
    };
  } catch {
    const d = new Date();
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }
}

// ── Daily reminder logic ──────────────────────────────────────────────────────

async function sendDailyReminders() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return;

  webpush.setVapidDetails(subj, pub, priv);

  // ── Gate: only proceed after 09:30 America/Phoenix ──
  const { hour, minute } = localTimeInTz(REMINDER_TZ);
  const afterSendTime = hour > SEND_AFTER_HOUR ||
    (hour === SEND_AFTER_HOUR && minute >= SEND_AFTER_MIN);

  if (!afterSendTime) {
    console.log(
      `[push] scheduler check: ${hour}:${String(minute).padStart(2,'0')} Phoenix — ` +
      `before ${SEND_AFTER_HOUR}:${String(SEND_AFTER_MIN).padStart(2,'0')}, skipping`
    );
    return;
  }

  // Today's date in Phoenix — used for dedup and task checking.
  const todayPhoenix = localDateInTz(REMINDER_TZ);
  console.log(`[push] scheduler check: ${hour}:${String(minute).padStart(2,'0')} Phoenix, date=${todayPhoenix}`);

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('is_active', true);

  if (error) { console.error('[push] fetch subs:', error.message); return; }
  if (!subs?.length) { console.log('[push] no active subscriptions'); return; }

  for (const sub of subs) {
    // ── Per-user dedup: at most one notification per Phoenix calendar day ──
    if (sub.last_sent_date === todayPhoenix) {
      console.log(`[push] already sent today (${todayPhoenix}) to user ${sub.user_id}, skipping`);
      continue;
    }

    // ── Check pending tasks using Phoenix date ──
    const tasks = db.getTasks().filter(
      t => t.userId === sub.user_id &&
           t.isActive &&
           !t.deletedAt &&
           !t.isPaused &&
           t.nextDueDate <= todayPhoenix
    );

    if (tasks.length === 0) {
      console.log(`[push] no pending tasks for user ${sub.user_id} on ${todayPhoenix}, skipping`);
      continue;
    }

    const count   = tasks.length;
    const payload = JSON.stringify({
      title: 'Stay With You 💙',
      body:  `You have ${count} task${count !== 1 ? 's' : ''} waiting for you today.`,
      url:   '/',
    });

    try {
      await webpush.sendNotification(sub.subscription, payload);
      await supabase.from('push_subscriptions')
        .update({
          last_sent_date: todayPhoenix,
          last_sent_at:   new Date().toISOString(),
          updated_at:     new Date().toISOString(),
        })
        .eq('id', sub.id);
      console.log(`[push] sent daily reminder → user ${sub.user_id}, date=${todayPhoenix}`);
    } catch (err) {
      console.error(`[push] send failed for user ${sub.user_id}:`, err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', sub.id);
        console.log(`[push] deactivated expired subscription (user ${sub.user_id})`);
      }
    }
  }
}

// ── Scheduler startup ─────────────────────────────────────────────────────────

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

  // Check every 10 minutes.
  // Each run is a no-op before 09:30 Phoenix; fires once per user per day after that.
  const INTERVAL_MS = 10 * 60 * 1000;
  setInterval(sendDailyReminders, INTERVAL_MS);

  // First run 30 s after startup (after db.init() completes).
  setTimeout(sendDailyReminders, 30_000);

  console.log(
    `[push] daily reminder scheduler started — fires after ${SEND_AFTER_HOUR}:` +
    `${String(SEND_AFTER_MIN).padStart(2,'0')} ${REMINDER_TZ} (checks every 10 min)`
  );
}

module.exports = { startPushScheduler, sendDailyReminders };
