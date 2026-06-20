import React, { useState, useEffect, useRef } from 'react';
import './WelcomeModal.css';

export default function WelcomeModal({ open, onCommit }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 320);
  }, [open]);

  if (!open) return null;

  function handleContinue() {
    onCommit(name.trim());
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleContinue();
  }

  return (
    <div className="wm-overlay" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="wm-card">
        <div className="wm-icon" aria-hidden="true">🦁</div>

        <h1 className="wm-title">Welcome to<br />Stay With You</h1>
        <p className="wm-sub">Your private habit space — no account needed.</p>

        <div className="wm-field">
          <input
            ref={inputRef}
            className="wm-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Your name (optional)"
            maxLength={32}
            autoComplete="off"
            spellCheck="false"
          />
        </div>

        <button
          className="btn btn-primary btn-full wm-btn"
          onClick={handleContinue}
        >
          {name.trim() ? `Continue as ${name.trim()}` : 'Continue as Guest'}
        </button>

        <p className="wm-privacy">
          Your data stays on this device. Nothing is shared.
        </p>
      </div>
    </div>
  );
}
