import React from 'react';

export default function AssetFinances({
  tier, netWorth, annualSalary, annualIncomeTax,
  annualUpkeep, cashflow, setAssetMenu,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="glass-panel" style={{ padding: '1.2rem', textAlign: 'center', background: 'rgba(16,185,129,0.06)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net Worth</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34d399' }}>${netWorth.toLocaleString()}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '3px solid #34d399' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Gross Salary</div>
          <div style={{ fontWeight: 'bold', color: '#34d399' }}>+${annualSalary.toLocaleString()}</div>
        </div>
        <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '3px solid #ef4444' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Income Tax ({Math.round(tier.incomeTaxRate * 100)}%)</div>
          <div style={{ fontWeight: 'bold', color: '#ef4444' }}>−${annualIncomeTax.toLocaleString()}</div>
        </div>
        <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '3px solid #f97316' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Asset Upkeep</div>
          <div style={{ fontWeight: 'bold', color: '#f97316' }}>−${annualUpkeep.toLocaleString()}</div>
        </div>
        <div className="glass-panel" style={{ padding: '0.9rem', borderLeft: '3px solid #fbbf24' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Lifestyle Cost</div>
          <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>−${tier.lifestyleCost.toLocaleString()}</div>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '1rem', borderLeft: `4px solid ${cashflow >= 0 ? '#34d399' : '#ef4444'}`, background: cashflow >= 0 ? 'rgba(52,211,153,0.05)' : 'rgba(239,68,68,0.05)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Est. Annual Cashflow</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: cashflow >= 0 ? '#34d399' : '#ef4444' }}>{cashflow >= 0 ? '+' : ''}${cashflow.toLocaleString()}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div className="glass-panel" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Capital Gains Tax</div>
          <div style={{ fontWeight: 'bold', color: '#a78bfa' }}>{Math.round((tier.capitalGainsTaxRate ?? 0) * 100)}%</div>
        </div>
        <div className="glass-panel" style={{ padding: '0.9rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Decay Mult (partners)</div>
          <div style={{ fontWeight: 'bold', color: '#f472b6' }}>{tier.relationDecayMult}×</div>
        </div>
      </div>
      <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '8px' }}>← Back</button>
    </div>
  );
}
