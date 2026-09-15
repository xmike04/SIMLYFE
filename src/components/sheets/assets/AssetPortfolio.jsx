import React from 'react';
import { calculateCapitalGainsTax } from '../../../config/assetCatalog';
import { normalizeInvestmentSubType } from '../../../engine/gameState';

export default function AssetPortfolio({
  bank, properties, belongings, tier,
  selectedProp, setSelectedProp, setAssetMenu, sellAsset,
  debugModifyBank, modifyProperty, triggerActivityEvent, close,
}) {
  const selectedInvestmentSubType = normalizeInvestmentSubType(selectedProp?.subType);
  const allOwned = [
    ...properties.map(p => ({ ...p, _category: 'property' })),
    ...belongings.map(b => ({ ...b, _category: 'belonging' })),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {allOwned.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>You don't own any assets yet.</div>
      )}
      {selectedProp ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem' }}>{selectedProp.icon ?? '🏠'}</div>
            <strong>{selectedProp.name}</strong>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Current Value: ${Math.floor(selectedProp.currentValue).toLocaleString()}
            </div>
            {(() => {
              const gain = Math.floor(selectedProp.currentValue - (selectedProp.purchasePrice ?? selectedProp.cost ?? 0));
              const cgt = gain > 0 ? calculateCapitalGainsTax(selectedProp.purchasePrice ?? 0, selectedProp.currentValue, tier.capitalGainsTaxRate ?? 0) : 0;
              return (
                <div style={{ fontSize: '0.8rem', color: gain >= 0 ? '#4ade80' : '#ef4444' }}>
                  {gain >= 0 ? `Profit: +$${gain.toLocaleString()}` : `Loss: -$${Math.abs(gain).toLocaleString()}`}
                  {cgt > 0 && <span style={{ color: '#fca5a5' }}> · CGT on sale: ${cgt.toLocaleString()}</span>}
                </div>
              );
            })()}
            {selectedProp.upkeep > 0 && <div style={{ fontSize: '0.75rem', color: '#f97316' }}>Annual upkeep: −${selectedProp.upkeep.toLocaleString()}/yr</div>}
            {/* Investment-specific detail rows */}
            {selectedInvestmentSubType === 'bond' && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Coupon rate: <strong style={{ color: '#a78bfa' }}>{Math.round((selectedProp.couponRate ?? 0) * 100)}%/yr</strong> (${Math.floor((selectedProp.purchasePrice ?? 0) * (selectedProp.couponRate ?? 0)).toLocaleString()} income/yr)</div>
                <div>Years to maturity: <strong style={{ color: '#fbbf24' }}>{selectedProp.yearsToMaturity ?? 0}</strong></div>
                <div>Par value: <strong>${(selectedProp.purchasePrice ?? 0).toLocaleString()}</strong> (returned at maturity)</div>
              </div>
            )}
            {selectedInvestmentSubType === 'crypto' && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Holdings: <strong style={{ color: '#fbbf24' }}>{(selectedProp.units ?? 0).toFixed(6)} {selectedProp.ticker ?? ''}</strong></div>
                <div>Volatility: <strong style={{ color: (selectedProp.volatility ?? 0) >= 1.5 ? '#ef4444' : (selectedProp.volatility ?? 0) >= 0.8 ? '#f97316' : '#fbbf24' }}>
                  {(selectedProp.volatility ?? 0) >= 1.5 ? 'Extreme 🌋' : (selectedProp.volatility ?? 0) >= 0.8 ? 'Very High 🎢' : 'High ⚡'}
                </strong></div>
                {selectedProp.trendiness != null && <div>Trend: <strong style={{ color: selectedProp.trendiness > 0.6 ? '#4ade80' : selectedProp.trendiness < 0.4 ? '#ef4444' : '#fbbf24' }}>{selectedProp.trendiness > 0.6 ? '🔥 Bullish' : selectedProp.trendiness < 0.4 ? '❄️ Bearish' : '⚖️ Neutral'}</strong></div>}
              </div>
            )}
            {(selectedInvestmentSubType === 'stock' || selectedInvestmentSubType === 'penny_stock') && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>Shares: <strong style={{ color: '#60a5fa' }}>{(selectedProp.units ?? 0).toFixed(4)}</strong></div>
                {selectedProp.sector && <div>Sector: <strong>{selectedProp.sector}</strong></div>}
                {selectedProp.baseReturn != null && <div>Avg return: <strong style={{ color: '#4ade80' }}>{Math.round(selectedProp.baseReturn * 100)}%/yr</strong></div>}
              </div>
            )}
            {selectedInvestmentSubType === 'fund' && (
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {selectedProp.returnProfile?.label && <div>Strategy: <strong style={{ color: '#34d399' }}>{selectedProp.returnProfile.label}</strong></div>}
                {selectedProp.returnProfile?.base != null && <div>Base return: <strong style={{ color: '#4ade80' }}>{Math.round(selectedProp.returnProfile.base * 100)}%/yr</strong></div>}
              </div>
            )}
          </div>
          {(selectedProp.type === 'property' || selectedProp._category === 'property') && (
            <>
              <button className="glass-panel" disabled={bank < 10000} onClick={() => { debugModifyBank(-10000); modifyProperty(selectedProp.id, 25000); triggerActivityEvent(`Renovated my ${selectedProp.name} for $10,000.`); close(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59,130,246,0.1)' }}>
                <strong>🔨 Renovate (−$10,000)</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+$25,000 to property value</div>
              </button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent(`Threw a massive party at my ${selectedProp.name}.`); close(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(236,72,153,0.1)' }}>
                <strong>🎉 Throw a Party</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Invite people over (+Happiness, +Relations)</div>
              </button>
            </>
          )}
          <button className="glass-panel" onClick={() => { sellAsset(selectedProp._category === 'property' ? 'property' : 'belonging', selectedProp.id); setSelectedProp(null); }}
            style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239,68,68,0.1)' }}>
            <strong style={{ color: '#ef4444' }}>💰 Sell Asset</strong>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Liquidate for cash (after CGT)</div>
          </button>
          <button className="glass-panel" onClick={() => setSelectedProp(null)} style={{ padding: '0.8rem', textAlign: 'center' }}>← Back</button>
        </div>
      ) : (
        <>
          {allOwned.map(asset => {
            const gain = Math.floor(asset.currentValue - (asset.purchasePrice ?? asset.cost ?? 0));
            const isInvestment = !!asset.subType;
            const assetSubType = normalizeInvestmentSubType(asset.subType);
            return (
              <button key={asset.id} className="glass-panel" onClick={() => setSelectedProp(asset)}
                style={{ padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', width: '100%', textAlign: 'left' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold' }}>{asset.icon ?? (asset._category === 'property' ? '🏠' : '📦')} {asset.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ${Math.floor(asset.currentValue).toLocaleString()} · {asset.yearsOwned}yr owned
                  </div>
                  {isInvestment && assetSubType === 'bond' && (
                    <div style={{ fontSize: '0.7rem', color: '#a78bfa' }}>
                      {Math.round((asset.couponRate ?? 0) * 100)}% coupon · {asset.yearsToMaturity ?? 0}yr to maturity
                    </div>
                  )}
                  {isInvestment && assetSubType === 'crypto' && (
                    <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
                      {(asset.units ?? 0).toFixed(4)} units · {asset.ticker ?? ''}
                      {asset.trendiness != null && <span style={{ color: asset.trendiness > 0.6 ? '#4ade80' : asset.trendiness < 0.4 ? '#ef4444' : '#fbbf24' }}> · {asset.trendiness > 0.6 ? '🔥 Hot' : asset.trendiness < 0.4 ? '❄️ Cold' : '⚖️ Neutral'}</span>}
                    </div>
                  )}
                  {isInvestment && (assetSubType === 'stock' || assetSubType === 'penny_stock') && (
                    <div style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
                      {(asset.units ?? 0).toFixed(2)} shares{asset.sector ? ` · ${asset.sector}` : ''}
                      {asset.baseReturn != null && <span style={{ color: '#4ade80' }}> · avg {Math.round(asset.baseReturn * 100)}%/yr</span>}
                    </div>
                  )}
                  {isInvestment && assetSubType === 'fund' && (
                    <div style={{ fontSize: '0.7rem', color: '#34d399' }}>
                      {asset.returnProfile?.label ?? 'Diversified Fund'}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: gain >= 0 ? '#4ade80' : '#ef4444' }}>
                    {gain >= 0 ? '+' : ''}${gain.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>vs purchase</div>
                </div>
              </button>
            );
          })}
          <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '8px' }}>← Back</button>
        </>
      )}
    </div>
  );
}
