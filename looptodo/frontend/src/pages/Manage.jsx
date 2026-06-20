import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getActiveTasks, getDeletedTasks, deleteTask, restoreTask, pauseTask } from '../api.js';
import './Manage.css';

const RECURRENCE_LABEL = {
  daily:    'Every day',
  interval: (days) => `Every ${days} day${days !== 1 ? 's' : ''}`,
  weekly:   (days) => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (days || []).map(d => names[d]).join(', ');
  },
};

function recurrenceText(task) {
  if (task.recurrenceType === 'daily')    return RECURRENCE_LABEL.daily;
  if (task.recurrenceType === 'interval') return RECURRENCE_LABEL.interval(task.intervalDays);
  if (task.recurrenceType === 'weekly')   return RECURRENCE_LABEL.weekly(task.weekdays);
  return '';
}

function useCountdown(deletedAt) {
  const ONE_HOUR = 60 * 60 * 1000;
  const calc = () => {
    const ms = ONE_HOUR - (Date.now() - new Date(deletedAt).getTime());
    return Math.max(0, ms);
  };

  const [ms, setMs] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setMs(calc()), 30_000);
    return () => clearInterval(id);
  }, [deletedAt]);

  if (ms <= 0) return 'Expiring…';
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin >= 60) return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m left`;
  return `${totalMin}m left`;
}

function TrashCountdown({ deletedAt }) {
  const label = useCountdown(deletedAt);
  const ONE_HOUR = 60 * 60 * 1000;
  const ms = Math.max(0, ONE_HOUR - (Date.now() - new Date(deletedAt).getTime()));
  const urgent = ms < 10 * 60 * 1000;
  return (
    <span className={`trash-countdown${urgent ? ' trash-countdown--urgent' : ''}`}>
      {label}
    </span>
  );
}

function ActiveTaskCard({ task, onPause, onDelete, busy }) {
  return (
    <li className="manage-card">
      <div className="manage-card__body">
        <span className="manage-card__title">{task.title}</span>
        <span className="manage-card__sub">{recurrenceText(task)}</span>
      </div>
      <div className="manage-card__badges">
        {task.isPaused && <span className="badge badge--paused">Paused</span>}
      </div>
      <div className="manage-card__actions">
        <button
          className={`btn btn-sm ${task.isPaused ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onPause(task.id)}
          disabled={busy === task.id}
          aria-label={task.isPaused ? 'Resume task' : 'Pause task'}
        >
          {task.isPaused ? 'Resume' : 'Pause'}
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => onDelete(task.id)}
          disabled={busy === task.id}
          aria-label="Delete task"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function TrashTaskCard({ task, onRestore, busy }) {
  return (
    <li className="manage-card manage-card--trash">
      <div className="manage-card__body">
        <span className="manage-card__title manage-card__title--deleted">{task.title}</span>
        <span className="manage-card__sub">{recurrenceText(task)}</span>
      </div>
      <div className="manage-card__countdown">
        <TrashCountdown deletedAt={task.deletedAt} />
      </div>
      <div className="manage-card__actions">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onRestore(task.id)}
          disabled={busy === task.id}
          aria-label="Restore task"
        >
          Restore
        </button>
      </div>
    </li>
  );
}

export default function Manage() {
  const [active,  setActive]  = useState([]);
  const [deleted, setDeleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, d] = await Promise.all([getActiveTasks(), getDeletedTasks()]);
      if (!mountedRef.current) return;
      setActive(a);
      setDeleted(d);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePause = useCallback(async (id) => {
    setBusy(id);
    try {
      const updated = await pauseTask(id);
      if (!mountedRef.current) return;
      setActive(prev => prev.map(t => t.id === id ? { ...t, isPaused: updated.isPaused } : t));
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    setBusy(id);
    try {
      await deleteTask(id);
      if (!mountedRef.current) return;
      const task = active.find(t => t.id === id);
      if (task) {
        setActive(prev => prev.filter(t => t.id !== id));
        setDeleted(prev => [{ ...task, deletedAt: new Date().toISOString(), isActive: false }, ...prev]);
      }
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }, [active]);

  const handleRestore = useCallback(async (id) => {
    setBusy(id);
    try {
      const restored = await restoreTask(id);
      if (!mountedRef.current) return;
      setDeleted(prev => prev.filter(t => t.id !== id));
      setActive(prev => [...prev, { ...restored }]);
    } catch (e) {
      if (mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }, []);

  if (loading) {
    return <div className="page center">Loading…</div>;
  }

  return (
    <div className="page manage-page">
      {error && (
        <div className="manage-error" role="alert">
          {error}
          <button className="manage-error__retry" onClick={load}>Retry</button>
        </div>
      )}

      {/* ── Active Tasks ───────────────────────── */}
      <section className="manage-section">
        <h2 className="manage-section__title">
          Active Tasks
          <span className="manage-section__count">{active.length}</span>
        </h2>

        {active.length === 0 ? (
          <div className="manage-empty">
            <span className="manage-empty__emoji">✅</span>
            <p>No active tasks</p>
          </div>
        ) : (
          <ul className="manage-list">
            {active.map(task => (
              <ActiveTaskCard
                key={task.id}
                task={task}
                onPause={handlePause}
                onDelete={handleDelete}
                busy={busy}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── Recently Deleted ───────────────────── */}
      <section className="manage-section">
        <h2 className="manage-section__title manage-section__title--trash">
          Recently Deleted
          <span className="manage-section__count">{deleted.length}</span>
        </h2>
        <p className="manage-section__hint">Deleted tasks are auto-removed after 1 hour.</p>

        {deleted.length === 0 ? (
          <div className="manage-empty">
            <span className="manage-empty__emoji">🗑️</span>
            <p>Trash is empty</p>
          </div>
        ) : (
          <ul className="manage-list">
            {deleted.map(task => (
              <TrashTaskCard
                key={task.id}
                task={task}
                onRestore={handleRestore}
                busy={busy}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
