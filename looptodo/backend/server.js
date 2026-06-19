const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/completions', require('./routes/completions'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LoopTodo backend → http://localhost:${PORT}`);
});
