/** property market mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { applyPropertyMarketTick } from '../../engine/mechanics/investments';

// Legacy test-only helpers below are migration targets, not production exports.
function applyPropertyMarket(properties, crashRandom, boomRandom, yearlyRandom) {
  const marketCrash = crashRandom < 0.05;
  return applyPropertyMarketTick(properties, {}, {
    marketCrash,
    marketBoom: !marketCrash && boomRandom < 0.10,
    // the hook's default appreciation is 1 + (random * 0.03 + 0.02); solve for
    // the roll that yields the caller's requested yearly rate
    randomFn: () => (yearlyRandom - 0.02) / 0.03,
  }).properties;
}

describe('applyPropertyMarket', () => {
  const props = [
    { id: 'p1', name: 'Condo', currentValue: 100000, yearsOwned: 2, upkeep: 500 },
    { id: 'p2', name: 'House', currentValue: 200000, yearsOwned: 5, upkeep: 1000 },
  ];

  it('applies market crash (random < 0.05) → ×0.7', () => {
    const result = applyPropertyMarket(props, 0.04, 0, 0);
    expect(result[0].currentValue).toBe(70000);
    expect(result[1].currentValue).toBe(140000);
  });

  it('applies market boom → ×1.3', () => {
    // crashRandom >= 0.05, boomRandom < 0.10
    const result = applyPropertyMarket(props, 0.1, 0.05, 0);
    expect(result[0].currentValue).toBe(130000);
  });

  it('applies normal appreciation when neither crash nor boom', () => {
    const result = applyPropertyMarket(props, 0.1, 0.2, 0.03); // 3% appreciation
    expect(result[0].currentValue).toBe(103000);
  });

  it('increments yearsOwned by 1 every call', () => {
    const result = applyPropertyMarket(props, 0.5, 0.5, 0.02);
    expect(result[0].yearsOwned).toBe(3);
    expect(result[1].yearsOwned).toBe(6);
  });

  it('crash takes priority over boom', () => {
    // crashRandom < 0.05 AND boomRandom < 0.10 → crash wins
    const result = applyPropertyMarket(props, 0.01, 0.01, 0);
    expect(result[0].currentValue).toBe(70000);
  });

  it('handles empty properties array', () => {
    const result = applyPropertyMarket([], 0.01, 0.01, 0);
    expect(result).toEqual([]);
  });
});

describe('applyPropertyMarketTick', () => {
  const stats = { health: 50, happiness: 50 };
  const house = { id: 'p1', catalogId: 'condo', type: 'property', currentValue: 100_000, yearsOwned: 1, upkeep: 500 };

  it('marks investment holdings to market and reports the return as income', () => {
    const holding = { id: 'i1', type: 'investment', currentValue: 10_000, yearsOwned: 0, returnProfile: { base: 0.1, volatility: 0 } };
    const tick = applyPropertyMarketTick([holding], stats, { phase: 'normal' });
    expect(tick.investmentIncome).not.toBe(0);
    expect(tick.properties[0].currentValue).toBe(Math.max(0, 10_000 + tick.investmentIncome));
  });

  it('crash beats boom, and both beat catalog appreciation', () => {
    const crash = applyPropertyMarketTick([house], stats, { marketCrash: true, marketBoom: true });
    expect(crash.properties[0].currentValue).toBe(70_000);
    const boom = applyPropertyMarketTick([house], stats, { marketBoom: true });
    expect(boom.properties[0].currentValue).toBe(130_000);
  });

  it('prefers the catalog appreciation rate over the random default', () => {
    const catalogMap = { condo: { appreciationRate: 1.10 } };
    const tick = applyPropertyMarketTick([house], stats, { catalogMap, randomFn: () => 1 });
    expect(tick.properties[0].currentValue).toBe(110_000);
  });

  it('falls back to a +2–5% random band with no catalog entry', () => {
    const low = applyPropertyMarketTick([house], stats, { randomFn: () => 0 });
    const high = applyPropertyMarketTick([house], stats, { randomFn: () => 1 });
    expect(low.properties[0].currentValue).toBe(102_000);
    expect(high.properties[0].currentValue).toBe(105_000);
  });

  it('accumulates upkeep across properties and tolerates a missing upkeep field', () => {
    const noUpkeep = { ...house, id: 'p2', upkeep: undefined };
    const tick = applyPropertyMarketTick([house, noUpkeep], stats, { marketBoom: true });
    expect(tick.totalUpkeep).toBe(500);
  });

  it('applies catalog passive stat effects, clamped, without mutating input stats', () => {
    const catalogMap = { condo: { appreciationRate: 1, statEffects: { happiness: 5, health: -100 } } };
    const tick = applyPropertyMarketTick([house], stats, { catalogMap });
    expect(tick.stats.happiness).toBe(55);
    expect(tick.stats.health).toBe(0);
    expect(stats).toEqual({ health: 50, happiness: 50 });
  });

  it('ignores passive effects for stats the player does not have', () => {
    const catalogMap = { condo: { appreciationRate: 1, statEffects: { notAStat: 10 } } };
    const tick = applyPropertyMarketTick([house], stats, { catalogMap });
    expect(tick.stats.notAStat).toBeUndefined();
  });

  it('increments yearsOwned, floors value at zero, and handles empty/missing lists', () => {
    const tick = applyPropertyMarketTick([house], stats, { marketCrash: true });
    expect(tick.properties[0].yearsOwned).toBe(2);
    expect(tick.properties[0].currentValue).toBeGreaterThanOrEqual(0);

    for (const empty of [[], null, undefined]) {
      const result = applyPropertyMarketTick(empty, stats, {});
      expect(result.properties).toEqual([]);
      expect(result.totalUpkeep).toBe(0);
      expect(result.investmentIncome).toBe(0);
    }
  });
});
