import React from 'react';
import { SHOP_TABS } from './assetShopConfig';

export default function ShopCategoryTabs({ shopTab, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
      {SHOP_TABS.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          style={{ flex: 1, padding: '6px 2px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold', background: shopTab === tab.id ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)', color: shopTab === tab.id ? '#fff' : 'var(--text-secondary)' }}>
          {tab.icon}<br/>{tab.label}
        </button>
      ))}
    </div>
  );
}
