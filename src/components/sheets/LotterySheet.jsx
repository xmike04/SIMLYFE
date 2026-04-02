import React from 'react';
import ActionSheet from '../ActionSheet';

export default function LotterySheet({ bank, playLottery, onClose }) {
  return (
    <ActionSheet title="Lottery" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
          Jackpot: <strong style={{ color: '#10b981' }}>$10,000,000</strong> • Odds: 1 in 100,000
        </div>
        {[1, 5, 10, 50].map(n => (
          <button key={n} className="glass-panel" disabled={bank < n * 5}
            onClick={() => { playLottery(n); onClose(); }}
            style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.1)', opacity: bank < n * 5 ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Buy {n} Ticket{n > 1 ? 's' : ''}</strong>
              <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>-${(n * 5).toLocaleString()}</span>
            </div>
          </button>
        ))}
      </div>
    </ActionSheet>
  );
}
