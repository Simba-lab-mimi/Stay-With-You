const BASE = `${import.meta.env.VITE_API_URL ?? 'https://stay-with-you-backend.onrender.com'}/api`;

async function req(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkErr) {
    throw new Error('Could not reach server. Check your connection.');
  }
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
