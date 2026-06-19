const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/completions
router.get('/', (req, res) => {
  const completions = db.getCompletions();
  const tasks = db.getTasks();
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));

  const result = completions
    .filter(c => taskMap[c.taskId])
    .map(c => ({
      ...c,
      title: taskMap[c.taskId].title,
      recurrenceType: taskMap[c.taskId].recurrenceType,
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 200);

  res.json(result);
});

// GET /api/completions/streaks
router.get('/streaks', (req, res) => {
  const completions = db.getCompletions();
  const tasks = db.getTasks();
  const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));

  const counts = {};
  completions.forEach(c => {
    counts[c.taskId] = (counts[c.taskId] || 0) + 1;
  });

  const result = Object.entries(counts)
    .filter(([id]) => taskMap[id])
    .map(([taskId, streak]) => ({ taskId, streak, title: taskMap[taskId].title }))
    .sort((a, b) => b.streak - a.streak);

  res.json(result);
});

// DELETE /api/completions/batch — must precede /:id to avoid param capture
router.delete('/batch', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  db.deleteCompletions(ids);
  res.json({ success: true, deleted: ids.length });
});

// DELETE /api/completions/:id
router.delete('/:id', (req, res) => {
  db.deleteCompletion(req.params.id);
  res.json({ success: true });
});

module.exports = router;
