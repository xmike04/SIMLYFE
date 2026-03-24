/**
 * assetCatalog.js
 *
 * All purchasable assets grouped into four categories.
 * Each item includes:
 *   id              — unique key
 *   name            — display label
 *   icon            — emoji
 *   cost            — purchase price
 *   upkeep          — annual maintenance cost (deducted in ageUp)
 *   type            — used by ageUp to determine appreciation/depreciation behaviour
 *   minTier         — wealth tier id required to see + buy this item
 *   appreciationRate— annual value multiplier (1.03 = +3%/yr, 0.85 = −15%/yr)
 *   statEffects     — { stat: delta } applied passively each year while owned
 *   description     — shown in the shopping UI
 *
 * type values:
 *   'property'    — appreciates slowly, affected by market crash/boom events
 *   'vehicle'     — depreciates each year
 *   'luxury'      — appreciates slowly (collectibles hold/gain value)
 *   'investment'  — generates annual cash returns (handled separately in ageUp)
 */

export const ASSET_CATALOG = {

  // ── Real Estate ─────────────────────────────────────────────────────────────
  realEstate: [
    {
      id: 'studio_apt',
      name: 'Studio Apartment',
      icon: '🏢',
      cost: 50_000,
      upkeep: 1_200,
      type: 'property',
      minTier: 'struggling',
      appreciationRate: 1.03,
      statEffects: { happiness: 1 },
      description: 'A cozy studio in the city. Your first step onto the property ladder.',
    },
    {
      id: 'city_condo',
      name: 'City Condo',
      icon: '🏙️',
      cost: 120_000,
      upkeep: 4_000,
      type: 'property',
      minTier: 'working',
      appreciationRate: 1.035,
      statEffects: { happiness: 2, looks: 1 },
      description: 'Downtown living with HOA fees and rooftop access.',
    },
    {
      id: 'suburban_home',
      name: 'Suburban Home',
      icon: '🏡',
      cost: 250_000,
      upkeep: 2_500,
      type: 'property',
      minTier: 'working',
      appreciationRate: 1.04,
      statEffects: { happiness: 3, health: 1 },
      description: 'A comfortable family home in the suburbs with a backyard.',
    },
    {
      id: 'townhouse',
      name: 'Luxury Townhouse',
      icon: '🏘️',
      cost: 400_000,
      upkeep: 5_000,
      type: 'property',
      minTier: 'middle',
      appreciationRate: 1.04,
      statEffects: { happiness: 4, looks: 1 },
      description: 'A multi-floor townhouse in a desirable neighbourhood.',
    },
    {
      id: 'beachfront_villa',
      name: 'Beachfront Villa',
      icon: '🏖️',
      cost: 800_000,
      upkeep: 12_000,
      type: 'property',
      minTier: 'upper_middle',
      appreciationRate: 1.05,
      statEffects: { happiness: 6, health: 2 },
      description: 'Oceanfront property. Sunsets every evening.',
    },
    {
      id: 'penthouse',
      name: 'Luxury Penthouse',
      icon: '🌆',
      cost: 1_200_000,
      upkeep: 10_000,
      type: 'property',
      minTier: 'wealthy',
      appreciationRate: 1.05,
      statEffects: { happiness: 7, looks: 3 },
      description: 'Top-floor living with panoramic city views and a helipad.',
    },
    {
      id: 'mega_mansion',
      name: 'Mega Mansion',
      icon: '🏰',
      cost: 5_000_000,
      upkeep: 25_000,
      type: 'property',
      minTier: 'rich',
      appreciationRate: 1.045,
      statEffects: { happiness: 10, looks: 4, health: 1 },
      description: 'A sprawling estate with pools, tennis courts, and a gate house.',
    },
    {
      id: 'private_island',
      name: 'Private Island',
      icon: '🏝️',
      cost: 50_000_000,
      upkeep: 500_000,
      type: 'property',
      minTier: 'ultra',
      appreciationRate: 1.06,
      statEffects: { happiness: 15, health: 5, looks: 5 },
      description: 'Complete privacy. Your own sovereign territory in the ocean.',
    },
  ],

  // ── Vehicles ─────────────────────────────────────────────────────────────────
  vehicles: [
    {
      id: 'used_clunker',
      name: 'Used Clunker',
      icon: '🚗',
      cost: 3_000,
      upkeep: 400,
      type: 'vehicle',
      minTier: 'broke',
      appreciationRate: 0.80,
      statEffects: {},
      description: 'Barely runs. Smells like cigarettes. Gets you from A to B.',
    },
    {
      id: 'economy_car',
      name: 'Economy Car',
      icon: '🚙',
      cost: 15_000,
      upkeep: 600,
      type: 'vehicle',
      minTier: 'struggling',
      appreciationRate: 0.85,
      statEffects: { happiness: 1 },
      description: 'Reliable, fuel-efficient. Perfect for the daily commute.',
    },
    {
      id: 'sedan',
      name: 'New Sedan',
      icon: '🚘',
      cost: 40_000,
      upkeep: 1_200,
      type: 'vehicle',
      minTier: 'working',
      appreciationRate: 0.87,
      statEffects: { happiness: 2 },
      description: 'A solid midsize sedan with heated seats and Apple CarPlay.',
    },
    {
      id: 'suv',
      name: 'Luxury SUV',
      icon: '🛻',
      cost: 75_000,
      upkeep: 2_500,
      type: 'vehicle',
      minTier: 'middle',
      appreciationRate: 0.85,
      statEffects: { happiness: 3, looks: 1 },
      description: 'A premium SUV for families and status seekers alike.',
    },
    {
      id: 'sports_car',
      name: 'Sports Car',
      icon: '🏎️',
      cost: 120_000,
      upkeep: 5_000,
      type: 'vehicle',
      minTier: 'upper_middle',
      appreciationRate: 0.88,
      statEffects: { happiness: 5, looks: 3 },
      description: 'Turns heads at every intersection. 0–60 in 3.8 seconds.',
    },
    {
      id: 'supercar',
      name: 'Supercar',
      icon: '🚀',
      cost: 300_000,
      upkeep: 12_000,
      type: 'vehicle',
      minTier: 'wealthy',
      appreciationRate: 0.90,
      statEffects: { happiness: 7, looks: 5 },
      description: 'Italian engineering. Carbon fibre everything. 700 horsepower.',
    },
    {
      id: 'hypercar',
      name: 'Hypercar',
      icon: '⚡',
      cost: 2_500_000,
      upkeep: 50_000,
      type: 'vehicle',
      minTier: 'rich',
      appreciationRate: 1.02,
      statEffects: { happiness: 10, looks: 7 },
      description: 'One of 99 made. Likely appreciates. Definitely attracts attention.',
    },
    {
      id: 'private_jet',
      name: 'Private Jet',
      icon: '✈️',
      cost: 30_000_000,
      upkeep: 1_500_000,
      type: 'vehicle',
      minTier: 'ultra',
      appreciationRate: 0.92,
      statEffects: { happiness: 15, looks: 8, health: 2 },
      description: 'Fly anywhere, anytime. No security lines. Ever.',
    },
  ],

  // ── Luxury Goods ─────────────────────────────────────────────────────────────
  luxury: [
    {
      id: 'designer_watch',
      name: 'Designer Watch',
      icon: '⌚',
      cost: 8_000,
      upkeep: 0,
      type: 'luxury',
      minTier: 'working',
      appreciationRate: 1.02,
      statEffects: { looks: 2 },
      description: 'Swiss-made. Tells time and screams wealth simultaneously.',
    },
    {
      id: 'fine_art',
      name: 'Fine Art Piece',
      icon: '🖼️',
      cost: 25_000,
      upkeep: 500,
      type: 'luxury',
      minTier: 'middle',
      appreciationRate: 1.04,
      statEffects: { happiness: 2, smarts: 1 },
      description: 'An original work from a rising artist. A conversation piece.',
    },
    {
      id: 'rare_wine',
      name: 'Rare Wine Collection',
      icon: '🍷',
      cost: 50_000,
      upkeep: 1_000,
      type: 'luxury',
      minTier: 'upper_middle',
      appreciationRate: 1.06,
      statEffects: { happiness: 3, smarts: 1 },
      description: 'Climate-controlled cellar of Burgundy and Bordeaux grands crus.',
    },
    {
      id: 'custom_jewelry',
      name: 'Custom Jewelry Set',
      icon: '💍',
      cost: 100_000,
      upkeep: 0,
      type: 'luxury',
      minTier: 'wealthy',
      appreciationRate: 1.03,
      statEffects: { looks: 5, happiness: 4 },
      description: 'Bespoke pieces from a renowned jeweler. Diamonds, obviously.',
    },
    {
      id: 'superyacht',
      name: 'Superyacht',
      icon: '🛥️',
      cost: 15_000_000,
      upkeep: 1_000_000,
      type: 'luxury',
      minTier: 'rich',
      appreciationRate: 0.95,
      statEffects: { happiness: 12, health: 3, looks: 5 },
      description: '60-metre yacht with a crew of 12. Mediterranean summers.',
    },
    {
      id: 'rare_masterpiece',
      name: 'Rare Masterpiece',
      icon: '🎨',
      cost: 8_000_000,
      upkeep: 50_000,
      type: 'luxury',
      minTier: 'ultra',
      appreciationRate: 1.08,
      statEffects: { happiness: 10, smarts: 3, looks: 3 },
      description: 'A museum-quality painting. Your own private Monet.',
    },
  ],

  // ── Investments ──────────────────────────────────────────────────────────────
  // returnProfile: { base, boomBonus, recessionPenalty, volatility }
  //   Each year: return = base ± (random * volatility) + economy modifier
  //   If the roll goes negative you lose money that year.
  investments: [
    {
      id: 'index_fund',
      name: 'Index Fund',
      icon: '📊',
      cost: 10_000,
      upkeep: 0,
      type: 'investment',
      minTier: 'working',
      appreciationRate: 1.0, // managed by returnProfile
      returnProfile: { base: 0.07, boomBonus: 0.05, recessionPenalty: -0.12, volatility: 0.04 },
      statEffects: { happiness: 1 },
      description: 'Low-cost diversified fund tracking the whole market. Boring but reliable.',
    },
    {
      id: 'bonds',
      name: 'Government Bonds',
      icon: '📜',
      cost: 25_000,
      upkeep: 0,
      type: 'investment',
      minTier: 'working',
      appreciationRate: 1.0,
      returnProfile: { base: 0.04, boomBonus: 0.01, recessionPenalty: 0.02, volatility: 0.01 },
      statEffects: {},
      description: 'Safe, predictable, boring. Slightly better than a savings account.',
    },
    {
      id: 'hedge_fund',
      name: 'Hedge Fund',
      icon: '🏦',
      cost: 500_000,
      upkeep: 0,
      type: 'investment',
      minTier: 'upper_middle',
      appreciationRate: 1.0,
      returnProfile: { base: 0.12, boomBonus: 0.08, recessionPenalty: -0.20, volatility: 0.10 },
      statEffects: { happiness: 2 },
      description: 'Aggressive strategies, 2-and-20 fees. High reward, high risk.',
    },
    {
      id: 'vc_fund',
      name: 'VC Fund Stake',
      icon: '🚀',
      cost: 1_000_000,
      upkeep: 0,
      type: 'investment',
      minTier: 'wealthy',
      appreciationRate: 1.0,
      returnProfile: { base: 0.0, boomBonus: 0.50, recessionPenalty: -0.40, volatility: 0.40 },
      statEffects: { happiness: 3, smarts: 1 },
      description: 'Backing the next unicorn. Most fail; one might make you a billionaire.',
    },
    {
      id: 'private_equity',
      name: 'Private Equity Fund',
      icon: '💰',
      cost: 5_000_000,
      upkeep: 0,
      type: 'investment',
      minTier: 'rich',
      appreciationRate: 1.0,
      returnProfile: { base: 0.15, boomBonus: 0.10, recessionPenalty: -0.15, volatility: 0.08 },
      statEffects: { happiness: 4, smarts: 1 },
      description: 'Buyouts, restructuring, and compounding returns at scale.',
    },
  ],
};

