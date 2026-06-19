/**
 * Compute next due date after completing a task on `fromDate` (YYYY-MM-DD).
 * Returns the next YYYY-MM-DD string.
 */
function computeNextDueDate(task, fromDate) {
  const from = new Date(fromDate + 'T12:00:00');

  if (task.recurrenceType === 'daily') {
    const next = new Date(from);
    next.setDate(next.getDate() + 1);
    return toDateStr(next);
  }

  if (task.recurrenceType === 'interval') {
    const days = task.intervalDays || 1;
    const next = new Date(from);
    next.setDate(next.getDate() + days);
    return toDateStr(next);
  }

  if (task.recurrenceType === 'weekly') {
    const weekdays = Array.isArray(task.weekdays)
      ? task.weekdays
      : JSON.parse(task.weekdays || '[]');

    if (weekdays.length === 0) return null;

    const next = new Date(from);
    for (let i = 1; i <= 7; i++) {
      next.setDate(from.getDate() + i);
      if (weekdays.includes(next.getDay())) {
        return toDateStr(next);
      }
    }
  }

  return null;
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

module.exports = { computeNextDueDate };
