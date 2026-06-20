// Stable anonymous identity stored in localStorage.
// Generated once per browser, survives page reloads and PWA restarts.
// Intentionally NOT tied to any login — this is a single-user offline-first ID.

const KEY = 'swu_userId';

let id = localStorage.getItem(KEY);
if (!id) {
  id = crypto.randomUUID();
  localStorage.setItem(KEY, id);
}

export const userId = id;
