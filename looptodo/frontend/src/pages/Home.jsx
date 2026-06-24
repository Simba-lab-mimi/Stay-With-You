import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { getTodayTasks, completeTask, deleteTask } from '../api.js';
import { localDateStr } from '../utils/date.js';
import TaskItem from '../components/TaskItem.jsx';
import Ballpit from '../components/Ballpit.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import PushButton from '../components/PushButton.jsx';
import './Home.css';

const BallpitBackground = memo(function BallpitBackground() {
  return (
    <div className="bp-layer" aria-hidden="true">
      <Ballpit count={160} gravity={0.48} followCursor={true} />
      <div className="bp-veil" />
    </div>
  );
});

export default function Home() {
  const [tasks,   setTasks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [modal,   setModal]   = useState({ open: false, id: null, title: '' });

  // Track the deferred reload timer so we can cancel it on unmount or before
  // re-scheduling — prevents stale callbacks from racing with fresh mounts.
  const reloadTimerRef = useRef(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getTodayTasks(localDateStr());
      setTasks(data);
    } catch {
      setError('Could not reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      // Cancel any pending reload when leaving the page so the stale callback
      // never fires setState on the previous component instance.
      clearTimeout(reloadTimerRef.current);
    };
  }, [load]);

  async function handleComplete(id) {
    try {
      await completeTask(id, localDateStr());
    } catch {
      // If the API call fails the task will reappear on the next reload.
    }
    // Cancel any previously scheduled reload before scheduling a fresh one.
    clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(load, 480);
  }

  function handleDelete(id) {
    const task = tasks.find(t => t.id === id);
    setModal({ open: true, id, title: task?.title ?? '' });
  }

  async function confirmDelete() {
    // Capture id before closing modal so the async call uses the right value.
    const taskId = modal.id;
    setModal(m => ({ ...m, open: false }));
    try {
      await deleteTask(taskId);
    } catch {
      // Delete failed silently; the task will still appear on reload.
    }
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
          <PushButton />
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
