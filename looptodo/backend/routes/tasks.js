const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { computeNextDueDate } = require('../scheduler');

// GET /api/tasks/today?date=YYYY-MM-DD
router.get('/today', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const tasks = db.getTasks().filter(t => t.isActive && t.nextDueDate <= date);
  const result = tasks.map(t => ({ ...t, isOverdue: t.nextDueDate < date }));
  res.json(result);
});

// GET /api/tasks
router.get('/', (req, res) => {
  res.json(db.getTasks());
});

// POST /api/tasks
router.post('/', (req, res) => {
  const { title, recurrenceType, intervalDays, weekdays, startDate } = req.body;

  if (!title || !recurrenceType) {
    return res.status(400).json({ error: 'title and recurrenceType are required' });
  }
  if (recurrenceType === 'weekly' && (!weekdays || weekdays.length === 0)) {
    return res.status(400).json({ error: 'weekdays required for weekly tasks' });
  }
  if (recurrenceType === 'interval' && (!intervalDays || intervalDays < 1)) {
    return res.status(400).json({ error: 'intervalDays must be >= 1' });
  }

  const task = {
    id: uuidv4(),
    title: title.trim(),
    recurrenceType,
    intervalDays: recurrenceType === 'interval' ? Number(intervalDays) : null,
    weekdays: recurrenceType === 'weekly' ? weekdays : null,
    createdAt: new Date().toISOString(),
    nextDueDate: startDate || new Date().toISOString().split('T')[0],
    lastCompletedDate: null,
    isActive: true,
  };

  db.insertTask(task);
  res.status(201).json(task);
});

// POST /api/tasks/:id/complete
router.post('/:id/complete', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const completedDate = req.body.completedAt || new Date().toISOString().split('T')[0];

  db.insertCompletion({
    id: uuidv4(),
    taskId: task.id,
    completedAt: new Date(completedDate + 'T12:00:00').toISOString(),
  });

  const nextDueDate = computeNextDueDate(task, completedDate);
  const updated = db.updateTask(task.id, { nextDueDate, lastCompletedDate: completedDate });
  res.json(updated);
});

// DELETE /api/tasks/:id  (soft delete)
router.delete('/:id', (req, res) => {
  db.updateTask(req.params.id, { isActive: false });
  res.json({ success: true });
});

module.exports = router;
