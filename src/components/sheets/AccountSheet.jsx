import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';

const SIGN_IN_MESSAGES = {
  linked: 'Signed in! Your current life is now backed up to your Google account.',
  switched: 'Welcome back! Loaded the save from your Google account.',
  signed_in: 'Signed in with Google.',
  already: 'You are already signed in.',
};

const SIGN_IN_ERRORS = {
  unavailable: 'Cloud saves are not configured in this build.',
  cancelled: null, // user closed the popup — not an error worth shouting about
  error: 'Google sign-in failed. Please try again.',
};

export default function AccountSheet({ authAccount, signInWithGoogle, signOutAccount, onClose }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const isGoogle = authAccount ? !authAccount.isAnonymous : false;

  const handleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result?.ok) {
      setNotice(SIGN_IN_MESSAGES[result.mode] ?? 'Signed in.');
    } else {
      setError(SIGN_IN_ERRORS[result?.reason] ?? SIGN_IN_ERRORS.error);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await signOutAccount();
    setBusy(false);
    if (result?.ok) {
      onClose();
    } else {
      setError('Sign-out failed. Please try again.');
    }
  };

  return (
    <ActionSheet title="Account" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)' }}>
          {isGoogle && authAccount?.photo ? (
            <img src={authAccount.photo} alt="" referrerPolicy="no-referrer" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{isGoogle ? '🔗' : '👤'}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isGoogle ? (authAccount?.name ?? 'Google account') : 'Guest'}
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isGoogle
                ? (authAccount?.email ?? 'Cloud save linked to Google')
                : 'Save lives in this browser only'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          {isGoogle
            ? 'Your life is backed up to your Google account — sign in on any device to continue it. Signing out starts a fresh guest session on this device (your cloud save stays safe).'
            : 'Sign in with Google to keep your save if this browser is cleared and to continue your life on other devices. Your current life carries over.'}
        </p>

        {notice && <p style={{ margin: 0, fontSize: '0.85rem', color: '#34d399', textAlign: 'center' }}>{notice}</p>}
        {error && <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', textAlign: 'center' }}>{error}</p>}

        {!isGoogle ? (
          <button
            className="glass-panel"
            disabled={busy}
            onClick={handleSignIn}
            style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59,130,246,0.2)', opacity: busy ? 0.6 : 1 }}
          >
            <strong>{busy ? 'Opening Google…' : 'Continue with Google'}</strong>
          </button>
        ) : (
          <button
            className="glass-panel"
            disabled={busy}
            onClick={handleSignOut}
            style={{ padding: '1rem', textAlign: 'center', background: 'rgba(239,68,68,0.15)', opacity: busy ? 0.6 : 1 }}
          >
            <strong>{busy ? 'Signing out…' : 'Sign out'}</strong>
          </button>
        )}
      </div>
    </ActionSheet>
  );
}
