const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    // Allow server-to-server / curl (no Origin header)
    if (!origin) return callback(null, true);
    // Allow any Vercel deployment (preview + production)
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    // Allow local dev
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LoopTodo backend → http://localhost:${PORT}`);
});
