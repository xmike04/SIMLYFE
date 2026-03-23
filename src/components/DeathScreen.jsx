import React from 'react';

export default function DeathScreen({ engine }) {
  const { character, age, bank, history } = engine;

  return (
    <div className="flex-center animate-fade-in" style={{ height: '100%', padding: '20px' }}>
      <div className="glass-panel text-center" style={{ width: '100%', border: '1px solid var(--health-color)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--health-color)' }} />
        <h2 className="mb-4 mt-2" style={{ color: 'var(--health-color)', fontSize: '2rem' }}>R.I.P.</h2>
        <h3 className="mb-2" style={{ fontSize: '1.5rem' }}>{character.name}</h3>
        <p className="mb-1" style={{ fontSize: '1.1rem' }}>You died at age <b>{age}</b>.</p>
        <p className="mb-4" style={{ fontSize: '1rem', color: '#10b981' }}>Net Worth: ${bank.toLocaleString()}</p>
        
        <div className="mb-6" style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Final Event
          </p>
          <p style={{ fontSize: '0.95rem' }}>
            {history[history.length - 1]?.text || "Passed away peacefully."}
          </p>
        </div>
        
        <button className="btn" onClick={() => window.location.reload()}>
          Start New Life
        </button>
      </div>
    </div>
  );
}
