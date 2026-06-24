import React, { useEffect, useState } from 'react';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestNotification,
  isPushSupported,
} from '../push.js';
import './PushButton.css';

const STATIC_LABELS = {
  on:          'Reminders On',
  off:         'Enable Reminders',
  denied:      'Notifications Blocked',
  unsupported: 'Push Not Supported',
  loading:     'Checking…',
};

export default function PushButton() {
  const [state,    setState]    = useState('loading');
  const [busy,     setBusy]     = useState(false);
  const [progress, setProgress] = useState('');  // live step text during operation
  const [feedback, setFeedback] = useState('');  // final success/error text after operation

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  async function handleToggle() {
    if (busy || state === 'denied' || state === 'unsupported' || state === 'loading') return;
    setBusy(true);
    setProgress('');
    setFeedback('');

    try {
      if (state === 'on') {
        setProgress('Turning off…');
        await unsubscribeFromPush();
        setState('off');
        setFeedback('Reminders turned off.');
      } else {
        await subscribeToPush((msg) => setProgress(msg));
        setState('on');
        setFeedback('Reminders enabled. Daily nudge from 8 AM.');
      }
    } catch (err) {
      if (err.message === 'denied') {
        setState('denied');
        setFeedback('Permission denied. Enable notifications in browser settings.');
      } else if (err.message === 'unsupported') {
        setState('unsupported');
      } else {
        setFeedback(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  async function handleTest() {
    if (busy) return;
    setBusy(true);
    setProgress('');
    setFeedback('');

    try {
      await sendTestNotification((msg) => setProgress(msg));
      setFeedback('Test sent successfully!');
    } catch (err) {
      setFeedback(`Test failed: ${err.message || 'unknown error'}`);
    } finally {
      setProgress('');
      setBusy(false);
    }
  }

  if (!isPushSupported()) return null;

  // Button label: show live progress while busy, otherwise the static state label
  const btnLabel = busy && progress
    ? progress
    : (STATIC_LABELS[state] ?? STATIC_LABELS.off);

  return (
    <div className="push-widget">
      <button
        className={`push-btn push-btn--${state}${busy ? ' push-btn--busy' : ''}`}
        onClick={handleToggle}
        disabled={busy || state === 'denied' || state === 'unsupported' || state === 'loading'}
        aria-label={btnLabel}
      >
        <span className="push-btn__icon" aria-hidden="true">
          {state === 'denied' ? '🔕' : '🔔'}
        </span>
        <span className="push-btn__label">{btnLabel}</span>
      </button>

      {state === 'on' && (
        <button
          className="push-test-btn"
          onClick={handleTest}
          disabled={busy}
          aria-label="Send a test push notification"
        >
          {busy ? '…' : 'Test'}
        </button>
      )}

      {/* Show live progress below buttons during an operation */}
      {busy && progress && (
        <p className="push-message push-message--progress">{progress}</p>
      )}

      {/* Show final feedback after operation completes */}
      {!busy && feedback && (
        <p className="push-message">{feedback}</p>
      )}
    </div>
  );
}
