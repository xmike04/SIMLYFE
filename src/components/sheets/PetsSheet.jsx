import React from 'react';
import ActionSheet from '../ActionSheet';
import { PET_CATALOG } from '../../config/petCatalog.js';

export default function PetsSheet({ pets, visitVet, bank, onClose }) {
  const alivePets = pets.filter(p => p.isAlive);
  const totalCost = alivePets.reduce((sum, p) => {
    const def = PET_CATALOG[p.speciesId];
    return sum + (def?.annualMaintenanceCost ?? 0);
  }, 0);

  return (
    <ActionSheet title="My Pets 🐾" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {alivePets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.6, fontStyle: 'italic', fontSize: '0.9rem' }}>
            No pets yet. Adopt one from the Activities menu.
          </div>
        ) : (
          alivePets.map(pet => {
            const def = PET_CATALOG[pet.speciesId];
            return (
              <div key={pet.id} className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2rem' }}>{def?.icon ?? '🐾'}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '1rem' }}>{pet.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {def?.species ?? 'Pet'} • Age: {pet.age}
                    </div>
                  </div>
                  <button
                    className="glass-panel"
                    disabled={bank < 150}
                    onClick={() => visitVet(pet.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      background: 'rgba(59,130,246,0.15)',
                      opacity: bank < 150 ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    🩺 Vet ($150)
                  </button>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Health: {pet.health}/100
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px', width: '100%' }}>
                  <div style={{
                    background: '#10b981',
                    width: `${pet.health}%`,
                    height: '100%',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })
        )}

        {totalCost > 0 && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Annual maintenance: <strong style={{ color: '#ef4444' }}>${totalCost.toLocaleString()}/yr</strong>
          </div>
        )}

        <button className="glass-panel" onClick={onClose} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '4px' }}>
          Close
        </button>
      </div>
    </ActionSheet>
  );
}
