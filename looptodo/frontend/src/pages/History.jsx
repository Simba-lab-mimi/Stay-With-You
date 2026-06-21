import React, { useCallback, useEffect, useState } from 'react';
import { getHistory, getStreaks, deleteCompletion, deleteCompletions } from '../api.js';
import ConfirmModal from '../components/ConfirmModal.jsx';
import './History.css';

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function groupByDate(completions) {
  const groups = {};
  completions.forEach(c => {
    const key = c.completedAt.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });
  return groups;
}

export default function History() {
  const [history, setHistory]     = useState([]);
  const [streaks, setStreaks]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected]   = useState(new Set());

  // modal state
  const [modal, setModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  const load = useCallback(async () => {
    const [hist, str] = await Promise.all([getHistory(), getStreaks()]);
    setHistory(hist);
    const idx = {};
    str.forEach(s => { idx[s.taskId] = s.streak; });
    setStreaks(idx);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelecting(false);
    setSelected(new Set());
  }

  function confirmDelete(title, message, action) {
    setModal({ open: true, title, message, onConfirm: action });
  }

  async function handleDeleteOne(id) {
    setModal(m => ({ ...m, open: false }));
    try {
      await deleteCompletion(id);
    } catch (e) {
      console.error('Delete failed:', e);
    }
    await load();
  }

  async function handleDeleteBatch() {
    setModal(m => ({ ...m, open: false }));
    try {
      await deleteCompletions([...selected]);
    } catch (e) {
      console.error('Batch delete failed:', e);
    }
    exitSelectMode();
    await load();
  }

  if (loading) return <div className="center">Loading…</div>;

  const grouped = groupByDate(history);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (sortedDates.length === 0) {
    return (
      <div className="page">
        <div className="empty">
          <span className="empty-emoji">📭</span>
          <h3>Nothing here yet</h3>
          <p>Complete a task today and it'll show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page hist-page">
      {/* ── Toolbar ── */}
      <div className="hist-toolbar">
        <h2 className="hist-heading">History</h2>
        <button
          className={`btn btn-sm ${selecting ? 'btn-ghost' : 'btn-ghost'}`}
          onClick={() => selecting ? exitSelectMode() : setSelecting(true)}
        >
          {selecting ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* ── Date groups ── */}
      {sortedDates.map(date => (
        <div key={date} className="hist-section">
          <p className="hist-date-label">{fmtDate(date + 'T12:00:00')}</p>
          <ul className="hist-list">
            {grouped[date].map(c => (
              <li
                key={c.id}
                className={`hist-item${selecting && selected.has(c.id) ? ' hist-item--selected' : ''}`}
                onClick={selecting ? () => toggleSelect(c.id) : undefined}
              >
                {selecting && (
                  <span className={`hist-check-box${selected.has(c.id) ? ' hist-check-box--on' : ''}`}>
                    {selected.has(c.id) && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                )}

                <span className="hist-dot" />
                <span className="hist-title">{c.title}</span>

                {streaks[c.taskId] > 1 && (
                  <span className="hist-streak">🔥 {streaks[c.taskId]}×</span>
                )}

                {!selecting && (
                  <button
                    className="hist-del-btn"
                    aria-label="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(
                        'Delete record?',
                        `Remove "${c.title}" from history. This won't affect the task itself.`,
                        () => handleDeleteOne(c.id)
                      );
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* ── Batch action bar ── */}
      {selecting && selected.size > 0 && (
        <div className="hist-action-bar">
          <span className="hist-action-count">{selected.size} selected</span>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => confirmDelete(
              `Delete ${selected.size} record${selected.size > 1 ? 's' : ''}?`,
              'These completions will be removed from history.',
              handleDeleteBatch
            )}
          >
            Delete
          </button>
        </div>
      )}

      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        confirmLabel="Delete"
        onConfirm={modal.onConfirm}
        onCancel={() => setModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
}
