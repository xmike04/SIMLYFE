/**
 * investmentMarket.js
 *
 * Tradeable financial instruments organized into 5 sub-types.
 * Used by the Investments hub (separate from the general store catalog).
 *
 * Each instrument is bought via buyInvestment(instrument, amountDollars, subType).
 * The resulting belonging has { type: 'investment', subType, instrumentId, ... }.
 */

// ── Cryptocurrency ──────────────────────────────────────────────────────────
// trendiness 0–1: affects boom magnitude. volatility: annual swing factor.
export const CRYPTO_LIST = [
  // volatility >= 1.5 → moonshot mechanic (2% chance of 50x–1000x per year)
  // volatility >= 0.8 → moderate moonshot (1.5% chance of 5x–100x per year)
  { id: 'simcoin',     name: 'SimCoin',     ticker: 'SIM',  icon: '🪙', basePrice: 142.50,     volatility: 0.65, trendiness: 0.90, description: 'The original life-sim token. Community-driven and wildly unpredictable.' },
  { id: 'gigachain',   name: 'GigaChain',   ticker: 'GIGA', icon: '⛓️', basePrice: 8_420.00,   volatility: 0.55, trendiness: 0.75, description: 'Layer-1 protocol promising to tokenize everything on Earth.' },
  { id: 'neuraltoken', name: 'NeuralToken',  ticker: 'NRLT', icon: '🧠', basePrice: 3_105.00,   volatility: 0.50, trendiness: 0.80, description: 'AI-backed crypto. Price moves on vibes and press releases.' },
  { id: 'pumpdump',    name: 'PumpDump',     ticker: 'PUMP', icon: '🚀', basePrice: 0.0042,     volatility: 2.00, trendiness: 0.55, description: 'Nobody knows why this exists. Can 1000x or go to zero in one year.' },
  { id: 'voidbucks',   name: 'VoidBucks',    ticker: 'VOID', icon: '🌑', basePrice: 22.80,      volatility: 1.80, trendiness: 0.40, description: 'Truly decentralized. No team, no roadmap, just chaos.' },
  { id: 'chilllcoin',  name: 'ChillCoin',    ticker: 'CHLL', icon: '😎', basePrice: 0.88,       volatility: 0.45, trendiness: 0.60, description: 'Meme coin with a 4-day roadmap. Surprisingly holds value.' },
  { id: 'diamondhands',name: 'DiamondH',     ticker: 'DHMN', icon: '💎', basePrice: 5_890.00,   volatility: 0.40, trendiness: 0.70, description: 'For the HODLers. Low volatility relative to peers.' },
  { id: 'dankeum',     name: 'Dankeum',      ticker: 'DANK', icon: '🌿', basePrice: 1.15,       volatility: 0.95, trendiness: 0.35, description: 'A cannabis-themed token nobody asked for. Prone to violent swings.' },
];

