import React, { useEffect, useRef } from 'react';
import './ConfirmModal.css';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="cm-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}>
      <div className="cm-card">
        <div className="cm-body">
          {title && <p className="cm-title">{title}</p>}
          {message && <p className="cm-message">{message}</p>}
        </div>
        <div className="cm-footer">
          <button className="btn btn-ghost btn-full" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-full" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
