import React, { useEffect, useState, useCallback, memo } from 'react';
import { getTodayTasks, completeTask, deleteTask } from '../api.js';
import TaskItem from '../components/TaskItem.jsx';
import Ballpit from '../components/Ballpit.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import './Home.css';

const BallpitBackground = memo(function BallpitBackground() {
  return (
    <div className="bp-layer" aria-hidden="true">
      <Ballpit count={160} gravity={0.48} followCursor={true} />
      <div className="bp-veil" />
    </div>
  );
});

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function Home() {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [modal,   setModal]   = useState({ open: false, id: null, title: '' });

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await getTodayTasks(todayStr());
      setTasks(data);
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleComplete(id) {
    completeTask(id, todayStr());
    setTimeout(load, 480);
  }

  function handleDelete(id) {
    const task = tasks.find(t => t.id === id);
    setModal({ open: true, id, title: task?.title ?? '' });
  }

  async function confirmDelete() {
    setModal(m => ({ ...m, open: false }));
    await deleteTask(modal.id);
    load();
  }

  const overdue = tasks.filter(t => t.isOverdue);
  const due     = tasks.filter(t => !t.isOverdue);
  const total   = tasks.length;

  const now      = new Date();
  const weekday  = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="home-page">
      <BallpitBackground />

      <div className="home-content">
        <header className="home-header">
          <p className="home-weekday">{weekday}</p>
          <h1 className="home-date">{monthDay}</h1>
          {!loading && total > 0 && (
            <span className="home-count-pill">
              {total} task{total !== 1 ? 's' : ''} left
            </span>
          )}
        </header>

        {loading && <p className="home-status">Loading…</p>}

        {error && !loading && (
          <div className="home-error">{error}</div>
        )}

        {!loading && !error && total === 0 && (
          <div className="home-empty">
            <span className="home-empty-icon">🎉</span>
            <h3>All done for today</h3>
            <p>Enjoy your day.</p>
          </div>
        )}

        {!loading && overdue.length > 0 && (
          <section className="home-section">
            <h2 className="home-section-label home-section-label--danger">Overdue</h2>
            <ul className="task-list">
              {overdue.map(t => (
                <TaskItem key={t.id} task={t} onComplete={handleComplete} onDelete={handleDelete} />
              ))}
            </ul>
          </section>
        )}

        {!loading && due.length > 0 && (
          <section className="home-section">
            {overdue.length > 0 && <h2 className="home-section-label">Today</h2>}
            <ul className="task-list">
              {due.map(t => (
                <TaskItem key={t.id} task={t} onComplete={handleComplete} onDelete={handleDelete} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <ConfirmModal
        open={modal.open}
        title="Remove task?"
        message={`"${modal.title}" and all its future recurrences will be deleted.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
}
