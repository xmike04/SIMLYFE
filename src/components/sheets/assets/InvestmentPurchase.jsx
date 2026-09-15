import React from 'react';
import { normalizeInvestmentSubType } from '../../../engine/gameState';
import { INV_TYPES } from './assetShopConfig';

export default function InvestmentPurchase({
  bank, belongings, investSelected, investSubType,
  investAmount, setInvestAmount, setInvestSelected, buyInvestment,
  categoryTabs,
}) {
  const inst = investSelected;
  const subType = normalizeInvestmentSubType(investSubType);
  const amtNum = parseFloat(investAmount.replace(/,/g, '')) || 0;
  const minInv = inst.minInvestment ?? (inst.basePrice ? Math.ceil(inst.basePrice) : 100);
  const canBuy = amtNum >= minInv && amtNum <= bank && amtNum > 0;
  const units = inst.basePrice && subType !== 'bond' ? Math.floor(amtNum / inst.basePrice) : null;
  const ownedValue = belongings.filter(b => normalizeInvestmentSubType(b.subType) === subType && b.instrumentId === inst.id).reduce((s, b) => s + b.currentValue, 0);
  const presets = [
    { label: '10%', amt: Math.floor(bank * 0.10) },
    { label: '25%', amt: Math.floor(bank * 0.25) },
    { label: '50%', amt: Math.floor(bank * 0.50) },
    { label: 'All', amt: Math.floor(bank) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {categoryTabs}
      <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(139,92,246,0.08)', borderLeft: '3px solid #a78bfa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ fontSize: '1.4rem' }}>{inst.icon}</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#c4b5fd' }}>
              {inst.name}{inst.ticker ? <span style={{ color: '#6b7280', fontSize: '0.85rem' }}> ({inst.ticker})</span> : null}
            </div>
            {inst.entity && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{inst.entity}</div>}
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{inst.description}</div>
      </div>
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {inst.basePrice && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Price / Unit</div><div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>${inst.basePrice.toLocaleString()}</div></div>}
          {inst.coupon && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Coupon Rate</div><div style={{ fontWeight: 'bold', color: '#4ade80' }}>{(inst.coupon * 100).toFixed(1)}%</div></div>}
          {inst.maturity && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Maturity</div><div style={{ fontWeight: 'bold' }}>{inst.maturity} Years</div></div>}
          {inst.volatility && (
            <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Volatility</div>
              <div style={{ fontWeight: 'bold', color: inst.volatility >= 1.5 ? '#ef4444' : inst.volatility >= 0.7 ? '#f97316' : '#fbbf24' }}>
                {inst.volatility >= 1.5 ? '🔥 Extreme' : inst.volatility >= 0.7 ? '⚡ High' : inst.volatility >= 0.4 ? '📊 Moderate' : '🛡️ Low'}
              </div>
            </div>
          )}
          {inst.baseReturn && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Avg Annual Return</div><div style={{ fontWeight: 'bold', color: '#34d399' }}>~{(inst.baseReturn * 100).toFixed(0)}%</div></div>}
          {inst.returnProfile && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Base Return</div><div style={{ fontWeight: 'bold', color: '#34d399' }}>~{(inst.returnProfile.base * 100).toFixed(0)}%/yr</div></div>}
          <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Min Investment</div><div style={{ fontWeight: 'bold' }}>${minInv.toLocaleString()}</div></div>
          {ownedValue > 0 && <div><div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>You Own</div><div style={{ fontWeight: 'bold', color: '#4ade80' }}>${Math.floor(ownedValue).toLocaleString()}</div></div>}
        </div>
        {inst.risk !== undefined && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
              <span>Risk</span>
              <span style={{ color: inst.risk >= 0.7 ? '#ef4444' : inst.risk >= 0.4 ? '#f97316' : '#4ade80' }}>
                {inst.risk >= 0.7 ? 'Very High' : inst.risk >= 0.4 ? 'High' : inst.risk >= 0.2 ? 'Medium' : 'Low'}
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
              <div style={{ width: `${inst.risk * 100}%`, height: '100%', borderRadius: '3px', background: inst.risk >= 0.7 ? '#ef4444' : inst.risk >= 0.4 ? '#f97316' : '#4ade80' }} />
            </div>
          </div>
        )}
        {inst.trendiness !== undefined && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '3px' }}>
              <span>Trendiness</span><span style={{ color: inst.trendiness >= 0.7 ? '#4ade80' : '#fbbf24' }}>{Math.round(inst.trendiness * 100)}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
              <div style={{ width: `${inst.trendiness * 100}%`, height: '100%', borderRadius: '3px', background: inst.trendiness >= 0.7 ? '#4ade80' : '#fbbf24' }} />
            </div>
          </div>
        )}
      </div>
      <div className="glass-panel" style={{ padding: '0.9rem' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Investment Amount — Cash: <strong style={{ color: '#34d399' }}>${Math.floor(bank).toLocaleString()}</strong></div>
        <input type="number" value={investAmount} onChange={e => setInvestAmount(e.target.value)} placeholder={`Min $${minInv.toLocaleString()}`}
          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '1rem', marginBottom: '8px', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          {presets.map(p => (
            <button key={p.label} onClick={() => setInvestAmount(String(p.amt))}
              style={{ flex: 1, padding: '5px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.72rem', background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
              {p.label}
            </button>
          ))}
        </div>
        {amtNum > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {units !== null && units > 0 ? <span>{units.toLocaleString()} units @ ${inst.basePrice.toLocaleString()} each · </span> : null}
            {subType === 'bond' && amtNum >= minInv ? <span>Annual coupon income: <strong style={{ color: '#4ade80' }}>+${Math.floor(amtNum * inst.coupon).toLocaleString()}/yr</strong> · </span> : null}
            Cost: <strong style={{ color: canBuy ? '#34d399' : '#ef4444' }}>${amtNum.toLocaleString()}</strong>
          </div>
        )}
        <button className="btn btn-primary" disabled={!canBuy} style={{ width: '100%', padding: '10px', fontSize: '0.9rem', opacity: canBuy ? 1 : 0.35 }}
          onClick={() => { buyInvestment(inst, amtNum, subType); setInvestSelected(null); setInvestAmount(''); }}>
          {!canBuy && amtNum < minInv && amtNum > 0 ? `Min $${minInv.toLocaleString()}` : !canBuy && amtNum > bank ? 'Not enough cash' : '💸 Buy it'}
        </button>
      </div>
      <button className="glass-panel" onClick={() => { setInvestSelected(null); setInvestAmount(''); }} style={{ padding: '0.8rem', textAlign: 'center' }}>← Back to {INV_TYPES.find(t => t.id === investSubType)?.label}</button>
    </div>
  );
}
