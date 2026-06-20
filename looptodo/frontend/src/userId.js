const ID_KEY   = 'swu_userId';
const NAME_KEY = 'swu_userName';

let _id = localStorage.getItem(ID_KEY);
if (!_id) {
  _id = crypto.randomUUID();
  localStorage.setItem(ID_KEY, _id);
}

export const userId = _id;

// null  → user has never been through the welcome flow
// ""    → went through flow, chose guest
// "..." → went through flow, chose a custom name
export function getUserName() {
  return localStorage.getItem(NAME_KEY);
}

export function setUserName(name) {
  localStorage.setItem(NAME_KEY, typeof name === 'string' ? name.trim() : '');
}

// Returns null (not initialized) or a non-empty display string
export function getDisplayName() {
  const raw = localStorage.getItem(NAME_KEY);
  if (raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === '' ? `Guest-${_id.slice(0, 4).toUpperCase()}` : trimmed;
}