// ── Stocks ──────────────────────────────────────────────────────────────────
// baseReturn: annual drift (before volatility). volatility: annual swing factor.
export const STOCK_LIST = [
  { id: 'apx_tech',     name: 'ApexTech Corp',    ticker: 'APX',  icon: '💻', sector: 'tech',        basePrice: 218.40, volatility: 0.28, baseReturn: 0.12, description: 'Cloud infrastructure giant. Owns half the internet.' },
  { id: 'medcore',      name: 'MedCore Systems',   ticker: 'MEDC', icon: '🏥', sector: 'healthcare',  basePrice: 94.70,  volatility: 0.20, baseReturn: 0.09, description: 'Hospital software and diagnostic AI. Defensive play.' },
  { id: 'datastream',   name: 'DataStream Inc',    ticker: 'DATA', icon: '📡', sector: 'tech',        basePrice: 345.80, volatility: 0.30, baseReturn: 0.14, description: 'Real-time analytics for everything. High growth.' },
  { id: 'bankfirst',    name: 'BankFirst Corp',    ticker: 'BKFT', icon: '🏦', sector: 'finance',     basePrice: 52.30,  volatility: 0.22, baseReturn: 0.07, description: 'Major retail bank. Pays a dividend. Boring but solid.' },
  { id: 'greengrid',    name: 'GreenGrid Energy',  ticker: 'GRGD', icon: '⚡', sector: 'energy',      basePrice: 38.90,  volatility: 0.18, baseReturn: 0.06, description: 'Renewable energy utility. ESG darling.' },
  { id: 'retailmax',    name: 'RetailMax Global',  ticker: 'RMAX', icon: '🛒', sector: 'consumer',    basePrice: 76.50,  volatility: 0.24, baseReturn: 0.08, description: 'E-commerce and brick & mortar hybrid. Resilient.' },
  { id: 'aerodyne',     name: 'AeroDyne Corp',     ticker: 'AERO', icon: '✈️', sector: 'aerospace',   basePrice: 165.20, volatility: 0.26, baseReturn: 0.10, description: 'Defense contracts and commercial aviation.' },
  { id: 'pharmapro',    name: 'PharmaPro Ltd',     ticker: 'PPRO', icon: '💊', sector: 'pharma',      basePrice: 123.60, volatility: 0.32, baseReturn: 0.11, description: 'Blockbuster drug pipeline. Binary FDA outcomes.' },
  { id: 'autonation',   name: 'AutoNation EV',     ticker: 'AUTN', icon: '🚗', sector: 'auto',        basePrice: 89.40,  volatility: 0.35, baseReturn: 0.09, description: 'Electric vehicle startup turned mainstream.' },
  { id: 'realestate_r', name: 'PropInvest REIT',   ticker: 'PRIV', icon: '🏢', sector: 'real_estate', basePrice: 47.80,  volatility: 0.16, baseReturn: 0.06, description: 'Real estate investment trust paying quarterly dividends.' },
  { id: 'foodgiant',    name: 'FoodGiant Inc',     ticker: 'FDGN', icon: '🍔', sector: 'consumer',    basePrice: 61.20,  volatility: 0.14, baseReturn: 0.05, description: 'Global fast food and packaged foods. Ultimate defensive.' },
  { id: 'luxuryco',     name: 'LuxuryCo Group',    ticker: 'LUXG', icon: '👜', sector: 'luxury',      basePrice: 420.00, volatility: 0.22, baseReturn: 0.10, description: 'Fashion, watches, spirits. Recession-resistant wealth magnet.' },
];

// ── Penny Stocks ────────────────────────────────────────────────────────────
// High risk: 12% chance bankrupt, 10% moonshot (2x–6x), else ±50% random
export const PENNY_STOCK_LIST = [
  { id: 'wizwidget',   name: 'WizWidget Inc',      ticker: 'WIZW', icon: '📦', basePrice: 0.42,  description: 'Makes plastic widgets for other widgets. Somehow public.' },
  { id: 'bioblast',    name: 'BioBlast Corp',       ticker: 'BBIO', icon: '🧬', basePrice: 1.85,  description: 'Experimental cancer treatment in Phase 1 trials. Huge if true.' },
  { id: 'goldrush',    name: 'GoldRush Mining',     ticker: 'GLDM', icon: '⛏️', basePrice: 0.73,  description: 'Claims to have struck gold in three countries. Two are disputed.' },
  { id: 'nanotech',    name: 'NanoTech Labs',       ticker: 'NTLB', icon: '🔬', basePrice: 2.15,  description: 'Nano-everything. Patent troll or visionary. You decide.' },
  { id: 'spacedive',   name: 'SpaceDive Corp',      ticker: 'SPDV', icon: '🌌', basePrice: 0.91,  description: 'Budget space tourism startup. One rocket, one dream.' },
  { id: 'cryptomine',  name: 'CryptoMine Inc',      ticker: 'CRYM', icon: '⛓️', basePrice: 1.28,  description: 'Mines crypto in a warehouse. Electricity bills are enormous.' },
  { id: 'agritech',    name: 'AgriTech Solutions',  ticker: 'AGRT', icon: '🌾', basePrice: 0.55,  description: 'AI-powered farming from a 20-year-old with an iPad.' },
  { id: 'greenenergy', name: 'GreenEnergy Micro',   ticker: 'GREM', icon: '🌱', basePrice: 1.65,  description: 'Sells solar panels from a garage in Nevada.' },
];

