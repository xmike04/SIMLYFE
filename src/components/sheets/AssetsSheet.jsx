import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';
import { getWealthTier, calculateIncomeTax } from '../../config/wealthTiers';
import { ASSET_CATALOG, calculateCapitalGainsTax } from '../../config/assetCatalog';
import { getStoresByCategory } from '../../config/storeCatalog';
import { CRYPTO_LIST, STOCK_LIST, PENNY_STOCK_LIST, BOND_LIST, FUND_LIST, getMarketHealth, bondDisplayName } from '../../config/investmentMarket';

const SHOP_TABS = [
  { id: 'realEstate', label: 'Real Estate', icon: '🏡' },
  { id: 'vehicles',   label: 'Vehicles',    icon: '🚗' },
  { id: 'luxury',     label: 'Luxury',      icon: '💎' },
  { id: 'investments',label: 'Invest',       icon: '📊' },
];

const CATEGORY_MAP = { realEstate: 'property', vehicles: 'vehicle', luxury: 'luxury', investments: 'investment' };

export default function AssetsSheet({
  bank, properties, belongings, career, economyCycle,
  buyAsset, sellAsset, buyInvestment, sellInvestment,
  modifyProperty, triggerActivityEvent, debugModifyBank,
  onClose,
}) {
  const [assetMenu, setAssetMenu] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [shopTab, setShopTab] = useState('realEstate');
  const [shopStore, setShopStore] = useState(null);
  const [investSubType, setInvestSubType] = useState(null);
  const [investSelected, setInvestSelected] = useState(null);
  const [investAmount, setInvestAmount] = useState('');

  const close = () => {
    setAssetMenu(null);
    setSelectedProp(null);
    setShopStore(null);
    setInvestSubType(null);
    setInvestSelected(null);
    setInvestAmount('');
    onClose();
  };

  const tier = getWealthTier(bank);
  const propVal = properties.reduce((acc, p) => acc + p.currentValue, 0);
  const belVal  = belongings.reduce((acc, b) => acc + b.currentValue, 0);
  const equity  = career?.equity ?? 0;
  const netWorth = Math.floor(bank + propVal + belVal + equity);
  const annualSalary = career?.salary ?? 0;
  const annualIncomeTax = calculateIncomeTax(annualSalary, bank);
  const annualUpkeep = properties.reduce((a, p) => a + (p.upkeep || 0), 0) + belongings.reduce((a, b) => a + (b.upkeep || 0), 0);
  const cashflow = annualSalary - annualIncomeTax - annualUpkeep - tier.lifestyleCost;

  // Catalog lookup map: id → entry
  const catalogLookup = (() => {
    const map = {};
    Object.values(ASSET_CATALOG).flat().forEach(item => { map[item.id] = item; });
    return map;
  })();

  return (
    <ActionSheet
      title={assetMenu ? ({ finances: '📈 Finances', properties: '🏡 Properties', belongings: '💎 Belongings', shopping: '🛍️ Shop' }[assetMenu] || 'Assets') : '🏦 Assets'}
      onClose={() => { setAssetMenu(null); setSelectedProp(null); onClose(); }}
    >
      {/* ── Overview ── */}
      {!assetMenu && (
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
      )}

      {/* ── Finances panel ── */}
      {assetMenu === 'finances' && (
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
      )}

      {/* ── Portfolio (owned assets) ── */}
      {assetMenu === 'portfolio' && (() => {
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
                  {selectedProp.subType === 'bond' && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Coupon rate: <strong style={{ color: '#a78bfa' }}>{Math.round((selectedProp.couponRate ?? 0) * 100)}%/yr</strong> (${Math.floor((selectedProp.purchasePrice ?? 0) * (selectedProp.couponRate ?? 0)).toLocaleString()} income/yr)</div>
                      <div>Years to maturity: <strong style={{ color: '#fbbf24' }}>{selectedProp.yearsToMaturity ?? 0}</strong></div>
                      <div>Par value: <strong>${(selectedProp.purchasePrice ?? 0).toLocaleString()}</strong> (returned at maturity)</div>
                    </div>
                  )}
                  {selectedProp.subType === 'crypto' && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Holdings: <strong style={{ color: '#fbbf24' }}>{(selectedProp.units ?? 0).toFixed(6)} {selectedProp.ticker ?? ''}</strong></div>
                      <div>Volatility: <strong style={{ color: (selectedProp.volatility ?? 0) >= 1.5 ? '#ef4444' : (selectedProp.volatility ?? 0) >= 0.8 ? '#f97316' : '#fbbf24' }}>
                        {(selectedProp.volatility ?? 0) >= 1.5 ? 'Extreme 🌋' : (selectedProp.volatility ?? 0) >= 0.8 ? 'Very High 🎢' : 'High ⚡'}
                      </strong></div>
                      {selectedProp.trendiness != null && <div>Trend: <strong style={{ color: selectedProp.trendiness > 0.6 ? '#4ade80' : selectedProp.trendiness < 0.4 ? '#ef4444' : '#fbbf24' }}>{selectedProp.trendiness > 0.6 ? '🔥 Bullish' : selectedProp.trendiness < 0.4 ? '❄️ Bearish' : '⚖️ Neutral'}</strong></div>}
                    </div>
                  )}
                  {(selectedProp.subType === 'stock' || selectedProp.subType === 'penny_stock') && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Shares: <strong style={{ color: '#60a5fa' }}>{(selectedProp.units ?? 0).toFixed(4)}</strong></div>
                      {selectedProp.sector && <div>Sector: <strong>{selectedProp.sector}</strong></div>}
                      {selectedProp.baseReturn != null && <div>Avg return: <strong style={{ color: '#4ade80' }}>{Math.round(selectedProp.baseReturn * 100)}%/yr</strong></div>}
                    </div>
                  )}
                  {selectedProp.subType === 'fund' && (
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
                  return (
                    <button key={asset.id} className="glass-panel" onClick={() => setSelectedProp(asset)}
                      style={{ padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', width: '100%', textAlign: 'left' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold' }}>{asset.icon ?? (asset._category === 'property' ? '🏠' : '📦')} {asset.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          ${Math.floor(asset.currentValue).toLocaleString()} · {asset.yearsOwned}yr owned
                        </div>
                        {isInvestment && asset.subType === 'bond' && (
                          <div style={{ fontSize: '0.7rem', color: '#a78bfa' }}>
                            {Math.round((asset.couponRate ?? 0) * 100)}% coupon · {asset.yearsToMaturity ?? 0}yr to maturity
                          </div>
                        )}
                        {isInvestment && asset.subType === 'crypto' && (
                          <div style={{ fontSize: '0.7rem', color: '#fbbf24' }}>
                            {(asset.units ?? 0).toFixed(4)} units · {asset.ticker ?? ''}
                            {asset.trendiness != null && <span style={{ color: asset.trendiness > 0.6 ? '#4ade80' : asset.trendiness < 0.4 ? '#ef4444' : '#fbbf24' }}> · {asset.trendiness > 0.6 ? '🔥 Hot' : asset.trendiness < 0.4 ? '❄️ Cold' : '⚖️ Neutral'}</span>}
                          </div>
                        )}
                        {isInvestment && (asset.subType === 'stock' || asset.subType === 'penny_stock') && (
                          <div style={{ fontSize: '0.7rem', color: '#60a5fa' }}>
                            {(asset.units ?? 0).toFixed(2)} shares{asset.sector ? ` · ${asset.sector}` : ''}
                            {asset.baseReturn != null && <span style={{ color: '#4ade80' }}> · avg {Math.round(asset.baseReturn * 100)}%/yr</span>}
                          </div>
                        )}
                        {isInvestment && asset.subType === 'fund' && (
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
      })()}

      {/* ── Shopping ── */}
      {assetMenu === 'shopping' && (() => {
        const stores = getStoresByCategory(shopTab, tier.id, catalogLookup);
        const activeStore = shopStore ? stores.find(s => s.id === shopStore) : null;

        const econPhase = economyCycle?.phase ?? 'normal';
        const phaseColor = econPhase === 'boom' ? '#4ade80' : econPhase === 'recession' ? '#ef4444' : '#fbbf24';

        const INV_TYPES = [
          { id: 'stocks',  label: 'Stocks',       icon: '📈', desc: 'Company shares. Moderate risk, long-term growth.',  list: STOCK_LIST },
          { id: 'crypto',  label: 'Crypto',        icon: '🪙', desc: 'Extreme volatility. Could 400x or go to zero.',     list: CRYPTO_LIST },
          { id: 'bonds',   label: 'Bonds',         icon: '📜', desc: 'Government bonds. Stable coupon income.',           list: BOND_LIST },
          { id: 'penny',   label: 'Penny Stocks',  icon: '🎲', desc: 'High-risk micro caps. Moonshot or bust.',           list: PENNY_STOCK_LIST },
          { id: 'funds',   label: 'Funds',         icon: '🏦', desc: 'Diversified funds. Passive wealth building.',       list: FUND_LIST },
        ];

        const CategoryTabs = () => (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
            {SHOP_TABS.map(tab => (
              <button key={tab.id} onClick={() => { setShopTab(tab.id); setShopStore(null); setInvestSubType(null); setInvestSelected(null); setInvestAmount(''); }}
                style={{ flex: 1, padding: '6px 2px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', background: shopTab === tab.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)', color: shopTab === tab.id ? '#fff' : 'var(--text-secondary)' }}>
                {tab.icon}<br/>{tab.label}
              </button>
            ))}
          </div>
        );

        // ── INVESTMENTS HUB ──────────────────────────────────────────────────
        if (shopTab === 'investments') {
          const econLabel = econPhase === 'boom' ? '📈 Bull Market' : econPhase === 'recession' ? '📉 Bear Market' : '〰️ Normal Market';

          // ── Instrument detail / buy view ──
          if (investSelected) {
            const inst = investSelected;
            const subType = investSubType;
            const amtNum = parseFloat(investAmount.replace(/,/g, '')) || 0;
            const minInv = inst.minInvestment ?? (inst.basePrice ? Math.ceil(inst.basePrice) : 100);
            const canBuy = amtNum >= minInv && amtNum <= bank && amtNum > 0;
            const units = inst.basePrice && subType !== 'bond' ? Math.floor(amtNum / inst.basePrice) : null;
            const ownedValue = belongings.filter(b => b.subType === subType && b.instrumentId === inst.id).reduce((s, b) => s + b.currentValue, 0);
            const presets = [
              { label: '10%', amt: Math.floor(bank * 0.10) },
              { label: '25%', amt: Math.floor(bank * 0.25) },
              { label: '50%', amt: Math.floor(bank * 0.50) },
              { label: 'All', amt: Math.floor(bank) },
            ];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CategoryTabs />
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

          // ── Instrument list for a sub-type ──
          if (investSubType) {
            const typeInfo = INV_TYPES.find(t => t.id === investSubType);
            const instrumentList = typeInfo?.list ?? [];
            const mh = getMarketHealth(investSubType, econPhase);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CategoryTabs />
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
                  const myHoldings = belongings.filter(b => b.subType === investSubType);
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
                                {investSubType === 'bond' && holding.yearsToMaturity != null && ` · ${holding.yearsToMaturity}yr left`}
                                {(investSubType === 'crypto' || investSubType === 'stock' || investSubType === 'penny_stock') && holding.units != null && ` · ${holding.units.toFixed(investSubType === 'crypto' ? 4 : 2)} units`}
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
                  const ownedVal = belongings.filter(b => b.subType === investSubType && b.instrumentId === inst.id).reduce((s, b) => s + b.currentValue, 0);
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

          // ── Investment Hub overview ──
          const myInvestments = belongings.filter(b => b.subType);
          const totalInvested = myInvestments.reduce((s, b) => s + b.currentValue, 0);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <CategoryTabs />
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
                const heldValue = belongings.filter(b => b.subType === type.id).reduce((s, b) => s + b.currentValue, 0);
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
        // ── END INVESTMENTS HUB ──────────────────────────────────────────────

        // ── Store catalog ──
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
              {SHOP_TABS.map(tab => (
                <button key={tab.id} onClick={() => { setShopTab(tab.id); setShopStore(null); setInvestSubType(null); setInvestSelected(null); }}
                  style={{ flex: 1, padding: '6px 2px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', background: shopTab === tab.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)', color: shopTab === tab.id ? '#fff' : 'var(--text-secondary)' }}>
                  {tab.icon}<br/>{tab.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', padding: '2px 0 4px' }}>
              {tier.icon} <strong style={{ color: tier.color }}>{tier.label}</strong> — stores and items unlock as your wealth grows
            </div>
            {!activeStore && (
              <>
                {stores.map(store => {
                  const unlockedCount = store.listings.filter(l => !l.locked).length;
                  const affordableCount = store.listings.filter(l => !l.locked && bank >= l.price).length;
                  return (
                    <button key={store.id} className="glass-panel" onClick={() => !store.locked && setShopStore(store.id)}
                      style={{ padding: '0.9rem', textAlign: 'left', background: store.locked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', opacity: store.locked ? 0.45 : 1, cursor: store.locked ? 'not-allowed' : 'pointer', borderLeft: store.locked ? '3px solid #4b5563' : `3px solid ${tier.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{store.icon} {store.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{store.tagline}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                          {store.locked ? (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: '4px' }}>🔒 {store.minTier.replace('_',' ')}</span>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.72rem', color: '#4ade80' }}>{unlockedCount} listings</div>
                              {affordableCount > 0 && <div style={{ fontSize: '0.68rem', color: '#34d399' }}>{affordableCount} affordable</div>}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '4px' }}>← Back</button>
              </>
            )}
            {activeStore && (
              <>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(139,92,246,0.08)', borderLeft: `3px solid ${tier.color}` }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{activeStore.icon} {activeStore.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{activeStore.tagline}</div>
                  <div style={{ fontSize: '0.72rem', color: '#a78bfa', marginTop: '4px' }}>{activeStore.listings.length} listings · {activeStore.listings.filter(l => !l.locked).length} available to your tier</div>
                </div>
                {activeStore.listings.map((listing, idx) => {
                  const canAfford = bank >= listing.price;
                  const isLocked  = listing.locked;
                  const alreadyOwned = [...properties, ...belongings].some(a => a.catalogId === listing.catalogId && a.name === listing.displayName);
                  return (
                    <div key={`${listing.catalogId}_${idx}`} className="glass-panel"
                      style={{ padding: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLocked ? 'rgba(255,255,255,0.02)' : alreadyOwned ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.05)', opacity: isLocked ? 0.45 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem' }}>{listing.icon}</span>
                          <span style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>{listing.displayName}</span>
                          {alreadyOwned && <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(52,211,153,0.15)', padding: '1px 5px', borderRadius: '4px' }}>Owned</span>}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{listing.typeLabel}</div>
                        {isLocked ? (
                          <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>🔒 Requires {listing.minTier.replace('_',' ')} tier</div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: canAfford ? '#4ade80' : '#ef4444' }}>${listing.price.toLocaleString()}</span>
                            {listing.upkeep > 0 && <span style={{ fontSize: '0.7rem', color: '#f97316' }}>−${listing.upkeep.toLocaleString()}/yr upkeep</span>}
                            {listing.type === 'investment' && listing.returnProfile && <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>~{Math.round(listing.returnProfile.base * 100)}% base return</span>}
                            {listing.type === 'property' && <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>+{Math.round((listing.appreciationRate - 1) * 100)}%/yr appreciation</span>}
                          </div>
                        )}
                        {!isLocked && Object.keys(listing.statEffects).length > 0 && (
                          <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginTop: '2px' }}>
                            Passive: {Object.entries(listing.statEffects).map(([k, v]) => `${k} +${v}`).join(' · ')}
                          </div>
                        )}
                      </div>
                      <div style={{ marginLeft: '10px', flexShrink: 0 }}>
                        {!isLocked && (
                          <button className="btn btn-primary" disabled={!canAfford} style={{ fontSize: '0.75rem', padding: '5px 12px', opacity: canAfford ? 1 : 0.35 }}
                            onClick={() => { buyAsset(CATEGORY_MAP[shopTab], { ...listing.catalogEntry, name: listing.displayName, catalogId: listing.catalogId, cost: listing.price }); }}>
                            {canAfford ? 'Buy' : `$${Math.ceil((listing.price - bank) / 1000)}k short`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button className="glass-panel" onClick={() => setShopStore(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '4px' }}>← Back to {SHOP_TABS.find(t => t.id === shopTab)?.label}</button>
              </>
            )}
          </div>
        );
      })()}

    </ActionSheet>
  );
}
