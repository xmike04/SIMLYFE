/** asset catalog mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { ASSET_CATALOG, getAllAssets, getAssetsByTier, calculateCapitalGainsTax, estimateInvestmentReturn } from '../../config/assetCatalog';

describe('ASSET_CATALOG schema', () => {
  it('has all four required categories', () => {
    expect(ASSET_CATALOG).toHaveProperty('realEstate');
    expect(ASSET_CATALOG).toHaveProperty('vehicles');
    expect(ASSET_CATALOG).toHaveProperty('luxury');
    expect(ASSET_CATALOG).toHaveProperty('investments');
  });

  it('every item has required fields', () => {
    for (const item of getAllAssets()) {
      expect(item, `${item.id} missing id`).toHaveProperty('id');
      expect(item, `${item.id} missing name`).toHaveProperty('name');
      expect(item, `${item.id} missing cost`).toHaveProperty('cost');
      expect(item, `${item.id} missing upkeep`).toHaveProperty('upkeep');
      expect(item, `${item.id} missing type`).toHaveProperty('type');
      expect(item, `${item.id} missing minTier`).toHaveProperty('minTier');
      expect(item, `${item.id} missing appreciationRate`).toHaveProperty('appreciationRate');
    }
  });

  it('all costs are positive numbers', () => {
    for (const item of getAllAssets()) {
      expect(item.cost, `${item.id} cost must be > 0`).toBeGreaterThan(0);
    }
  });

  it('all upkeep values are non-negative', () => {
    for (const item of getAllAssets()) {
      expect(item.upkeep, `${item.id} upkeep must be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });

  it('no duplicate IDs across all categories', () => {
    const ids = getAllAssets().map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('investment items have returnProfile', () => {
    for (const item of ASSET_CATALOG.investments) {
      expect(item, `${item.id} missing returnProfile`).toHaveProperty('returnProfile');
      expect(item.returnProfile).toHaveProperty('base');
      expect(item.returnProfile).toHaveProperty('boomBonus');
      expect(item.returnProfile).toHaveProperty('recessionPenalty');
      expect(item.returnProfile).toHaveProperty('volatility');
    }
  });

  it('statEffects values are numbers when present', () => {
    for (const item of getAllAssets()) {
      if (item.statEffects) {
        for (const [key, val] of Object.entries(item.statEffects)) {
          expect(typeof val, `${item.id} statEffects.${key} must be a number`).toBe('number');
        }
      }
    }
  });
});

describe('getAssetsByTier', () => {
  it('returns all items in a category', () => {
    const result = getAssetsByTier('realEstate', 'ultra');
    expect(result.length).toBe(ASSET_CATALOG.realEstate.length);
  });

  it('items below player tier have locked: false', () => {
    const result = getAssetsByTier('realEstate', 'ultra');
    expect(result.every(i => !i.locked)).toBe(true);
  });

  it('broke player cannot access penthouse or above', () => {
    const result = getAssetsByTier('realEstate', 'broke');
    const penthouse = result.find(i => i.id === 'penthouse');
    expect(penthouse.locked).toBe(true);
  });

  it('working tier unlocks studio_apt and city_condo', () => {
    const result = getAssetsByTier('realEstate', 'working');
    expect(result.find(i => i.id === 'studio_apt').locked).toBe(false);
    expect(result.find(i => i.id === 'city_condo').locked).toBe(false);
  });

  it('working tier cannot access wealthy-tier penthouse', () => {
    const result = getAssetsByTier('realEstate', 'working');
    expect(result.find(i => i.id === 'penthouse').locked).toBe(true);
  });

  it('ultra tier unlocks all luxury items', () => {
    const result = getAssetsByTier('luxury', 'ultra');
    expect(result.every(i => !i.locked)).toBe(true);
  });

  it('returns empty array for unknown category', () => {
    expect(getAssetsByTier('nonexistent', 'middle')).toEqual([]);
  });
});

describe('calculateCapitalGainsTax', () => {
  it('no tax when no gain', () => {
    expect(calculateCapitalGainsTax(100000, 100000, 0.20)).toBe(0);
  });

  it('no tax on a loss', () => {
    expect(calculateCapitalGainsTax(100000, 80000, 0.20)).toBe(0);
  });

  it('20% CGT on a $50k gain', () => {
    expect(calculateCapitalGainsTax(100000, 150000, 0.20)).toBe(10000);
  });

  it('37% CGT for ultra-wealthy on large gain', () => {
    expect(calculateCapitalGainsTax(1_000_000, 5_000_000, 0.37)).toBe(1_480_000);
  });

  it('result is a floored integer', () => {
    const result = calculateCapitalGainsTax(100000, 133333, 0.20); // gain = 33333, tax = 6666.6
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBe(6666);
  });

  it('0% CGT rate produces no tax regardless of gain', () => {
    expect(calculateCapitalGainsTax(0, 500000, 0)).toBe(0);
  });
});

describe('estimateInvestmentReturn', () => {
  const makeInvestment = (profileOverrides = {}) => ({
    type: 'investment',
    currentValue: 100_000,
    returnProfile: { base: 0.10, boomBonus: 0.05, recessionPenalty: -0.10, volatility: 0, ...profileOverrides },
  });

  it('returns 0 for non-investment assets', () => {
    expect(estimateInvestmentReturn({ type: 'property', currentValue: 100000 }, 'normal')).toBe(0);
  });

  it('returns 0 for asset with no returnProfile', () => {
    expect(estimateInvestmentReturn({ type: 'investment', currentValue: 100000 }, 'normal')).toBe(0);
  });

  it('normal economy: returns base rate (no volatility)', () => {
    const ret = estimateInvestmentReturn(makeInvestment(), 'normal');
    expect(ret).toBe(10000); // 10% of 100k
  });

  it('boom economy: adds boomBonus', () => {
    const ret = estimateInvestmentReturn(makeInvestment(), 'boom');
    expect(ret).toBe(15000); // (10% + 5%) of 100k
  });

  it('recession economy: applies recessionPenalty', () => {
    const ret = estimateInvestmentReturn(makeInvestment(), 'recession');
    expect(ret).toBe(0); // (10% - 10%) of 100k = 0
  });

  it('severe recession: can return negative (loss)', () => {
    const ret = estimateInvestmentReturn(makeInvestment({ base: 0.05, recessionPenalty: -0.20 }), 'recession');
    expect(ret).toBeLessThan(0);           // (5% - 20%) = net −15%
    expect(ret).toBeGreaterThanOrEqual(-15100); // ~−15% of 100k, floored
  });

  it('return scales with asset value', () => {
    const small = estimateInvestmentReturn(makeInvestment(), 'normal'); // 100k base → 10k
    const large = estimateInvestmentReturn({ ...makeInvestment(), currentValue: 1_000_000 }, 'normal');
    expect(large).toBe(small * 10);
  });
});
