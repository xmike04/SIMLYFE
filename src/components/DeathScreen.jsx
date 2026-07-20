import React from 'react';
import { getWealthTier } from '../config/wealthTiers';
import { findSpouse } from '../engine/gameState';

const STAT_META = [
  { key: 'health',      label: 'Health',      color: 'var(--health-color)' },
  { key: 'happiness',   label: 'Happiness',   color: 'var(--happiness-color)' },
  { key: 'smarts',      label: 'Smarts',      color: 'var(--smarts-color)' },
  { key: 'looks',       label: 'Looks',       color: 'var(--looks-color)' },
  { key: 'athleticism', label: 'Athletic',    color: 'var(--athleticism-color)' },
  { key: 'karma',       label: 'Karma',       color: 'var(--karma-color)' },
];

const EPITAPH_MAP = {
  health:    'They lived hard and died on their own terms.',
  happiness: 'They found joy where others found none.',
  smarts:    'They always had the answer — eventually.',
  looks:     'They turned heads to the very end.',
  karma:     'They tried to do right. Mostly.',
};

export default function DeathScreen({ engine }) {
  const { character, age, bank, history, stats, properties, belongings, career, relationships } = engine;

  const propVal = (properties ?? []).reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const belVal  = (belongings  ?? []).reduce((s, b) => s + (b.currentValue ?? 0), 0);
  const netWorth = Math.floor((bank ?? 0) + propVal + belVal);
  const tier = getWealthTier(netWorth);

  const investmentBelongings = (belongings ?? []).filter(b => b.subType);
  const spouse = findSpouse(relationships);

  const statValues = {
    health: stats?.health ?? 0,
    happiness: stats?.happiness ?? 0,
    smarts: stats?.smarts ?? 0,
    looks: stats?.looks ?? 0,
    karma: stats?.karma ?? 0,
  };
  const dominantStat = Object.entries(statValues).sort(([,a],[,b]) => b - a)[0][0];
  const epitaph = EPITAPH_MAP[dominantStat] ?? 'They lived. That was enough.';

  return (
    <div className="flex-center animate-fade-in" style={{ height: '100%', padding: '20px', overflowY: 'auto' }}>
      <div className="glass-panel text-center" style={{ width: '100%', border: '1px solid var(--health-color)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'var(--health-color)' }} />
        <h2 className="mb-4 mt-2" style={{ color: 'var(--health-color)', fontSize: '2rem' }}>The End.</h2>
        <h3 className="mb-2" style={{ fontSize: '1.5rem' }}>{character?.name}</h3>
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '4px' }}>{epitaph}</p>
        <p className="mb-1" style={{ fontSize: '1.1rem' }}>You died at age <b>{age}</b>.</p>

        {/* Wealth tier badge */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${tier.color}`, color: tier.color, padding: '3px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
            {tier.icon} {tier.label}
          </span>
        </div>

        {/* Net Worth breakdown */}
        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Final Net Worth</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#34d399' }}>${netWorth.toLocaleString()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Cash</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>${Math.floor(bank ?? 0).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Properties</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>${Math.floor(propVal).toLocaleString()}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Investments</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>${Math.floor(belVal).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Final Stats */}
        {stats && (
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '12px', textAlign: 'left' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Final Stats</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {STAT_META.map(({ key, label, color }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '64px', fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                    <div style={{ width: `${stats[key] ?? 0}%`, height: '100%', background: color, borderRadius: '3px' }} />
                  </div>
                  <div style={{ width: '28px', fontSize: '0.72rem', textAlign: 'right', color }}>{stats[key] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Life summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
          {career?.title && (
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Final Career</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#60a5fa' }}>{career.title}</div>
              {career.salary > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>${career.salary.toLocaleString()}/yr</div>}
            </div>
          )}
          {(relationships ?? []).length > 0 && (
            <div style={{ background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(244,114,182,0.2)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Relationships</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#f472b6' }}>{relationships.length} people</div>
              {spouse && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Married to {spouse.name}</div>}
            </div>
          )}
          {(properties ?? []).length > 0 && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Properties</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#34d399' }}>{properties.length} owned</div>
            </div>
          )}
          {investmentBelongings.length > 0 && (
            <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Investments</div>
              <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#a78bfa' }}>{investmentBelongings.length} positions</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>${Math.floor(belVal).toLocaleString()} total</div>
            </div>
          )}
        </div>

        {/* Final event */}
        <div className="mb-6" style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Last Words
          </p>
          <p style={{ fontSize: '0.95rem' }}>
            {history?.[history.length - 1]?.text || "Passed away peacefully."}
          </p>
        </div>

        {/* resetLife clears local + replaces cloud; reload would re-hydrate isDead */}
        <button className="btn" onClick={() => engine.resetLife()}>
          Live Again
        </button>
      </div>
    </div>
  );
}
