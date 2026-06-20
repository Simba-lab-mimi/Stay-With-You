import React, { useState, useRef, useEffect } from 'react';
import { useIdentity } from '../IdentityContext.jsx';
import './UserBadge.css';

export default function UserBadge() {
  const { displayName, userId } = useIdentity();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard not available
    }
  }

  if (!displayName) return null;

  return (
    <div className="ub-wrap" ref={panelRef}>
      <button
        className="ub-pill"
        onClick={() => setOpen(v => !v)}
        aria-label={`Identity: ${displayName}`}
        aria-expanded={open}
      >
        <span className="ub-avatar" aria-hidden="true">
          {displayName[0].toUpperCase()}
        </span>
        <span className="ub-name">{displayName}</span>
      </button>

      {open && (
        <div className="ub-panel" role="tooltip">
          <p className="ub-panel__label">Your identity</p>
          <p className="ub-panel__name">{displayName}</p>
          <button className="ub-panel__id" onClick={copyId} title="Click to copy">
            <span className="ub-panel__uuid">{userId.slice(0, 8)}…</span>
            <span className="ub-panel__copy">{copied ? '✓ Copied' : 'Copy ID'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
