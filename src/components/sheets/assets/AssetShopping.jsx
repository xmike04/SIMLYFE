import React from 'react';
import { ASSET_CATALOG } from '../../../config/assetCatalog';
import { getStoresByCategory } from '../../../config/storeCatalog';
import { SHOP_TABS, CATEGORY_MAP } from './assetShopConfig';
import ShopCategoryTabs from './ShopCategoryTabs';
import InvestmentHub from './InvestmentHub';

const catalogLookup = Object.fromEntries(Object.values(ASSET_CATALOG).flat().map(item => [item.id, item]));

export default function AssetShopping({
  bank, properties, belongings, tier,
  economyCycle, shopTab, setShopTab, shopStore,
  setShopStore, investSubType, setInvestSubType, investSelected,
  setInvestSelected, investAmount, setInvestAmount, buyAsset,
  buyInvestment, sellInvestment, triggerActivityEvent, setAssetMenu,
}) {
  const stores = getStoresByCategory(shopTab, tier.id, catalogLookup);
  const activeStore = shopStore ? stores.find(s => s.id === shopStore) : null;
  const changeCategory = (tabId) => {
    setShopTab(tabId);
    setShopStore(null);
    setInvestSubType(null);
    setInvestSelected(null);
    if (shopTab === 'investments') setInvestAmount('');
  };
  const categoryTabs = <ShopCategoryTabs shopTab={shopTab} onChange={changeCategory} />;
  if (shopTab === 'investments') {
    return (
      <InvestmentHub
        bank={bank}
        belongings={belongings}
        economyCycle={economyCycle}
        investSubType={investSubType}
        setInvestSubType={setInvestSubType}
        investSelected={investSelected}
        setInvestSelected={setInvestSelected}
        investAmount={investAmount}
        setInvestAmount={setInvestAmount}
        buyInvestment={buyInvestment}
        sellInvestment={sellInvestment}
        triggerActivityEvent={triggerActivityEvent}
        setAssetMenu={setAssetMenu}
        categoryTabs={categoryTabs}
      />
    );
  }
  // ── Store catalog ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {categoryTabs}
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
}
