import React from 'react';
import ActionSheet from '../ActionSheet';

export default function DebugSheet({ engine, closeSheet }) {
  const { debugModifyBank, debugAddAge, debugMaxStats, debugGrantDegree, debugSetEconomy, debugAddNetworking } = engine;
  return (
    <ActionSheet title="Dev Tools" onClose={closeSheet}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className="glass-panel" onClick={() => { debugModifyBank(1000000); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.2)' }}>
          <strong>Add +$1,000,000 Cash</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugAddAge(10); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
          <strong>Fast Forward +10 Years</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugMaxStats(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.2)' }}>
          <strong>Max All Stats (100%)</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugGrantDegree('bachelor'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
          <strong>Grant Bachelor's Degree</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugGrantDegree('phd'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
          <strong>Grant All Degrees (PhD)</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugSetEconomy('boom'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.2)' }}>
          <strong>📈 Set Economy: Boom</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugSetEconomy('recession'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.15)' }}>
          <strong>📉 Set Economy: Recession</strong>
        </button>
        <button className="glass-panel" onClick={() => { debugAddNetworking(50); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.2)' }}>
          <strong>🤝 +50 Networking</strong>
        </button>
        <button className="glass-panel" onClick={() => { engine.surrender(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.2)' }}>
          <strong>Kill Character (Health 0)</strong>
        </button>
      </div>
    </ActionSheet>
  );
}
