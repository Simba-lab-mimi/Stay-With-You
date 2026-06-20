const express = require('express');
const cors = require('cors');
const { purgeExpiredTasks } = require('./db');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost:/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/completions', require('./routes/completions'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Purge tasks deleted more than 1 hour ago — runs every 5 minutes
purgeExpiredTasks();
setInterval(purgeExpiredTasks, 5 * 60 * 1000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LoopTodo backend → http://localhost:${PORT}`);
});