/**
 * Returns all assets in the catalog as a flat array.
 */
export function getAllAssets() {
  return Object.values(ASSET_CATALOG).flat();
}

/**
 * Returns catalog items visible to the player at their current wealth tier.
 * Items at or below the player's tier are available; items above are locked.
 */
const TIER_ORDER = ['broke', 'struggling', 'working', 'middle', 'upper_middle', 'wealthy', 'rich', 'ultra'];

export function getAssetsByTier(category, playerTierId) {
  const items = ASSET_CATALOG[category] ?? [];
  const playerRank = TIER_ORDER.indexOf(playerTierId);
  return items.map(item => ({
    ...item,
    locked: TIER_ORDER.indexOf(item.minTier) > playerRank,
  }));
}

/**
 * Calculates the capital gains tax owed when selling an asset.
 * Only applies to the profit portion: (currentValue - purchasePrice).
 * Uses the capitalGainsTaxRate from the player's current wealth tier.
 */
export function calculateCapitalGainsTax(purchasePrice, currentValue, capitalGainsTaxRate) {
  const gain = currentValue - purchasePrice;
  if (gain <= 0) return 0;
  return Math.floor(gain * capitalGainsTaxRate);
}

/**
 * Calculates the annual investment return for one investment asset.
 * economyPhase: 'normal' | 'boom' | 'recession'
 */
export function estimateInvestmentReturn(asset, economyPhase) {
  if (asset.type !== 'investment' || !asset.returnProfile) return 0;
  const { base, boomBonus, recessionPenalty, volatility } = asset.returnProfile;
  let rate = base + (Math.random() * 2 - 1) * volatility;
  if (economyPhase === 'boom')       rate += boomBonus;
  if (economyPhase === 'recession')  rate += recessionPenalty;
  return Math.floor(asset.currentValue * rate);
}
