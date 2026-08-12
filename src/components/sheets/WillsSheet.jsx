import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';

const DRAFT_ERROR_MESSAGES = {
  invalid_pct: 'Percentages must be whole numbers between 0 and 100.',
  over_allocated: 'You cannot allocate more than 100% of your estate.',
};

export default function WillsSheet({ relationships, will, draftWill, triggerActivityEvent, onClose }) {
  const [willDistribution, setWillDistribution] = useState(() => {
    const saved = new Map((will?.allocations ?? []).map(a => [a.id, a.pct]));
    const initialDist = {};
    relationships.forEach(r => { initialDist[r.id] = saved.get(r.id) ?? 0; });
    return initialDist;
  });
  const [draftError, setDraftError] = useState(null);

  const handleCompleteWill = () => {
    const allocations = relationships
      .map(r => ({ id: r.id, pct: parseInt(willDistribution[r.id], 10) || 0 }))
      .filter(a => a.pct > 0);

    const result = draftWill(allocations);
    if (result !== 'ok') {
      setDraftError(DRAFT_ERROR_MESSAGES[result] ?? 'Could not finalize the will.');
      return;
    }

    let str = "";
    if (allocations.length === 0) {
      str = "Drafted a standard will explicitly spreading all assets and money evenly across my entire family and lovers.";
    } else {
      const details = relationships
        .filter(r => (parseInt(willDistribution[r.id], 10) || 0) > 0)
        .map(r => `${willDistribution[r.id]}% to my ${r.type.toLowerCase()} ${r.name}`);

      str = `Drafted a highly specific will leaving: ${details.join(', ')}. The family members who got left out or received little might have feelings about this.`;
    }
    triggerActivityEvent(str);
    onClose();
  };

  const totalAllocated = Object.values(willDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0);

  return (
    <ActionSheet title="Will & Testament" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
          Allocate percentages of your estate and belongings to your relationships. Remaining estate will be automatically heavily taxed or donated upon your death.
        </p>
        {relationships.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontStyle: 'italic' }}>You have no recorded relationships to bequeath assets to.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
            {relationships.map(rel => (
              <div key={rel.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)' }}>
                <div>
                  <strong>{rel.name}</strong> <span style={{ opacity: 0.7, fontSize: '0.8rem', marginLeft: '5px', color:'var(--text-muted)' }}>({rel.type})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="number"
                    min="0" max="100"
                    value={willDistribution[rel.id]}
                    onChange={(e) => { setDraftError(null); setWillDistribution(prev => ({...prev, [rel.id]: e.target.value})); }}
                    style={{ width: '60px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px', borderRadius: '4px', textAlign: 'right' }}
                  />%
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Total Allocated:</span>
          <strong style={{ fontSize: '1.2rem', color: totalAllocated > 100 ? '#ef4444' : '#34d399' }}>
            {totalAllocated}%
          </strong>
        </div>

        {draftError && (
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#ef4444', textAlign: 'center' }}>{draftError}</p>
        )}

        <button
          className="glass-panel"
          disabled={totalAllocated > 100}
          onClick={handleCompleteWill}
          style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.2)', marginTop: '10px' }}
        >
          <strong>Finalize Trust</strong>
        </button>
      </div>
    </ActionSheet>
  );
}
