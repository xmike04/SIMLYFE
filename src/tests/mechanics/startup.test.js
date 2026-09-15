/** startup mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { applyStartupYear, STARTUP_COST, computeStartupLaunch } from '../../engine/mechanics/careers';

describe('applyStartupYear', () => {
  const founder = { id: 'founder', equity: 1000, salary: 100 };

  it('bankrupt on random < 0.2', () => {
    const { career, outcome } = applyStartupYear(founder, 0.19);
    expect(career).toBeNull();
    expect(outcome).toBe('bankrupt');
  });

  it('downturn: equity × 0.8 on random 0.2–0.49', () => {
    const { career, outcome } = applyStartupYear(founder, 0.35);
    expect(outcome).toBe('downturn');
    expect(career.equity).toBe(800);
  });

  it('steady: equity × 1.5 on random 0.5–0.79', () => {
    const { career, outcome } = applyStartupYear(founder, 0.65);
    expect(outcome).toBe('steady');
    expect(career.equity).toBe(1500);
  });

  it('moonshot: equity × 3 on random >= 0.8', () => {
    const { career, outcome } = applyStartupYear(founder, 0.9);
    expect(outcome).toBe('moonshot');
    expect(career.equity).toBe(3000);
  });

  it('salary and dividend are 10% of equity after each outcome', () => {
    const { career, dividend } = applyStartupYear(founder, 0.9); // moonshot → 3000
    expect(career.salary).toBe(300);
    expect(dividend).toBe(300);
  });

  it('returns null career on bankrupt (no zombie startup)', () => {
    const { career, dividend } = applyStartupYear(founder, 0.0);
    expect(career).toBeNull();
    expect(dividend).toBe(0);
  });

  it('non-founder career is returned unchanged', () => {
    const regularJob = { id: 'sw_eng', salary: 125000 };
    const { career } = applyStartupYear(regularJob, 0.99);
    expect(career).toEqual(regularJob);
  });
});

describe('computeStartupLaunch', () => {
  it('charges STARTUP_COST exactly once', () => {
    expect(STARTUP_COST).toBe(500);
    const launch = computeStartupLaunch(1000);
    expect(launch.ok).toBe(true);
    expect(launch.newBank).toBe(500);
    expect(launch.cost).toBe(500);
    expect(launch.career.id).toBe('founder');
  });

  it('rejects when bank is below STARTUP_COST', () => {
    expect(computeStartupLaunch(499).ok).toBe(false);
  });

  it('does not charge or reset an active founder', () => {
    const launch = computeStartupLaunch(1000, { id: 'founder', equity: 5000 });
    expect(launch).toEqual({ ok: false, reason: 'already_founder' });
  });

  it('does not attach an unused annual happiness effect to founders', () => {
    expect(computeStartupLaunch(1000).career).not.toHaveProperty('happinessEffect');
  });

  it('specialCareers catalog cost matches STARTUP_COST (no double-charge contract)', async () => {
    const { SPECIAL_CAREERS } = await import('../../config/specialCareers.js');
    const launchAction = SPECIAL_CAREERS
      .flatMap((c) => c.actions)
      .find((a) => a.specialAction === 'startStartup');
    expect(launchAction).toBeTruthy();
    expect(launchAction.cost).toBe(STARTUP_COST);
  });
});
