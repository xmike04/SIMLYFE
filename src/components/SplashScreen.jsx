import React from 'react';

const PILL_STYLE = {
  background: 'rgba(124, 58, 237, 0.2)',
  border: '1px solid rgba(124, 58, 237, 0.4)',
  borderRadius: '20px',
  padding: '6px 12px',
  fontSize: '0.8rem',
  color: '#e2e8f0',
};

const LOGO_STYLE = {
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  fontSize: '3rem',
  fontWeight: 700,
  letterSpacing: '0.15em',
};

const CARD_STYLE = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-xl)',
  padding: '40px 32px',
  maxWidth: '400px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '24px',
};

export default function SplashScreen({ onEnter }) {
  return (
    <div
      className="animate-fade-in"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px',
      }}
    >
      <div style={CARD_STYLE}>
        <div style={LOGO_STYLE}>SIMLYFE</div>

        <p
          style={{
            color: 'var(--text-primary)',
            fontSize: '1.1rem',
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: 1.4,
          }}
        >
          Your choices. Real consequences. No paywalls.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <span style={PILL_STYLE}>🤖 AI-Powered Events</span>
          <span style={PILL_STYLE}>💰 8 Wealth Tiers</span>
          <span style={PILL_STYLE}>⚡ Real Consequences</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
          No app store. No platform inequality. Instant updates.
        </p>

        <button className="btn" style={{ width: '100%' }} onClick={onEnter}>
          Begin Your Life →
        </button>
      </div>
    </div>
  );
}
