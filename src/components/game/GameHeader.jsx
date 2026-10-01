import React from 'react';
import { getWealthTier } from '../../config/wealthTiers';
import { getCityById } from '../../config/cityData.js';

const SECTOR_META = {
  tech:          { icon: '💻', label: 'Tech' },
  trades:        { icon: '🔧', label: 'Trades' },
  healthcare:    { icon: '🏥', label: 'Healthcare' },
  education:     { icon: '📚', label: 'Education' },
  finance:       { icon: '💰', label: 'Finance' },
  law:           { icon: '⚖️', label: 'Law' },
  law_enforcement:{ icon: '🚔', label: 'Law Enforcement' },
  military:      { icon: '🎖️', label: 'Military' },
  government:    { icon: '🏛️', label: 'Government' },
  creative:      { icon: '🎨', label: 'Creative' },
  fitness:       { icon: '💪', label: 'Fitness' },
  service:       { icon: '🛎️', label: 'Service' },
};

export default function GameHeader({ engine, uiFrozen, openSheet, setActiveSheet, enableDevTools }) {
  const { character, age, bank, career, economyCycle, networking, narrativeMode, setNarrativeMode, authAccount } = engine;
  return (
    <div className="glass-panel text-center mb-1" style={{ padding: '0.8rem', flexShrink: 0, position: 'relative' }}>
      {/* Account: 👤 guest / 🔗 Google-linked */}
      <button
        onClick={() => openSheet('account')}
        disabled={uiFrozen}
        aria-label="Account"
        style={{ position: 'absolute', top: '8px', left: '12px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: uiFrozen ? 'not-allowed' : 'pointer', padding: '2px' }}
      >
        {authAccount && !authAccount.isAnonymous ? '🔗' : '👤'}
      </button>
      <h2 style={{ fontSize: '1.2rem', margin: '0 68px 0 38px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {character.name}
        {enableDevTools && (
          <span style={{ cursor: 'pointer', fontSize: '1rem', marginLeft: '6px' }} onClick={() => setActiveSheet('debug')}>🐛</span>
        )}
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Age: {age} • {character?.city ? `${getCityById(character.city)?.name ?? character.city}, ${character.country}` : character?.country}</p>
      <div style={{ position: 'absolute', top: '10px', right: '15px', color: '#10b981', fontWeight: 'bold', fontSize: '1rem' }}>
        ${bank.toLocaleString()}
      </div>
      {career && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {career.sector && SECTOR_META[career.sector] ? SECTOR_META[career.sector].icon : '💼'} {career.title} (${career.salary?.toLocaleString() ?? '0'}/yr)
        </p>
      )}
      {(() => {
        const tier = getWealthTier(bank);
        const taxRate = tier.incomeTaxRate;
        const badges = [];
        if (tier.id !== 'broke') badges.push(
          <span key="tier" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: tier.color, fontWeight: 'bold' }}>
            {tier.icon} {tier.label}
          </span>
        );
        if (taxRate > 0) badges.push(
          <span key="tax" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
            🧾 {Math.round(taxRate * 100)}% tax bracket
          </span>
        );
        if (tier.lifestyleCost > 0) badges.push(
          <span key="lifestyle" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
            ✨ −${tier.lifestyleCost.toLocaleString()}/yr lifestyle
          </span>
        );
        if (economyCycle?.phase === 'boom') badges.push(
          <span key="boom" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.25)', color: '#34d399', fontWeight: 'bold' }}>📈 Boom</span>
        );
        if (economyCycle?.phase === 'recession') badges.push(
          <span key="rec" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.25)', color: '#fca5a5', fontWeight: 'bold' }}>📉 Recession</span>
        );
        if (networking > 0) badges.push(
          <span key="net" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>🤝 Network: {networking}/100</span>
        );
        return badges.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {badges}
          </div>
        ) : null;
      })()}
      <button
        onClick={() => { if (!uiFrozen) setNarrativeMode(!narrativeMode); }}
        disabled={uiFrozen}
        style={{
          display: 'block',
          margin: '6px auto 0',
          background: narrativeMode ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${narrativeMode ? 'rgba(124, 58, 237, 0.6)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: '20px',
          padding: '4px 10px',
          fontSize: '0.75rem',
          color: narrativeMode ? '#a855f7' : 'var(--text-secondary)',
          cursor: uiFrozen ? 'not-allowed' : 'pointer',
          opacity: uiFrozen ? 0.5 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        {narrativeMode ? '📖 Prose' : '⚡ Quick'}
      </button>
    </div>

  );
}
