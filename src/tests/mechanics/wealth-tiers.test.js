/** wealth tiers mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { getWealthTier, WEALTH_TIERS, calculateIncomeTax } from '../../config/wealthTiers';

describe('getWealthTier', () => {
  it('returns broke tier for negative balance', () => {
    expect(getWealthTier(-5000).id).toBe('broke');
  });

  it('returns broke tier for $0', () => {
    expect(getWealthTier(0).id).toBe('broke');
  });

  it('returns broke tier for $999', () => {
    expect(getWealthTier(999).id).toBe('broke');
  });

  it('returns struggling at $1,000', () => {
    expect(getWealthTier(1000).id).toBe('struggling');
  });

  it('returns working class at $10,000', () => {
    expect(getWealthTier(10000).id).toBe('working');
  });

  it('returns middle class at $50,000', () => {
    expect(getWealthTier(50000).id).toBe('middle');
  });

  it('returns upper middle at $250,000', () => {
    expect(getWealthTier(250000).id).toBe('upper_middle');
  });

  it('returns wealthy at $1,000,000', () => {
    expect(getWealthTier(1_000_000).id).toBe('wealthy');
  });

  it('returns rich at $10,000,000', () => {
    expect(getWealthTier(10_000_000).id).toBe('rich');
  });

  it('returns ultra-wealthy at $100,000,000', () => {
    expect(getWealthTier(100_000_000).id).toBe('ultra');
  });

  it('tiers are strictly ordered by minBank', () => {
    const finite = WEALTH_TIERS.filter(t => isFinite(t.minBank));
    for (let i = 1; i < finite.length; i++) {
      expect(finite[i].minBank).toBeGreaterThan(finite[i - 1].minBank);
    }
  });
});

describe('calculateIncomeTax', () => {
  it('no tax when salary is 0', () => {
    expect(calculateIncomeTax(0, 50000)).toBe(0);
  });

  it('no tax for broke player (0% rate)', () => {
    expect(calculateIncomeTax(30000, 500)).toBe(0);
  });

  it('10% tax for struggling player', () => {
    // bank=5000 → struggling (10% rate)
    expect(calculateIncomeTax(20000, 5000)).toBe(2000);
  });

  it('15% tax for working class player', () => {
    // bank=30000 → working (15% rate)
    expect(calculateIncomeTax(40000, 30000)).toBe(6000);
  });

  it('22% tax for middle class player', () => {
    expect(calculateIncomeTax(80000, 100000)).toBe(17600);
  });

  it('35% tax for wealthy player', () => {
    expect(calculateIncomeTax(500000, 2_000_000)).toBe(175000);
  });

  it('result is always a floored integer', () => {
    const tax = calculateIncomeTax(33333, 30000); // 15% of 33333 = 4999.95
    expect(Number.isInteger(tax)).toBe(true);
    expect(tax).toBe(4999);
  });
});

describe('wealth tier schema', () => {
  it('every tier has required fields', () => {
    for (const tier of WEALTH_TIERS) {
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('label');
      expect(tier).toHaveProperty('icon');
      expect(tier).toHaveProperty('incomeTaxRate');
      expect(tier).toHaveProperty('lifestyleCost');
      expect(tier).toHaveProperty('giftAmounts');
      expect(tier).toHaveProperty('dateCost');
      expect(tier).toHaveProperty('relationDecayMult');
      expect(tier).toHaveProperty('happinessPenalty');
    }
  });

  it('incomeTaxRate is between 0 and 1', () => {
    for (const tier of WEALTH_TIERS) {
      expect(tier.incomeTaxRate).toBeGreaterThanOrEqual(0);
      expect(tier.incomeTaxRate).toBeLessThanOrEqual(1);
    }
  });

  it('giftAmounts is an array of 3 ascending positive numbers', () => {
    for (const tier of WEALTH_TIERS) {
      expect(Array.isArray(tier.giftAmounts)).toBe(true);
      expect(tier.giftAmounts.length).toBe(3);
      expect(tier.giftAmounts[0]).toBeGreaterThan(0);
      expect(tier.giftAmounts[1]).toBeGreaterThan(tier.giftAmounts[0]);
      expect(tier.giftAmounts[2]).toBeGreaterThan(tier.giftAmounts[1]);
    }
  });

  it('relationDecayMult is >= 1.0 for all tiers', () => {
    for (const tier of WEALTH_TIERS) {
      expect(tier.relationDecayMult).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('lifestyleCost and happinessPenalty are non-negative', () => {
    for (const tier of WEALTH_TIERS) {
      expect(tier.lifestyleCost).toBeGreaterThanOrEqual(0);
      expect(tier.happinessPenalty).toBeGreaterThanOrEqual(0);
    }
  });

  it('higher tiers have higher or equal tax rates', () => {
    for (let i = 1; i < WEALTH_TIERS.length; i++) {
      expect(WEALTH_TIERS[i].incomeTaxRate).toBeGreaterThanOrEqual(WEALTH_TIERS[i - 1].incomeTaxRate);
    }
  });

  it('higher tiers have higher or equal lifestyle costs', () => {
    for (let i = 1; i < WEALTH_TIERS.length; i++) {
      expect(WEALTH_TIERS[i].lifestyleCost).toBeGreaterThanOrEqual(WEALTH_TIERS[i - 1].lifestyleCost);
    }
  });

  it('higher tiers have higher or equal relation decay multipliers', () => {
    for (let i = 1; i < WEALTH_TIERS.length; i++) {
      expect(WEALTH_TIERS[i].relationDecayMult).toBeGreaterThanOrEqual(WEALTH_TIERS[i - 1].relationDecayMult);
    }
  });
});

describe('wealth tier integration', () => {
  it('ultra-wealthy player pays 45% tax on salary', () => {
    const tax = calculateIncomeTax(1_000_000, 200_000_000);
    expect(tax).toBe(450_000);
  });

  it('broke player takes home full salary', () => {
    const salary = 25000;
    const tax = calculateIncomeTax(salary, 0);
    expect(tax).toBe(0);
    expect(salary - tax).toBe(salary);
  });

  it('middle class player keeps 78% of salary', () => {
    const salary = 100_000;
    const tax = calculateIncomeTax(salary, 100_000); // middle class = 22%
    expect(salary - tax).toBe(78_000);
  });

  it('wealthy tier has gift amounts scaled for luxury spending', () => {
    const tier = getWealthTier(5_000_000);
    expect(tier.giftAmounts[2]).toBeGreaterThanOrEqual(10_000);
  });

  it('broke tier has affordable gift amounts', () => {
    const tier = getWealthTier(0);
    expect(tier.giftAmounts[0]).toBeLessThanOrEqual(20);
  });
});
