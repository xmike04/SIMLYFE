import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';

const SIGN_IN_MESSAGES = {
  linked: 'Signed in! Your current life is now backed up to your account.',
  switched: 'Welcome back! Loaded the save from your account.',
  signed_in: 'Signed in.',
  already: 'You are already signed in.',
};

const AUTH_ERRORS = {
  unavailable: 'Cloud saves are not configured in this build.',
  invalid_email: 'Enter a valid email address.',
  weak_password: 'Password must be at least 6 characters.',
  email_in_use: 'That email already has an account — use Sign in instead.',
  invalid_credentials: 'Wrong email or password.',
  rate_limited: 'Too many attempts. Please try again later.',
  error: 'Sign-in failed. Please try again.',
};

const PROVIDER_LABELS = {
  'google.com': 'Google',
  password: 'Email',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-card)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'white',
  padding: '10px',
  borderRadius: '6px',
  fontSize: '0.9rem',
};

export default function AccountSheet({ authAccount, signInWithGoogle, signInWithEmail, resetPassword, signOutAccount, onClose }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSignedIn = authAccount ? !authAccount.isAnonymous : false;
  const providerLabel = PROVIDER_LABELS[authAccount?.provider] ?? null;

  const runAuthAction = async (action) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result?.ok) {
      setNotice(result.message ?? SIGN_IN_MESSAGES[result.mode] ?? 'Done.');
    } else if (result?.reason !== 'cancelled') {
      // A closed popup is a quiet non-event, not an error.
      setError(AUTH_ERRORS[result?.reason] ?? AUTH_ERRORS.error);
    }
  };

  const handleGoogle = () => runAuthAction(signInWithGoogle);
  const handleEmailSignUp = () => runAuthAction(() => signInWithEmail(email, password, 'signup'));
  const handleEmailSignIn = () => runAuthAction(() => signInWithEmail(email, password, 'signin'));
  const handleReset = () => runAuthAction(async () => {
    const result = await resetPassword(email);
    return result?.ok
      ? { ...result, message: 'Password reset email sent (if that account exists).' }
      : result;
  });

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)' }}>
          {isSignedIn && authAccount?.photo ? (
            <img src={authAccount.photo} alt="" referrerPolicy="no-referrer" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{isSignedIn ? '🔗' : '👤'}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isSignedIn ? (authAccount?.name ?? authAccount?.email ?? 'Signed in') : 'Guest'}
              {isSignedIn && providerLabel && (
                <span style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa', verticalAlign: 'middle' }}>{providerLabel}</span>
              )}
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isSignedIn
                ? (authAccount?.email ?? 'Cloud save linked to your account')
                : 'Save lives in this browser only'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          {isSignedIn
            ? 'Your life is backed up to your account — sign in on any device to continue it. Signing out starts a fresh guest session on this device (your cloud save stays safe).'
            : 'Sign in to keep your save if this browser is cleared and to continue your life on other devices. Your current life carries over.'}
        </p>

        {notice && <p style={{ margin: 0, fontSize: '0.85rem', color: '#34d399', textAlign: 'center' }}>{notice}</p>}
        {error && <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', textAlign: 'center' }}>{error}</p>}

        {!isSignedIn ? (
          <>
            <button
              className="glass-panel"
              disabled={busy}
              onClick={handleGoogle}
              style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59,130,246,0.2)', opacity: busy ? 0.6 : 1 }}
            >
              <strong>{busy ? 'Working…' : 'Continue with Google'}</strong>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
              or use email
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.12)' }} />
            </div>

            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => { setError(null); setEmail(e.target.value); }}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password (6+ characters)"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setError(null); setPassword(e.target.value); }}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="glass-panel"
                disabled={busy}
                onClick={handleEmailSignUp}
                style={{ flex: 1, padding: '0.9rem', textAlign: 'center', background: 'rgba(16,185,129,0.2)', opacity: busy ? 0.6 : 1 }}
              >
                <strong>Create account</strong>
              </button>
              <button
                className="glass-panel"
                disabled={busy}
                onClick={handleEmailSignIn}
                style={{ flex: 1, padding: '0.9rem', textAlign: 'center', background: 'rgba(255,255,255,0.08)', opacity: busy ? 0.6 : 1 }}
              >
                <strong>Sign in</strong>
              </button>
            </div>
            <button
              disabled={busy}
              onClick={handleReset}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: busy ? 'not-allowed' : 'pointer', textDecoration: 'underline', padding: '2px' }}
            >
              Forgot password?
            </button>
          </>
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
