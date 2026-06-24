import React, { useEffect, useState } from 'react';
import { getPushState, subscribeToPush, unsubscribeFromPush, sendTestNotification, isPushSupported } from '../push.js';
import './PushButton.css';

const LABELS = {
  on:          'Reminders On',
  off:         'Enable Reminders',
  denied:      'Notifications Blocked',
  unsupported: 'Push Not Supported',
  loading:     '…',
};

export default function PushButton() {
  const [state,   setState]   = useState('loading');
  const [busy,    setBusy]    = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  async function handleToggle() {
    if (busy || state === 'denied' || state === 'unsupported') return;
    setBusy(true);
    setMessage('');
    try {
      if (state === 'on') {
        await unsubscribeFromPush();
        setState('off');
        setMessage('Reminders turned off.');
      } else {
        await subscribeToPush();
        setState('on');
        setMessage('Reminders enabled! You\'ll get a daily nudge at 8 AM.');
      }
    } catch (err) {
      if (err.message === 'denied') {
        setState('denied');
        setMessage('Permission denied. Enable notifications in browser settings.');
      } else if (err.message === 'unsupported') {
        setState('unsupported');
      } else {
        setMessage(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setMessage('');
    try {
      await sendTestNotification();
      setMessage('Test notification sent!');
    } catch (err) {
      setMessage(err.message || 'Test failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!isPushSupported()) return null;

  return (
    <div className="push-widget">
      <button
        className={`push-btn push-btn--${state}`}
        onClick={handleToggle}
        disabled={busy || state === 'denied' || state === 'unsupported' || state === 'loading'}
        aria-label={LABELS[state]}
      >
        <span className="push-btn__icon" aria-hidden="true">
          {state === 'on' ? '🔔' : state === 'denied' ? '🔕' : '🔔'}
        </span>
        <span className="push-btn__label">
          {busy ? '…' : LABELS[state] ?? LABELS.off}
        </span>
      </button>

      {state === 'on' && (
        <button
          className="push-test-btn"
          onClick={handleTest}
          disabled={busy}
          aria-label="Send a test notification"
        >
          Test
        </button>
      )}

      {message && <p className="push-message">{message}</p>}
    </div>
  );
}
