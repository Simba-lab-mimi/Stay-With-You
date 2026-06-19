/**
 * Minimal JSON flat-file store.
 * Stores tasks and completions in looptodo.json next to this file.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'looptodo.json');

const EMPTY = { tasks: [], completions: [] };

function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Tasks ──────────────────────────────────────────────────────────────────

function getTasks() {
  return read().tasks;
}

function getTask(id) {
  return read().tasks.find(t => t.id === id) || null;
}

function insertTask(task) {
  const data = read();
  data.tasks.push(task);
  write(data);
  return task;
}

function updateTask(id, patch) {
  const data = read();
  const idx = data.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  data.tasks[idx] = { ...data.tasks[idx], ...patch };
  write(data);
  return data.tasks[idx];
}

// ── Completions ────────────────────────────────────────────────────────────

function getCompletions() {
  return read().completions;
}

function insertCompletion(completion) {
  const data = read();
  data.completions.push(completion);
  write(data);
  return completion;
}

function deleteCompletion(id) {
  const data = read();
  data.completions = data.completions.filter(c => c.id !== id);
  write(data);
}

function deleteCompletions(ids) {
  const idSet = new Set(ids);
  const data = read();
  data.completions = data.completions.filter(c => !idSet.has(c.id));
  write(data);
}

module.exports = {
  getTasks, getTask, insertTask, updateTask,
  getCompletions, insertCompletion,
  deleteCompletion, deleteCompletions,
};
