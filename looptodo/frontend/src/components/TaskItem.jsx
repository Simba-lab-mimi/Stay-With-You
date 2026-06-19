import React, { useState } from 'react';
import './TaskItem.css';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function recurrenceLabel(task) {
  if (task.recurrenceType === 'daily') return 'Every day';
  if (task.recurrenceType === 'interval')
    return `Every ${task.intervalDays} day${task.intervalDays !== 1 ? 's' : ''}`;
  if (task.recurrenceType === 'weekly' && task.weekdays?.length)
    return task.weekdays.map(d => DAY[d]).join(' · ');
  return '';
}

export default function TaskItem({ task, onComplete, onDelete }) {
  const [ticked,    setTicked]    = useState(false);
  const [exiting,   setExiting]   = useState(false);

  function handleCheck() {
    if (ticked || exiting) return;

    // 1. Show green check immediately (feels instant)
    setTicked(true);

    // 2. Start exit animation after the checkbox settles
    setTimeout(() => setExiting(true), 220);

    // 3. Tell parent to fire API + schedule reload (parent waits 480ms)
    onComplete(task.id);
  }

  return (
    <li className={`task-item${task.isOverdue ? ' overdue' : ''}${exiting ? ' exiting' : ''}`}>
      {/* Checkbox */}
      <button
        className={`check-btn${ticked ? ' ticked' : ''}`}
        onClick={handleCheck}
        disabled={ticked}
        aria-label="Mark complete"
      >
        {ticked && (
          <svg viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="task-body">
        <span className={`task-title${ticked ? ' struck' : ''}`}>{task.title}</span>
        <span className="task-meta">{recurrenceLabel(task)}</span>
        {task.isOverdue && (
          <span className="overdue-tag">⚠ Since {task.nextDueDate}</span>
        )}
      </div>

      {/* Delete */}
      <button
        className="delete-btn"
        onClick={() => onDelete(task.id)}
        aria-label="Remove task"
      >
        ×
      </button>
    </li>
  );
}
