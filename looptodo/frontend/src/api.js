const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getTodayTasks = (date) =>
  req(`/tasks/today?date=${date}`);

export const createTask = (data) =>
  req('/tasks', { method: 'POST', body: JSON.stringify(data) });

export const completeTask = (id, date) =>
  req(`/tasks/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ completedAt: date }),
  });

export const deleteTask = (id) =>
  req(`/tasks/${id}`, { method: 'DELETE' });

export const getHistory = () =>
  req('/completions');

export const getStreaks = () =>
  req('/completions/streaks');

export const deleteCompletion = (id) =>
  req(`/completions/${id}`, { method: 'DELETE' });

export const deleteCompletions = (ids) =>
  req('/completions/batch', { method: 'DELETE', body: JSON.stringify({ ids }) });
