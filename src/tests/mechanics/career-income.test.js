/** career income mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { computeCareerYearIncome, normalizeCareerEffect, applyCareerYearEffects } from '../../engine/mechanics/careers';
import { computeLifestyleCost } from '../../engine/mechanics/economy';
import { calculateIncomeTax, getWealthTier } from '../../config/wealthTiers';

// Legacy test-only helpers below are migration targets, not production exports.
function applyCareerIncome(stats, bank, career) {
  return computeCareerYearIncome(career, stats, bank, 1);
}

describe('applyCareerIncome', () => {
  const baseStats = { happiness: 80, health: 80 };

  it('adds salary to bank', () => {
    const career = { id: 'sw_eng', salary: 125000, happinessEffect: -10, healthEffect: -15 };
    const { bank } = applyCareerIncome(baseStats, 0, career);
    expect(bank).toBe(125000);
  });

  it('applies happinessEffect', () => {
    const career = { id: 'sw_eng', salary: 125000, happinessEffect: -10, healthEffect: -15 };
    const { stats } = applyCareerIncome(baseStats, 0, career);
    expect(stats.happiness).toBe(78);
  });

  it('applies healthEffect (was missing in original source)', () => {
    const career = { id: 'sw_eng', salary: 125000, happinessEffect: -10, healthEffect: -15 };
    const { stats } = applyCareerIncome(baseStats, 0, career);
    expect(stats.health).toBe(78);
  });

  it('normalizes non-zero catalog intensity to a bounded yearly delta', () => {
    expect(normalizeCareerEffect(-2)).toBe(-1);
    expect(normalizeCareerEffect(-10)).toBe(-2);
    expect(normalizeCareerEffect(-20)).toBe(-3);
    expect(normalizeCareerEffect(5)).toBe(1);
  });

  it('allows a healthy nurse to survive an uninterrupted age-22 to age-40 career', () => {
    const nurse = { id: 'nurse', happinessEffect: -5, healthEffect: -10 };
    let stats = { health: 80, happiness: 80 };
    for (let age = 23; age <= 40; age++) {
      stats = applyCareerYearEffects(stats, nurse);
      if (age > 30) stats.health = Math.max(0, stats.health - 1);
    }
    expect(stats.health).toBeGreaterThan(25);
  });

  it('clamps happiness to 0', () => {
    const career = { id: 'lawyer', salary: 200000, happinessEffect: -999, healthEffect: 0 };
    const { stats } = applyCareerIncome(baseStats, 0, career);
    expect(stats.happiness).toBe(0);
  });

  it('clamps health to 0', () => {
    const career = { id: 'ceo', salary: 350000, happinessEffect: 0, healthEffect: -999 };
    const { stats } = applyCareerIncome(baseStats, 0, career);
    expect(stats.health).toBe(0);
  });

  it('no income when no career', () => {
    const { bank } = applyCareerIncome(baseStats, 500, null);
    expect(bank).toBe(500);
  });

  it('skips founder career (handled separately)', () => {
    const founder = { id: 'founder', salary: 0, happinessEffect: -15, healthEffect: 0, equity: 1000 };
    const { bank, stats } = applyCareerIncome(baseStats, 500, founder);
    expect(bank).toBe(500); // unchanged
    expect(stats.happiness).toBe(80); // unchanged
  });
});

describe('computeCareerYearIncome', () => {
  const stats = { health: 80, happiness: 80, smarts: 50 };
  const job = { id: 'sw_eng', salary: 100000, happinessEffect: -10, healthEffect: -15 };

  it('scales gross salary by the city multiplier', () => {
    const base = computeCareerYearIncome(job, stats, 0, 1);
    const pricey = computeCareerYearIncome(job, stats, 0, 1.5);
    expect(base.grossSalary).toBe(100000);
    expect(pricey.grossSalary).toBe(150000);
  });

  it('banks salary net of income tax, not gross', () => {
    // Bank must sit in a taxed tier — the Broke tier is 0%, which would make
    // "net === gross - tax" hold even if the deduction were dropped entirely.
    const startingBank = 100_000;
    const result = computeCareerYearIncome(job, stats, startingBank, 1);
    expect(result.tax).toBe(calculateIncomeTax(100000, startingBank));
    expect(result.tax).toBeGreaterThan(0);
    expect(result.netSalary).toBe(100000 - result.tax);
    expect(result.netSalary).toBeLessThan(result.grossSalary);
    expect(result.bank).toBe(startingBank + result.netSalary);
  });

  it('the Broke tier pays no income tax', () => {
    expect(computeCareerYearIncome(job, stats, 0, 1).tax).toBe(0);
  });

  it('taxes by wealth bracket — the same salary is taxed more when already rich', () => {
    const poor = computeCareerYearIncome(job, stats, 0, 1);
    const rich = computeCareerYearIncome(job, stats, 5_000_000, 1);
    expect(rich.tax).toBeGreaterThan(poor.tax);
  });

  it('applies the career year stat effects', () => {
    const { stats: next } = computeCareerYearIncome(job, stats, 0, 1);
    expect(next.happiness).toBe(78); // applyCareerYearEffects scales the raw effect
    expect(next.health).toBeLessThan(stats.health);
  });

  it('adds smarts_gain on top, clamped to 100', () => {
    const teacher = { id: 'prof', salary: 1000, smarts_gain: 5 };
    expect(computeCareerYearIncome(teacher, stats, 0, 1).stats.smarts).toBe(55);
    const genius = { ...stats, smarts: 98 };
    expect(computeCareerYearIncome(teacher, genius, 0, 1).stats.smarts).toBe(100);
  });

  it('is a no-op for no career or a founder (handled by applyStartupYear)', () => {
    for (const career of [null, undefined, { id: 'founder', salary: 999, equity: 10 }]) {
      const result = computeCareerYearIncome(career, stats, 500, 1);
      expect(result.bank).toBe(500);
      expect(result.stats).toBe(stats);
      expect(result.netSalary).toBe(0);
    }
  });

  it('falls back to a 1x multiplier on a non-finite city value', () => {
    expect(computeCareerYearIncome(job, stats, 0, undefined).grossSalary).toBe(100000);
    expect(computeCareerYearIncome(job, stats, 0, NaN).grossSalary).toBe(100000);
  });

  it('does not mutate the caller stats', () => {
    const original = { ...stats };
    computeCareerYearIncome(job, stats, 0, 1);
    expect(stats).toEqual(original);
  });
});

describe('computeLifestyleCost', () => {
  const stats = { happiness: 60 };

  it('charges nothing at tiers with no lifestyle expectation', () => {
    const result = computeLifestyleCost(0, stats, 1);
    expect(result.cost).toBe(0);
    expect(result.bank).toBe(0);
    expect(result.stats).toBe(stats);
    expect(result.inDebt).toBe(false);
  });

  it('charges the wealth tier cost scaled by cost of living', () => {
    const cheap = computeLifestyleCost(100_000, stats, 1);
    const pricey = computeLifestyleCost(100_000, stats, 2);
    expect(cheap.cost).toBeGreaterThan(0);
    expect(pricey.cost).toBe(cheap.cost * 2);
    expect(pricey.bank).toBe(100_000 - pricey.cost);
  });

  it('applies the tier happiness penalty only when the charge pushes you into debt', () => {
    const solvent = computeLifestyleCost(100_000, stats, 1);
    expect(solvent.inDebt).toBe(false);
    expect(solvent.stats.happiness).toBe(60);

    // Wealthy tier expectations with a bank that cannot cover them
    const tier = getWealthTier(1_500_000);
    const broke = computeLifestyleCost(1_500_000, stats, 1000);
    expect(broke.inDebt).toBe(true);
    expect(broke.bank).toBeLessThan(0);
    expect(broke.stats.happiness).toBe(Math.max(0, 60 - tier.happinessPenalty));
  });

  it('never drives happiness below zero', () => {
    const sad = computeLifestyleCost(1_500_000, { happiness: 1 }, 1000);
    expect(sad.stats.happiness).toBe(0);
  });
});

describe('City salary multiplier', () => {
  function calculateAdjustedSalary(baseSalary, cityMultiplier) {
    return computeCareerYearIncome({ id: 'engineer', salary: baseSalary }, { health: 80, happiness: 80 }, 0, cityMultiplier).grossSalary;
  }

  function calculateAdjustedLifestyleCost(colMultiplier) {
    // The upper-middle fixture has a $10,000 annual lifestyle expectation.
    return computeLifestyleCost(300_000, { happiness: 80 }, colMultiplier).cost;
  }

  it('applies 1.3x NYC multiplier to salary', () => {
    expect(calculateAdjustedSalary(50000, 1.3)).toBe(65000);
  });

  it('applies 0.5x Lagos multiplier to salary', () => {
    expect(calculateAdjustedSalary(50000, 0.5)).toBe(25000);
  });

  it('defaults to 1.0 multiplier when no city', () => {
    expect(calculateAdjustedSalary(50000, null)).toBe(50000);
    expect(calculateAdjustedSalary(50000, undefined)).toBe(50000);
  });

  it('applies COL multiplier to lifestyle cost', () => {
    expect(calculateAdjustedLifestyleCost(1.4)).toBe(14000);
  });

  it('COL defaults to 1.0 when no city', () => {
    expect(calculateAdjustedLifestyleCost(null)).toBe(10000);
  });

  it('higher COL city increases lifestyle cost', () => {
    const base = 10000;
    const sfResult = calculateAdjustedLifestyleCost(1.5);
    const lagosResult = calculateAdjustedLifestyleCost(0.3);
    expect(sfResult).toBeGreaterThan(base);
    expect(lagosResult).toBeLessThan(base);
  });
});
