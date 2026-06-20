const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/completions?userId=
router.get('/', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const completions = db.getCompletions().filter(c => c.userId === userId);
  const tasks = db.getTasks().filter(t => t.userId === userId);
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

// GET /api/completions/streaks?userId=
router.get('/streaks', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const completions = db.getCompletions().filter(c => c.userId === userId);
  const tasks = db.getTasks().filter(t => t.userId === userId);
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
// body: { ids: string[], userId: string }
router.delete('/batch', (req, res) => {
  const { ids, userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }

  // Only delete completions that actually belong to this user
  const ownedIds = new Set(
    db.getCompletions()
      .filter(c => c.userId === userId)
      .map(c => c.id)
  );
  const safeIds = ids.filter(id => ownedIds.has(id));

  db.deleteCompletions(safeIds);
  res.json({ success: true, deleted: safeIds.length });
});

// DELETE /api/completions/:id?userId=
router.delete('/:id', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const completion = db.getCompletions().find(c => c.id === req.params.id);
  if (!completion || completion.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.deleteCompletion(req.params.id);
  res.json({ success: true });
});

module.exports = router;
