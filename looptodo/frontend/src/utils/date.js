/**
 * Returns the current date in the user's LOCAL timezone as YYYY-MM-DD.
 *
 * Why not toISOString().split('T')[0]?
 * toISOString() always returns UTC. A user completing a task at 11 PM in
 * Chicago (UTC-5) would get tomorrow's UTC date, recording the wrong day.
 * getFullYear/getMonth/getDate always use the browser's local timezone.
 */
export function localDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
