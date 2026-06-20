import { userId } from './userId.js';

const BASE = `${import.meta.env.VITE_API_URL ?? 'https://stay-with-you-backend.onrender.com'}/api`;

async function req(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Could not reach server. Check your connection.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Today ───────────────────────────────────────────────────────────────────
export const getTodayTasks = (date) =>
  req(`/tasks/today?date=${date}&userId=${userId}`);

// ── Task management ──────────────────────────────────────────────────────────
export const getActiveTasks = () =>
  req(`/tasks?userId=${userId}&status=active`);

export const getDeletedTasks = () =>
  req(`/tasks?userId=${userId}&status=deleted`);

export const createTask = (data) =>
  req('/tasks', { method: 'POST', body: JSON.stringify({ ...data, userId }) });

export const completeTask = (id, date) =>
  req(`/tasks/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ completedAt: date, userId }),
  });

export const deleteTask = (id) =>
  req(`/tasks/${id}?userId=${userId}`, { method: 'DELETE' });

export const restoreTask = (id) =>
  req(`/tasks/${id}/restore?userId=${userId}`, { method: 'POST' });

export const pauseTask = (id) =>
  req(`/tasks/${id}/pause?userId=${userId}`, { method: 'POST' });

// ── Completions ──────────────────────────────────────────────────────────────
export const getHistory = () =>
  req(`/completions?userId=${userId}`);

export const getStreaks = () =>
  req(`/completions/streaks?userId=${userId}`);

export const deleteCompletion = (id) =>
  req(`/completions/${id}?userId=${userId}`, { method: 'DELETE' });

export const deleteCompletions = (ids) =>
  req('/completions/batch', { method: 'DELETE', body: JSON.stringify({ ids, userId }) });
