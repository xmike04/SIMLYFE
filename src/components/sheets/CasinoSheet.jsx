import React from 'react';
import ActionSheet from '../ActionSheet';

export default function CasinoSheet({ bank, goGamble, onClose }) {
  return (
    <ActionSheet title="Casino" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
          45% win 2× • 25% get half back • 30% lose all
        </div>
        {[100, 500, 1000, 5000, 10000].map(amt => (
          <button key={amt} className="glass-panel" disabled={bank < amt}
            onClick={() => { goGamble(amt); onClose(); }}
            style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.1)', opacity: bank < amt ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Bet ${amt.toLocaleString()}</strong>
              <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Win: ${(amt * 2).toLocaleString()}</span>
            </div>
            {bank < amt && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>Insufficient funds</div>}
          </button>
        ))}
      </div>
    </ActionSheet>
  );
}
