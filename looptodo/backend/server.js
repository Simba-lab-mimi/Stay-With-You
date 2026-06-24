const express = require('express');
const cors = require('cors');
const { init, purgeExpiredTasks } = require('./db');
const { startPushScheduler } = require('./pushScheduler');

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
app.use('/api/push', require('./routes/push'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Load all data from Supabase into memory, then start accepting requests.
init()
  .then(() => {
    purgeExpiredTasks();
    setInterval(purgeExpiredTasks, 5 * 60 * 1000);
    startPushScheduler();

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`LoopTodo backend → http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err.message);
    process.exit(1);
  });
