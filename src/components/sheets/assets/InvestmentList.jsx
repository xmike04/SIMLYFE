import React from 'react';
import { getMarketHealth, bondDisplayName } from '../../../config/investmentMarket';
import { normalizeInvestmentSubType } from '../../../engine/gameState';
import { INV_TYPES } from './assetShopConfig';

export default function InvestmentList({
  bank, belongings, investSubType, setInvestSubType,
  setInvestSelected, setInvestAmount, sellInvestment, econPhase,
  categoryTabs,
}) {
  const typeInfo = INV_TYPES.find(t => t.id === investSubType);
  const instrumentList = typeInfo?.list ?? [];
  const mh = getMarketHealth(investSubType, econPhase);
  const canonicalSubType = normalizeInvestmentSubType(investSubType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {categoryTabs}
      <div className="glass-panel" style={{ padding: '0.9rem', background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid #a78bfa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{typeInfo.icon} {typeInfo.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{typeInfo.desc}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Market</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: mh.color }}>{mh.label}</div>
          </div>
        </div>
        <div style={{ marginTop: '6px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
          <div style={{ width: `${mh.score}%`, height: '100%', background: mh.color, borderRadius: '3px', transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* My Holdings */}
      {(() => {
        const myHoldings = belongings.filter(b => normalizeInvestmentSubType(b.subType) === canonicalSubType);
        if (myHoldings.length === 0) return null;
        return (
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '2px 0 4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>My Holdings</div>
            {myHoldings.map(holding => {
              const gain = Math.floor(holding.currentValue) - (holding.purchasePrice ?? 0);
              return (
                <div key={holding.id} className="glass-panel" style={{ padding: '0.8rem', marginBottom: '4px', background: 'rgba(52,211,153,0.06)', borderLeft: '3px solid #34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{holding.icon} {holding.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Value: ${Math.floor(holding.currentValue).toLocaleString()}
                      {canonicalSubType === 'bond' && holding.yearsToMaturity != null && ` · ${holding.yearsToMaturity}yr left`}
                      {(canonicalSubType === 'crypto' || canonicalSubType === 'stock' || canonicalSubType === 'penny_stock') && holding.units != null && ` · ${holding.units.toFixed(canonicalSubType === 'crypto' ? 4 : 2)} units`}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: gain >= 0 ? '#4ade80' : '#ef4444' }}>{gain >= 0 ? '+' : ''}${gain.toLocaleString()} since purchase</div>
                  </div>
                  <button className="btn btn-primary"
                    style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'rgba(239,68,68,0.3)', marginLeft: '8px', flexShrink: 0 }}
                    onClick={() => sellInvestment(holding.id)}>
                    Sell
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '2px 0 4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available</div>

      {instrumentList.map(inst => {
        const ownedVal = belongings.filter(b => normalizeInvestmentSubType(b.subType) === canonicalSubType && b.instrumentId === inst.id).reduce((s, b) => s + b.currentValue, 0);
        const canAfford = bank >= (inst.minInvestment ?? (inst.basePrice ?? 100));
        return (
          <button key={inst.id} className="glass-panel" onClick={() => { setInvestSelected(inst); setInvestAmount(''); }}
            style={{ padding: '0.9rem', textAlign: 'left', background: ownedVal > 0 ? 'rgba(52,211,153,0.07)' : 'rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{inst.icon}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#c4b5fd' }}>
                    {investSubType === 'bonds' ? bondDisplayName(inst) : inst.name}
                    {inst.ticker && <span style={{ color: '#6b7280', fontSize: '0.78rem' }}> ({inst.ticker})</span>}
                  </div>
                  {investSubType === 'bonds' && inst.entity && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{inst.entity}</div>}
                  {investSubType === 'bonds' && <div style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '2px' }}>{(inst.coupon * 100).toFixed(1)}% Coupon</div>}
                  {investSubType === 'crypto' && inst.trendiness !== undefined && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Trendiness</div>
                      <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                        <div style={{ width: `${inst.trendiness * 100}%`, height: '100%', background: inst.trendiness >= 0.7 ? '#4ade80' : '#fbbf24', borderRadius: '2px' }} />
                      </div>
                    </div>
                  )}
                  {(investSubType === 'stocks' || investSubType === 'penny') && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Market Health</div>
                      <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                        <div style={{ width: `${mh.score}%`, height: '100%', background: mh.color, borderRadius: '2px' }} />
                      </div>
                    </div>
                  )}
                  {ownedVal > 0 && <div style={{ fontSize: '0.68rem', color: '#34d399', marginTop: '3px' }}>Holding: ${Math.floor(ownedVal).toLocaleString()}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                {inst.basePrice && <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: canAfford ? '#fff' : '#6b7280' }}>${inst.basePrice.toLocaleString()}</div>}
                {inst.minInvestment && !inst.basePrice && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Min ${inst.minInvestment.toLocaleString()}</div>}
                <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '2px' }}>›</div>
              </div>
            </div>
          </button>
        );
      })}
      <button className="glass-panel" onClick={() => setInvestSubType(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '4px' }}>← Back to Investments</button>
    </div>
  );
}
