import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTask } from '../api.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddTask() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('daily');
  const [interval, setInterval] = useState(2);
  const [weekdays, setWeekdays] = useState([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleDay(i) {
    setWeekdays(prev =>
      prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i].sort((a, b) => a - b)
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Task name is required.');
    if (type === 'interval' && interval < 1) return setError('Interval must be at least 1 day.');
    if (type === 'weekly' && weekdays.length === 0) return setError('Pick at least one weekday.');

    setError('');
    setSaving(true);

    try {
      await createTask({
        title: title.trim(),
        recurrenceType: type,
        intervalDays: type === 'interval' ? Number(interval) : undefined,
        weekdays: type === 'weekly' ? weekdays : undefined,
        startDate,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <p className="page-title">New recurring task</p>

      <form className="task-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="title">Task name</label>
          <input
            id="title"
            className="form-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Morning walk"
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="type">Repeat</label>
          <select
            id="type"
            className="form-select"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="daily">Every day</option>
            <option value="interval">Every N days</option>
            <option value="weekly">Specific weekdays</option>
          </select>
        </div>

        {type === 'interval' && (
          <div className="form-group">
            <label className="form-label" htmlFor="interval">Interval (days)</label>
            <input
              id="interval"
              className="form-input"
              type="number"
              min="1"
              max="365"
              value={interval}
              onChange={e => setInterval(e.target.value)}
            />
          </div>
        )}

        {type === 'weekly' && (
          <div className="form-group">
            <span className="form-label">Days of week</span>
            <div className="weekday-picker">
              {DAYS.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  className={`weekday-btn${weekdays.includes(i) ? ' selected' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="start">Start date</label>
          <input
            id="start"
            className="form-input"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
          {saving ? 'Saving…' : 'Add Task'}
        </button>
      </form>
    </div>
  );
}
