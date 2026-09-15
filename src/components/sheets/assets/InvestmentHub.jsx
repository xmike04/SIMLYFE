import React from 'react';
import { getMarketHealth } from '../../../config/investmentMarket';
import { normalizeInvestmentSubType } from '../../../engine/gameState';
import { INV_TYPES } from './assetShopConfig';
import InvestmentPurchase from './InvestmentPurchase';
import InvestmentList from './InvestmentList';

export default function InvestmentHub({
  bank, belongings, economyCycle, investSubType,
  setInvestSubType, investSelected, setInvestSelected, investAmount,
  setInvestAmount, buyInvestment, sellInvestment, triggerActivityEvent,
  setAssetMenu, categoryTabs,
}) {
  const econPhase = economyCycle?.phase ?? 'normal';
  const phaseColor = econPhase === 'boom' ? '#4ade80' : econPhase === 'recession' ? '#ef4444' : '#fbbf24';
  const econLabel = econPhase === 'boom' ? '📈 Bull Market' : econPhase === 'recession' ? '📉 Bear Market' : '〰️ Normal Market';
  if (investSelected) {
    return (
      <InvestmentPurchase
        bank={bank}
        belongings={belongings}
        investSelected={investSelected}
        investSubType={investSubType}
        investAmount={investAmount}
        setInvestAmount={setInvestAmount}
        setInvestSelected={setInvestSelected}
        buyInvestment={buyInvestment}
        categoryTabs={categoryTabs}
      />
    );
  }
  if (investSubType) {
    return (
      <InvestmentList
        bank={bank}
        belongings={belongings}
        investSubType={investSubType}
        setInvestSubType={setInvestSubType}
        setInvestSelected={setInvestSelected}
        setInvestAmount={setInvestAmount}
        sellInvestment={sellInvestment}
        econPhase={econPhase}
        categoryTabs={categoryTabs}
      />
    );
  }
  // ── Investment Hub overview ──
  const myInvestments = belongings.filter(b => b.subType);
  const totalInvested = myInvestments.reduce((s, b) => s + b.currentValue, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {categoryTabs}
      <div className="glass-panel" style={{ padding: '0.9rem', background: 'rgba(16,185,129,0.06)', borderLeft: `3px solid ${phaseColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{econLabel}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Economy phase affects all markets</div>
          </div>
          {totalInvested > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Portfolio Value</div>
              <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.9rem' }}>${Math.floor(totalInvested).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '2px 0', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { icon: '👤', label: 'Financial Advisor', ctx: 'I consulted a financial advisor for investment advice.' },
          { icon: '📰', label: 'Financial News', ctx: 'I read the financial news to understand market trends.' },
          { icon: '🤔', label: 'Opinion', ctx: 'I asked someone for their opinion on my investment strategy.' },
        ].map(tool => (
          <button key={tool.label} className="glass-panel" onClick={() => triggerActivityEvent(tool.ctx)}
            style={{ flex: 1, padding: '0.7rem 4px', textAlign: 'center', fontSize: '0.68rem', color: '#c4b5fd', background: 'rgba(139,92,246,0.1)' }}>
            <div style={{ fontSize: '1.1rem', marginBottom: '3px' }}>{tool.icon}</div>
            {tool.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '4px 0 2px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Investment Types</div>
      {INV_TYPES.map(type => {
        const mh = getMarketHealth(type.id, econPhase);
        const canonicalSubType = normalizeInvestmentSubType(type.id);
        const heldValue = belongings.filter(b => normalizeInvestmentSubType(b.subType) === canonicalSubType).reduce((s, b) => s + b.currentValue, 0);
        return (
          <button key={type.id} className="glass-panel" onClick={() => setInvestSubType(type.id)}
            style={{ padding: '0.9rem', textAlign: 'left', background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem' }}>{type.icon}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.92rem' }}>{type.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1px', maxWidth: '180px' }}>{type.desc}</div>
                  {heldValue > 0 && <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '2px' }}>Holding ${Math.floor(heldValue).toLocaleString()}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', minWidth: '60px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Market Health</div>
                <div style={{ width: '60px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '2px' }}>
                  <div style={{ width: `${mh.score}%`, height: '100%', background: mh.color, borderRadius: '3px' }} />
                </div>
                <div style={{ fontSize: '0.65rem', color: mh.color }}>{mh.label} ›</div>
              </div>
            </div>
          </button>
        );
      })}
      <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '4px' }}>← Back</button>
    </div>
  );
}
