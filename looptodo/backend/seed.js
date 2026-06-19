const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const today = new Date().toISOString().split('T')[0];

function nextWeekday(weekdays) {
  const d = new Date(today + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(d.getDay())) return d.toISOString().split('T')[0];
    d.setDate(d.getDate() + 1);
  }
  return today;
}

const samples = [
  {
    title: 'Morning Skincare Routine',
    recurrenceType: 'daily',
    intervalDays: null,
    weekdays: null,
    nextDueDate: today,
  },
  {
    title: 'Water the plants',
    recurrenceType: 'interval',
    intervalDays: 3,
    weekdays: null,
    nextDueDate: today,
  },
  {
    title: 'Yoga session',
    recurrenceType: 'weekly',
    intervalDays: null,
    weekdays: [1, 3, 5], // Mon, Wed, Fri
    nextDueDate: nextWeekday([1, 3, 5]),
  },
];

const existing = db.getTasks().map(t => t.title);

samples.forEach(t => {
  if (existing.includes(t.title)) {
    console.log(`  skip (exists): ${t.title}`);
    return;
  }
  db.insertTask({
    id: uuidv4(),
    ...t,
    createdAt: new Date().toISOString(),
    lastCompletedDate: null,
    isActive: true,
  });
  console.log(`  ✅ ${t.title}  (${t.recurrenceType}, due ${t.nextDueDate})`);
});

console.log('\nDone. Run `npm start` to start the backend.');
