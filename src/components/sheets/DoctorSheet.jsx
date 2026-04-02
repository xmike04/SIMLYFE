import React from 'react';
import ActionSheet from '../ActionSheet';

export default function DoctorSheet({ bank, visitDoctor, onClose }) {
  return (
    <ActionSheet title="Doctor" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[
          { key: 'checkup',    label: 'General Checkup',  cost: 100,  desc: '+15 Health, +3 Happiness',  color: 'rgba(59,130,246,0.1)' },
          { key: 'therapy',    label: 'Therapy Session',  cost: 200,  desc: '+5 Health, +20 Happiness',  color: 'rgba(139,92,246,0.1)' },
          { key: 'specialist', label: 'Specialist Visit', cost: 500,  desc: '+25 Health, +5 Happiness',  color: 'rgba(16,185,129,0.1)' },
          { key: 'surgery',    label: 'Minor Surgery',    cost: 5000, desc: '+40 Health, -5 Happiness',  color: 'rgba(239,68,68,0.1)' },
        ].map(v => (
          <button key={v.key} className="glass-panel" disabled={bank < v.cost}
            onClick={() => { visitDoctor(v.key); onClose(); }}
            style={{ padding: '1rem', textAlign: 'left', background: v.color, opacity: bank < v.cost ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{v.label}</strong>
              <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>-${v.cost.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{v.desc}</div>
            {bank < v.cost && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>Need ${v.cost.toLocaleString()}</div>}
          </button>
        ))}
      </div>
    </ActionSheet>
  );
}