// ── Government Bonds ────────────────────────────────────────────────────────
// coupon: annual rate. maturity: years to maturity. minInvestment in USD.
// risk: 0–1 (display bar). Emerging markets have higher coupon + risk.
export const BOND_LIST = [
  // United States
  { id: 'us_2yr',  name: 'US Government Bond',       ticker: null, icon: '🇺🇸', entity: 'U.S. Treasury',      maturity: 2,  coupon: 0.038, minInvestment: 1_000,  risk: 0.10, description: 'The world\'s safest investment. Backed by the US government.' },
  { id: 'us_5yr',  name: 'US Government Bond',       ticker: null, icon: '🇺🇸', entity: 'U.S. Treasury',      maturity: 5,  coupon: 0.042, minInvestment: 1_000,  risk: 0.10, description: 'Medium-term US T-note. Solid anchor for any portfolio.' },
  { id: 'us_10yr', name: 'US Government Bond',       ticker: null, icon: '🇺🇸', entity: 'U.S. Treasury',      maturity: 10, coupon: 0.045, minInvestment: 1_000,  risk: 0.12, description: 'The benchmark 10-year Treasury. Watched by every economist.' },
  { id: 'us_20yr', name: 'US Government Bond',       ticker: null, icon: '🇺🇸', entity: 'U.S. Treasury',      maturity: 20, coupon: 0.048, minInvestment: 5_000,  risk: 0.15, description: 'Long-duration US bond. Great yield, high interest-rate risk.' },
  // Germany
  { id: 'de_2yr',  name: 'German Government Bond',   ticker: null, icon: '🇩🇪', entity: 'German Government', maturity: 2,  coupon: 0.035, minInvestment: 1_000,  risk: 0.08, description: 'German Bundesanleihe (2-Yr). One of Europe\'s safest bonds.' },
  { id: 'de_5yr',  name: 'German Government Bond',   ticker: null, icon: '🇩🇪', entity: 'German Government', maturity: 5,  coupon: 0.038, minInvestment: 1_000,  risk: 0.09, description: 'Bund (5-Yr). Core holding for eurozone exposure.' },
  { id: 'de_10yr', name: 'German Government Bond',   ticker: null, icon: '🇩🇪', entity: 'German Government', maturity: 10, coupon: 0.041, minInvestment: 2_500,  risk: 0.10, description: 'The benchmark German Bund. AAA-rated sovereign debt.' },
  // United Kingdom
  { id: 'uk_5yr',  name: 'UK Government Bond',       ticker: null, icon: '🇬🇧', entity: 'HM Treasury',        maturity: 5,  coupon: 0.043, minInvestment: 1_000,  risk: 0.12, description: 'UK Gilt (5-Yr). Sterling-denominated sovereign debt.' },
  { id: 'uk_10yr', name: 'UK Government Bond',       ticker: null, icon: '🇬🇧', entity: 'HM Treasury',        maturity: 10, coupon: 0.046, minInvestment: 2_500,  risk: 0.14, description: 'UK Gilt (10-Yr). Higher yield than comparable German bonds.' },
  // Japan
  { id: 'jp_5yr',  name: 'Japanese Government Bond', ticker: null, icon: '🇯🇵', entity: 'Japan MOF',           maturity: 5,  coupon: 0.010, minInvestment: 5_000,  risk: 0.10, description: 'JGB (5-Yr). Ultra-low yield. Capital preservation only.' },
  { id: 'jp_10yr', name: 'Japanese Government Bond', ticker: null, icon: '🇯🇵', entity: 'Japan MOF',           maturity: 10, coupon: 0.013, minInvestment: 5_000,  risk: 0.12, description: 'JGB (10-Yr). Massive market, near-zero coupon. Stability play.' },
  // Australia
  { id: 'au_5yr',  name: 'Australian Govt Bond',     ticker: null, icon: '🇦🇺', entity: 'AOFM Australia',      maturity: 5,  coupon: 0.044, minInvestment: 2_000,  risk: 0.12, description: 'Australian Govt Bond (5-Yr). AAA-rated, resource-backed.' },
  { id: 'au_10yr', name: 'Australian Govt Bond',     ticker: null, icon: '🇦🇺', entity: 'AOFM Australia',      maturity: 10, coupon: 0.047, minInvestment: 2_000,  risk: 0.13, description: 'Australian Govt Bond (10-Yr). Attractive yield, stable currency.' },
  // Brazil (emerging market — higher yield, higher risk)
  { id: 'br_5yr',  name: 'Brazilian Govt Bond',      ticker: null, icon: '🇧🇷', entity: 'Brazil Treasury',     maturity: 5,  coupon: 0.115, minInvestment: 2_500,  risk: 0.55, description: 'Tesouro Nacional (5-Yr). High yield, significant FX risk.' },
  { id: 'br_10yr', name: 'Brazilian Govt Bond',      ticker: null, icon: '🇧🇷', entity: 'Brazil Treasury',     maturity: 10, coupon: 0.122, minInvestment: 2_500,  risk: 0.60, description: 'Tesouro Nacional (10-Yr). Emerging market premium. Volatile.' },
  // India
  { id: 'in_5yr',  name: 'Indian Government Bond',   ticker: null, icon: '🇮🇳', entity: 'Govt of India',       maturity: 5,  coupon: 0.072, minInvestment: 2_000,  risk: 0.40, description: 'G-Sec (5-Yr). Growing economy, moderate risk.' },
  { id: 'in_10yr', name: 'Indian Government Bond',   ticker: null, icon: '🇮🇳', entity: 'Govt of India',       maturity: 10, coupon: 0.075, minInvestment: 2_000,  risk: 0.42, description: 'G-Sec (10-Yr). India\'s benchmark bond. Solid EM bet.' },
];

