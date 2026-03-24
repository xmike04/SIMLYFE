/**
 * wealthTiers.js
 *
 * Defines wealth tiers based on bank balance.  As a player gets richer:
 *   - They pay more income tax on salary
 *   - They pay a lifestyle cost each year to maintain social status
 *   - Partners / friends expect larger gifts and more expensive dates
 *   - Relationship decay is faster (people expect more from wealthy folk)
 *   - Gift buttons in the UI scale up to match their wealth level
 *
 * Tier thresholds are based on total bank balance (liquid wealth).
 */

export const WEALTH_TIERS = [
  {
    id: 'broke',
    label: 'Broke',
    icon: '💸',
    minBank: -Infinity,
    incomeTaxRate: 0,          // no tax when you have nothing
    lifestyleCost: 0,          // no expectations
    giftAmounts: [5, 20, 50],  // can barely afford small gifts
    dateCost: 0,               // dates are free (park bench)
    relationDecayMult: 1.0,    // baseline decay
    happinessPenalty: 0,
    color: '#ef4444',
  },
  {
    id: 'struggling',
    label: 'Struggling',
    icon: '😰',
    minBank: 1_000,
    incomeTaxRate: 0.10,
    lifestyleCost: 0,
    giftAmounts: [10, 50, 200],
    dateCost: 20,
    relationDecayMult: 1.0,
    happinessPenalty: 0,
    color: '#f97316',
  },
  {
    id: 'working',
    label: 'Working Class',
    icon: '🔧',
    minBank: 10_000,
    incomeTaxRate: 0.15,
    lifestyleCost: 500,        // basic bills, social obligations
    giftAmounts: [50, 200, 1_000],
    dateCost: 50,
    relationDecayMult: 1.0,
    happinessPenalty: 5,
    color: '#fbbf24',
  },
  {
    id: 'middle',
    label: 'Middle Class',
    icon: '🏠',
    minBank: 50_000,
    incomeTaxRate: 0.22,
    lifestyleCost: 3_000,      // mortgage upkeep, dining out, vacations
    giftAmounts: [100, 500, 2_000],
    dateCost: 100,
    relationDecayMult: 1.1,    // slight uptick in expectations
    happinessPenalty: 8,
    color: '#34d399',
  },
  {
    id: 'upper_middle',
    label: 'Upper Middle',
    icon: '💼',
    minBank: 250_000,
    incomeTaxRate: 0.28,
    lifestyleCost: 10_000,     // club memberships, private school, travel
    giftAmounts: [500, 2_000, 10_000],
    dateCost: 300,
    relationDecayMult: 1.3,
    happinessPenalty: 12,
    color: '#60a5fa',
  },
  {
    id: 'wealthy',
    label: 'Wealthy',
    icon: '💎',
    minBank: 1_000_000,
    incomeTaxRate: 0.35,
    lifestyleCost: 40_000,     // staff, luxury car, penthouse upkeep
    giftAmounts: [1_000, 5_000, 25_000],
    dateCost: 500,
    relationDecayMult: 1.6,    // partners expect serious investment
    happinessPenalty: 15,
    color: '#a78bfa',
  },
  {
    id: 'rich',
    label: 'Rich',
    icon: '🤑',
    minBank: 10_000_000,
    incomeTaxRate: 0.40,
    lifestyleCost: 150_000,    // yacht, security detail, private flights
    giftAmounts: [5_000, 20_000, 100_000],
    dateCost: 2_000,
    relationDecayMult: 2.0,    // significant other expects extravagance
    happinessPenalty: 20,
    color: '#f59e0b',
  },
  {
    id: 'ultra',
    label: 'Ultra-Wealthy',
    icon: '👑',
    minBank: 100_000_000,
    incomeTaxRate: 0.45,
    lifestyleCost: 1_000_000,  // island maintenance, foundations, entourage
    giftAmounts: [20_000, 100_000, 500_000],
    dateCost: 10_000,
    relationDecayMult: 2.5,    // partner expectations are astronomical
    happinessPenalty: 25,
    color: '#fde047',
  },
];

/**
 * getWealthTier — returns the tier object for a given bank balance.
 */
export function getWealthTier(bank) {
  for (let i = WEALTH_TIERS.length - 1; i >= 0; i--) {
    if (bank >= WEALTH_TIERS[i].minBank) return WEALTH_TIERS[i];
  }
  return WEALTH_TIERS[0]; // broke
}

/**
 * calculateIncomeTax — returns the tax amount owed on annual salary income.
 * Uses the player's CURRENT bank balance (not post-salary) to determine bracket.
 */
export function calculateIncomeTax(salary, bank) {
  if (salary <= 0) return 0;
  const tier = getWealthTier(bank);
  return Math.floor(salary * tier.incomeTaxRate);
}
