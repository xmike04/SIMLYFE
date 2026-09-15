import React from 'react';

export default function AssetOverview({
  bank, properties, belongings, tier,
  netWorth, propVal, belVal, equity,
  setAssetMenu,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="glass-panel" style={{ padding: '1.2rem', textAlign: 'center', background: 'rgba(16,185,129,0.06)' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Net Worth</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34d399' }}>${netWorth.toLocaleString()}</div>
        <div style={{ fontSize: '0.75rem', color: tier.color, marginTop: '4px' }}>{tier.icon} {tier.label}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div className="glass-panel" style={{ padding: '0.8rem' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Cash</div><div style={{ fontWeight: 'bold' }}>${Math.floor(bank).toLocaleString()}</div></div>
        <div className="glass-panel" style={{ padding: '0.8rem' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Properties</div><div style={{ fontWeight: 'bold' }}>${Math.floor(propVal).toLocaleString()}</div></div>
        <div className="glass-panel" style={{ padding: '0.8rem' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Belongings</div><div style={{ fontWeight: 'bold' }}>${Math.floor(belVal).toLocaleString()}</div></div>
        <div className="glass-panel" style={{ padding: '0.8rem' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Equity</div><div style={{ fontWeight: 'bold' }}>${equity.toLocaleString()}</div></div>
      </div>
      <button className="glass-panel" onClick={() => setAssetMenu('finances')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59,130,246,0.1)' }}>
        <strong>📈 Detailed Finances</strong>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tax bracket, cashflow, CGT rate</div>
      </button>
      <button className="glass-panel" onClick={() => setAssetMenu('portfolio')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.1)' }}>
        <strong>🗂️ My Portfolio ({properties.length + belongings.length} assets)</strong>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage and sell what you own</div>
      </button>
      <button className="glass-panel" onClick={() => setAssetMenu('shopping')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(236,72,153,0.1)' }}>
        <strong>🛍️ Go Shopping</strong>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Real estate, vehicles, luxury, investments</div>
      </button>
    </div>
  );
}
