import { CRYPTO_LIST, STOCK_LIST, PENNY_STOCK_LIST, BOND_LIST, FUND_LIST } from '../../../config/investmentMarket';

export const SHOP_TABS = [
  { id: 'realEstate', label: 'Real Estate', icon: '🏡' },
  { id: 'vehicles',   label: 'Vehicles',    icon: '🚗' },
  { id: 'luxury',     label: 'Luxury',      icon: '💎' },
  { id: 'investments',label: 'Invest',       icon: '📊' },
];

export const CATEGORY_MAP = { realEstate: 'property', vehicles: 'vehicle', luxury: 'luxury', investments: 'investment' };

export const INV_TYPES = [
  { id: 'stocks',  label: 'Stocks',       icon: '📈', desc: 'Company shares. Moderate risk, long-term growth.',  list: STOCK_LIST },
  { id: 'crypto',  label: 'Crypto',        icon: '🪙', desc: 'Extreme volatility. Could 400x or go to zero.',     list: CRYPTO_LIST },
  { id: 'bonds',   label: 'Bonds',         icon: '📜', desc: 'Government bonds. Stable coupon income.',           list: BOND_LIST },
  { id: 'penny',   label: 'Penny Stocks',  icon: '🎲', desc: 'High-risk micro caps. Moonshot or bust.',           list: PENNY_STOCK_LIST },
  { id: 'funds',   label: 'Funds',         icon: '🏦', desc: 'Diversified funds. Passive wealth building.',       list: FUND_LIST },
];
