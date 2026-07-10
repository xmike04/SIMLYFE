import React from 'react';
import heroImage from '../assets/hero.png';

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

const HERO_STYLE = {
  width: '128px',
  height: '128px',
  objectFit: 'contain',
  filter: 'drop-shadow(0 18px 32px rgba(124, 58, 237, 0.32))',
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

        <img src={heroImage} alt="" style={HERO_STYLE} />

        <p
          style={{
            color: 'var(--text-primary)',
            fontSize: '1.1rem',
            textAlign: 'center',
            maxWidth: '280px',
            lineHeight: 1.4,
          }}
        >
          Build a life, take the hit, and watch every stat push back.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          <span style={PILL_STYLE}>🤖 AI Events</span>
          <span style={PILL_STYLE}>💰 Wealth Systems</span>
          <span style={PILL_STYLE}>⚡ Harsh Outcomes</span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
          A mobile-first life sim with careers, relationships, assets, pets, cities, and LLM-driven chaos.
        </p>

        <button className="btn" style={{ width: '100%' }} onClick={onEnter}>
          Begin Your Life
        </button>
      </div>
    </div>
  );
}
