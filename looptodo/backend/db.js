/**
 * Storage layer — Supabase PostgreSQL with an in-memory read cache.
 *
 * Architecture:
 *   • Supabase tables use snake_case columns (PostgreSQL standard)
 *   • All routes and in-memory objects use camelCase (JavaScript standard)
 *   • This file is the only translation boundary between the two
 *
 * Why the cache?
 *   Route handlers call db functions synchronously (no await).
 *   Supabase is async, so we keep an in-memory mirror:
 *     – populated on startup via init() from Supabase
 *     – read synchronously by routes
 *     – written synchronously (memory) then persisted async to Supabase
 */

const supabase = require('./supabase');

// ── camelCase ↔ snake_case helpers ────────────────────────────────────────

function toSnake(key) {
  return key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

function toCamel(key) {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

// Convert all keys of a plain object from camelCase → snake_case
function snake(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), v]));
}

// Convert all keys of a plain object (or array of objects) from snake_case → camelCase
function camel(obj) {
  if (Array.isArray(obj)) return obj.map(camel);
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), v]));
}

// ── In-memory cache ────────────────────────────────────────────────────────

let _tasks       = [];   // camelCase objects
let _completions = [];   // camelCase objects

// ── Startup ────────────────────────────────────────────────────────────────

async function init() {
  const [{ data: tasks, error: te }, { data: completions, error: ce }] =
    await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('completions').select('*'),
    ]);

  if (te) throw new Error(`[db] init tasks: ${te.message}`);
  if (ce) throw new Error(`[db] init completions: ${ce.message}`);

  // Convert snake_case DB rows → camelCase in-memory objects
  _tasks       = camel(tasks       ?? []);
  _completions = camel(completions ?? []);

  console.log(`[db] loaded ${_tasks.length} tasks, ${_completions.length} completions`);
}

// ── Tasks ──────────────────────────────────────────────────────────────────

function getTasks() {
  return _tasks;
}

function getTask(id) {
  return _tasks.find(t => t.id === id) ?? null;
}

function insertTask(task) {
  _tasks.push(task);
  // Convert camelCase → snake_case before writing to Supabase
  supabase.from('tasks').insert(snake(task)).then(({ error }) => {
    if (error) console.error('[db] insertTask:', error.message);
  });
  return task;
}

function updateTask(id, patch) {
  const idx = _tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  _tasks[idx] = { ..._tasks[idx], ...patch };
  supabase.from('tasks').update(snake(patch)).eq('id', id).then(({ error }) => {
    if (error) console.error('[db] updateTask:', error.message);
  });
  return _tasks[idx];
}

// ── Completions ────────────────────────────────────────────────────────────

function getCompletions() {
  return _completions;
}

function insertCompletion(completion) {
  _completions.push(completion);
  supabase.from('completions').insert(snake(completion)).then(({ error }) => {
    if (error) console.error('[db] insertCompletion:', error.message);
  });
  return completion;
}

function deleteCompletion(id) {
  _completions = _completions.filter(c => c.id !== id);
  supabase.from('completions').delete().eq('id', id).then(({ error }) => {
    if (error) console.error('[db] deleteCompletion:', error.message);
  });
}

function deleteCompletions(ids) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids);
  _completions = _completions.filter(c => !idSet.has(c.id));
  supabase.from('completions').delete().in('id', ids).then(({ error }) => {
    if (error) console.error('[db] deleteCompletions:', error.message);
  });
}

// ── Purge ──────────────────────────────────────────────────────────────────

async function purgeExpiredTasks() {
  const ONE_HOUR  = 60 * 60 * 1000;
  const now       = Date.now();
  const cutoff    = new Date(now - ONE_HOUR).toISOString();
  const surviving = new Set();

  // 1. Prune in-memory cache (uses camelCase field names)
  _tasks = _tasks.filter(t => {
    if (!t.deletedAt) { surviving.add(t.id); return true; }
    const keep = now - new Date(t.deletedAt).getTime() < ONE_HOUR;
    if (keep) surviving.add(t.id);
    return keep;
  });
  _completions = _completions.filter(c => surviving.has(c.taskId));

  // 2. Prune Supabase (uses snake_case column names)
  const { data: expired, error: fe } = await supabase
    .from('tasks')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  if (fe) { console.error('[db] purge fetch:', fe.message); return; }
  if (!expired || expired.length === 0) return;

  const ids = expired.map(t => t.id);

  const { error: ce } = await supabase.from('completions').delete().in('task_id', ids);
  if (ce) console.error('[db] purge completions:', ce.message);

  const { error: te } = await supabase.from('tasks').delete().in('id', ids);
  if (te) console.error('[db] purge tasks:', te.message);

  console.log(`[db] purged ${ids.length} expired task(s) from Supabase`);
}

module.exports = {
  init,
  getTasks, getTask, insertTask, updateTask,
  getCompletions, insertCompletion,
  deleteCompletion, deleteCompletions,
  purgeExpiredTasks,
};
