const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { computeNextDueDate } = require('../scheduler');

// GET /api/tasks/today?date=YYYY-MM-DD&userId=
router.get('/today', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const date = req.query.date || new Date().toISOString().split('T')[0];
  const tasks = db.getTasks().filter(
    t => t.userId === userId &&
         t.isActive &&
         !t.deletedAt &&
         !t.isPaused &&
         t.nextDueDate <= date
  );
  res.json(tasks.map(t => ({ ...t, isOverdue: t.nextDueDate < date })));
});

// GET /api/tasks?userId=&status=active|deleted|all
router.get('/', (req, res) => {
  const { userId, status = 'active' } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  let tasks = db.getTasks().filter(t => t.userId === userId);
  if (status === 'active')  tasks = tasks.filter(t => !t.deletedAt);
  if (status === 'deleted') tasks = tasks.filter(t => !!t.deletedAt);
  res.json(tasks);
});

// POST /api/tasks — body must include userId
router.post('/', (req, res) => {
  const { title, recurrenceType, intervalDays, weekdays, startDate, userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId required' });
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
    userId,
    title: title.trim(),
    recurrenceType,
    intervalDays: recurrenceType === 'interval' ? Number(intervalDays) : null,
    weekdays: recurrenceType === 'weekly' ? weekdays : null,
    createdAt: new Date().toISOString(),
    nextDueDate: startDate || new Date().toISOString().split('T')[0],
    lastCompletedDate: null,
    isActive: true,
    isPaused: false,
    deletedAt: null,
  };

  db.insertTask(task);
  res.status(201).json(task);
});

// POST /api/tasks/:id/complete — body must include userId
router.post('/:id/complete', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (task.deletedAt) return res.status(400).json({ error: 'Cannot complete a deleted task' });

  const completedDate = req.body.completedAt || new Date().toISOString().split('T')[0];

  db.insertCompletion({
    id: uuidv4(),
    userId,
    taskId: task.id,
    completedAt: new Date(completedDate + 'T12:00:00Z').toISOString(),
  });

  const nextDueDate = computeNextDueDate(task, completedDate);
  const updated = db.updateTask(task.id, { nextDueDate, lastCompletedDate: completedDate });
  res.json(updated);
});

// POST /api/tasks/:id/restore?userId= — move from trash back to active
router.post('/:id/restore', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const task = db.getTask(req.params.id);
  if (!task || task.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (!task.deletedAt) return res.status(400).json({ error: 'Task is not in trash' });

  const restored = db.updateTask(task.id, { isActive: true, deletedAt: null });
  res.json(restored);
});

// POST /api/tasks/:id/pause?userId= — toggle pause state
router.post('/:id/pause', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const task = db.getTask(req.params.id);
  if (!task || task.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
  if (task.deletedAt) return res.status(400).json({ error: 'Cannot pause a deleted task' });

  const updated = db.updateTask(task.id, { isPaused: !task.isPaused });
  res.json(updated);
});

// DELETE /api/tasks/:id?userId= — soft delete (moves to trash)
router.delete('/:id', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const task = db.getTask(req.params.id);
  if (!task || task.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

  db.updateTask(req.params.id, {
    isActive: false,
    deletedAt: new Date().toISOString(),
  });
  res.json({ success: true });
});

module.exports = router;
