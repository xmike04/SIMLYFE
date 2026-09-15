/** career review mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';

import { processEconomyCycle } from '../../engine/mechanics/economy';
import { runPerformanceReview as reviewCareer } from '../../engine/mechanics/careers';

// Adapt the historical result name; decisions come from the production helper.
function runPerformanceReview(...args) {
  const review = reviewCareer(...args);
  return { ...review, newSalary: review.newCareer?.salary ?? 0 };
}

describe('processEconomyCycle', () => {
  it('stays normal for first 2 years', () => {
    let c = { year: 0, phase: 'normal', yearsInPhase: 0 };
    c = processEconomyCycle(c);
    expect(c.phase).toBe('normal');
    c = processEconomyCycle(c);
    expect(c.phase).toBe('normal');
  });

  it('normal transitions to boom at year 3', () => {
    let c = { year: 0, phase: 'normal', yearsInPhase: 2 };
    c = processEconomyCycle(c);
    expect(c.phase).toBe('boom');
    expect(c.yearsInPhase).toBe(0);
  });

  it('boom transitions to recession after 2 years', () => {
    let c = { year: 3, phase: 'boom', yearsInPhase: 1 };
    c = processEconomyCycle(c);
    expect(c.phase).toBe('recession');
  });

  it('recession transitions to normal after 2 years', () => {
    let c = { year: 5, phase: 'recession', yearsInPhase: 1 };
    c = processEconomyCycle(c);
    expect(c.phase).toBe('normal');
  });

  it('year counter increments every call', () => {
    const c1 = processEconomyCycle({ year: 10, phase: 'normal', yearsInPhase: 0 });
    expect(c1.year).toBe(11);
  });

  it('full 7-year cycle: normal→boom→recession→normal', () => {
    let c = { year: 0, phase: 'normal', yearsInPhase: 0 };
    const phases = [];
    for (let i = 0; i < 10; i++) {
      c = processEconomyCycle(c);
      phases.push(c.phase);
    }
    // Should see: normal, normal, boom, boom, recession, recession, normal, normal, normal, boom
    expect(phases[0]).toBe('normal');
    expect(phases[2]).toBe('boom');
    expect(phases[4]).toBe('recession');
    expect(phases[6]).toBe('normal');
  });
});

describe('runPerformanceReview', () => {
  const goodStats  = { smarts: 80, health: 80, karma: 80 };
  const avgStats   = { smarts: 50, health: 50, karma: 50 };
  const badStats   = { smarts: 20, health: 20, karma: 20 };
  const normalEcon = { phase: 'normal', year: 5, yearsInPhase: 1 };
  const baseMeta   = { yearsInRole: 3, isOnPIP: false, financialStressFlag: false };

  const apexCareer = {
    id: 'principal_engineer', salary: 240000, nextTierId: null,
    promotionRequirements: {}
  };
  const midCareer = {
    id: 'sw_eng', salary: 125000, nextTierId: 'senior_dev',
    promotionRequirements: { minYearsInRole: 2, minSmarts: 65 }
  };

  it('fired outcome when roll is very low (< 0.10)', () => {
    const { outcome } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.05);
    expect(outcome).toBe('fired');
  });

  it('pip outcome when roll is 0.10–0.24', () => {
    const { outcome } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.15);
    expect(outcome).toBe('pip');
  });

  it('no_change outcome when roll is 0.25–0.54', () => {
    const { outcome } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.40);
    expect(outcome).toBe('no_change');
  });

  it('raise outcome applies 5% salary increase', () => {
    const { newSalary } = runPerformanceReview(goodStats, midCareer, baseMeta, 50, normalEcon, 0.70);
    expect(newSalary).toBe(Math.round(125000 * 1.05));
  });

  it('promoted at apex career falls back to raise', () => {
    const { outcome } = runPerformanceReview(goodStats, apexCareer, baseMeta, 50, normalEcon, 0.90);
    expect(outcome).toBe('raise');
  });

  it('promoted when stat requirements not met falls back to raise', () => {
    const lowStatsMeta = { ...baseMeta, yearsInRole: 3 };
    const { outcome } = runPerformanceReview(badStats, midCareer, lowStatsMeta, 30, normalEcon, 0.90);
    expect(outcome).toBe('raise');
  });

  it('promoted when requirements met — returns nextTierId in career', () => {
    const { outcome, newCareer } = runPerformanceReview(goodStats, midCareer, { ...baseMeta, yearsInRole: 3 }, 50, normalEcon, 0.90);
    expect(outcome).toBe('promoted');
    expect(newCareer.nextTierId).toBe('senior_dev');
  });

  it('isOnPIP = true sets setIsOnPIP flag on PIP outcome', () => {
    const { setIsOnPIP } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.15);
    expect(setIsOnPIP).toBe(true);
  });

  it('fired outcome returns null newCareer', () => {
    const { newCareer } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.05);
    expect(newCareer).toBeNull();
  });

  it('fired sets unemploymentYears to 2', () => {
    const { unemploymentYears } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.05);
    expect(unemploymentYears).toBe(2);
  });

  it('happiness -30 on fired outcome', () => {
    const { statEffects } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.05);
    expect(statEffects.happiness).toBe(-30);
  });

  it('happiness -10 on PIP outcome', () => {
    const { statEffects } = runPerformanceReview(avgStats, midCareer, baseMeta, 30, normalEcon, 0.15);
    expect(statEffects.happiness).toBe(-10);
  });

  it('historyText is a non-empty string for each outcome', () => {
    const rolls = [0.05, 0.15, 0.40, 0.70, 0.90];
    for (const r of rolls) {
      const { historyText } = runPerformanceReview(goodStats, midCareer, { ...baseMeta, yearsInRole: 5 }, 50, normalEcon, r);
      expect(typeof historyText).toBe('string');
      expect(historyText.length).toBeGreaterThan(0);
    }
  });
});