// ── Funds (buyable via this hub) ─────────────────────────────────────────────
// These mirror the catalog funds but are accessible directly in the hub.
export const FUND_LIST = [
  { id: 'sp500_idx',      name: 'S&P 500 Index Fund',       ticker: 'SPX',  icon: '📊', minInvestment: 500,   returnProfile: { base: 0.10, boomBonus: 0.06, recessionPenalty: -0.14, volatility: 0.05 }, risk: 0.20, description: 'Tracks the 500 largest US companies. The classic.' },
  { id: 'total_world',    name: 'Total World Market ETF',   ticker: 'VT',   icon: '🌍', minInvestment: 500,   returnProfile: { base: 0.08, boomBonus: 0.05, recessionPenalty: -0.12, volatility: 0.05 }, risk: 0.20, description: 'Global diversification in one fund. Boring is beautiful.' },
  { id: 'bond_idx',       name: 'Aggregate Bond Index',     ticker: 'AGG',  icon: '📜', minInvestment: 1_000, returnProfile: { base: 0.04, boomBonus: 0.01, recessionPenalty: 0.02,  volatility: 0.01 }, risk: 0.08, description: 'Government and corporate bonds. The defensive core.' },
  { id: 'real_estate_etf',name: 'Real Estate ETF',          ticker: 'VNQ',  icon: '🏢', minInvestment: 1_000, returnProfile: { base: 0.07, boomBonus: 0.04, recessionPenalty: -0.10, volatility: 0.06 }, risk: 0.25, description: 'Diversified REIT exposure. Passive real estate income.' },
  { id: 'tech_etf',       name: 'Technology Sector ETF',    ticker: 'QQQ',  icon: '💻', minInvestment: 1_000, returnProfile: { base: 0.13, boomBonus: 0.10, recessionPenalty: -0.20, volatility: 0.09 }, risk: 0.40, description: 'Concentrated tech bet. High return, high drawdown.' },
  { id: 'hedge_alt',      name: 'Hedge Fund Alternative',   ticker: 'N/A',  icon: '🏦', minInvestment: 100_000, returnProfile: { base: 0.12, boomBonus: 0.08, recessionPenalty: -0.18, volatility: 0.10 }, risk: 0.55, description: '2-and-20 structure. Accredited investors only.' },
  { id: 'vc_seed',        name: 'Venture Capital (Seed)',   ticker: 'N/A',  icon: '🌱', minInvestment: 250_000, returnProfile: { base: 0.0, boomBonus: 0.60, recessionPenalty: -0.50, volatility: 0.50 }, risk: 0.85, description: 'Seed-stage startups. Most fail. One might print.' },
];

/**
 * Returns a market health score (0–100) and color for UI bars.
 * subType: 'crypto' | 'stocks' | 'bonds' | 'penny' | 'funds'
 * economyPhase: 'normal' | 'boom' | 'recession'
 */
export function getMarketHealth(subType, economyPhase) {
  const base = {
    crypto:  { normal: 55, boom: 80, recession: 30 },
    stocks:  { normal: 60, boom: 80, recession: 35 },
    bonds:   { normal: 70, boom: 55, recession: 85 },
    penny:   { normal: 40, boom: 60, recession: 20 },
    funds:   { normal: 65, boom: 78, recession: 40 },
  };
  const score = base[subType]?.[economyPhase] ?? 60;
  const noise = Math.floor((Math.random() - 0.5) * 10);
  const final = Math.max(5, Math.min(95, score + noise));
  const color = final >= 65 ? '#4ade80' : final >= 40 ? '#fbbf24' : '#ef4444';
  const label = final >= 65 ? 'Bullish' : final >= 40 ? 'Mixed' : 'Bearish';
  return { score: final, color, label };
}

/**
 * Formats display name for a bond listing (e.g. "US Government Bond (10-Yr)")
 */
export function bondDisplayName(bond) {
  return `${bond.name} (${bond.maturity}-Yr)`;
}
