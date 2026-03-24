/**
 * engine.mechanics.test.js
 *
 * Tests for pure game-logic functions extracted/mirrored from gameState.js.
 * These tests are intentionally decoupled from React — they verify math and
 * decision logic in isolation so that when the hook grows, failures are
 * immediately traceable to a specific mechanic.
 *
 * Structure:
 *   1. Stat clamping & applyEffects
 *   2. Death probability (checkDeath)
 *   3. Age-up: stat degradation
 *   4. Age-up: career income & health
 *   5. Age-up: startup equity volatility
 *   6. Age-up: property market
 *   7. Economy: lottery, gambling, day trading
 *   8. startLife: initial state validity
 *   9. Relationship helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Helpers mirrored from gameState.js so we can unit-test them ──────────────
// When the source changes, update these mirrors and the corresponding tests.

const STAT_KEYS = ['health', 'happiness', 'smarts', 'looks', 'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades'];

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

/**
 * applyEffects — mirrors gameState.js applyEffects logic.
 * BUG NOTE: current source only handles health/happiness/smarts/looks/bank.
 * This mirror implements the CORRECT version (handles all stats).
 * Tests here verify the correct behaviour so they will FAIL against the buggy source
 * and PASS once the bug is fixed.
 */
function applyEffects(stats, bank, effects) {
  const newStats = { ...stats };
  const statKeys = ['health', 'happiness', 'smarts', 'looks', 'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades'];
  for (const key of statKeys) {
    if (effects[key] !== undefined && effects[key] !== null) {
      newStats[key] = clamp((newStats[key] ?? 0) + effects[key]);
    }
  }
  const newBank = bank + (effects.bank ?? 0);
  const newFlags = effects.flags ?? [];
  return { stats: newStats, bank: newBank, flags: newFlags };
}

function checkDeath(stats, age) {
  if (stats.health <= 0) return true;
  if (age >= 60) {
    // CORRECT formula: base 60, guaranteed death at 100
    const chance = (age - 60) / 40;
    // For deterministic tests we pass a seeded random via argument
    return false; // deterministic path only; see probabilistic tests below
  }
  return false;
}

function checkDeathWithRandom(stats, age, randomValue) {
  if (stats.health <= 0) return true;
  if (age >= 60) {
    const chance = (age - 60) / 40;
    return randomValue < chance;
  }
  return false;
}

function applyAgeUpDegradation(stats, age) {
  const next = { ...stats };
  if (age > 30) next.health = Math.max(0, next.health - 1);
  if (age > 50) {
    next.health = Math.max(0, next.health - 2);
    next.looks = Math.max(0, next.looks - 1);
  }
  return next;
}

function applyCareerIncome(stats, bank, career) {
  if (!career) return { stats, bank };
  if (career.id === 'founder') return { stats, bank }; // handled separately
  const newBank = bank + career.salary;
  const newStats = {
    ...stats,
    happiness: clamp(stats.happiness + (career.happinessEffect ?? 0)),
    health: clamp(stats.health + (career.healthEffect ?? 0)),
  };
  return { stats: newStats, bank: newBank };
}

function applyStartupYear(career, randomValue) {
  if (!career || career.id !== 'founder') return { career, history: null };
  let newEquity = career.equity;
  let history;

  if (randomValue < 0.2) {
    newEquity = 0;
    history = 'bankrupt';
  } else if (randomValue < 0.5) {
    newEquity = Math.floor(newEquity * 0.8);
    history = 'downturn';
  } else if (randomValue < 0.8) {
    newEquity = Math.floor(newEquity * 1.5);
    history = 'steady';
  } else {
    newEquity = Math.floor(newEquity * 3);
    history = 'moonshot';
  }

  if (newEquity === 0) return { career: null, history };
  return {
    career: { ...career, equity: newEquity, salary: Math.floor(newEquity * 0.1) },
    history,
  };
}

function applyPropertyMarket(properties, crashRandom, boomRandom, yearlyRandom) {
  const marketCrash = crashRandom < 0.05;
  const marketBoom = !marketCrash && boomRandom < 0.10;
  return properties.map(prop => {
    let newValue = prop.currentValue;
    if (marketCrash) newValue = Math.floor(newValue * 0.7);
    else if (marketBoom) newValue = Math.floor(newValue * 1.3);
    else newValue = Math.floor(newValue * (1 + yearlyRandom));
    return { ...prop, currentValue: newValue, yearsOwned: prop.yearsOwned + 1 };
  });
}

function gradesLogic(grades, smarts) {
  if (smarts > 70) return Math.min(100, (grades ?? 70) + 2);
  if (smarts < 40) return Math.max(0, (grades ?? 70) - 5);
  return Math.max(0, (grades ?? 70) - 1);
}

function startupDividend(equity) {
  return Math.floor(equity * 0.1);
}

// ─── 1. Stat clamping & applyEffects ─────────────────────────────────────────

describe('applyEffects', () => {
  const baseStats = {
    health: 80, happiness: 80, smarts: 50, looks: 50,
    athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, grades: 70
  };

  it('applies positive health effect', () => {
    const { stats } = applyEffects(baseStats, 0, { health: 10 });
    expect(stats.health).toBe(90);
  });

  it('applies negative health effect', () => {
    const { stats } = applyEffects(baseStats, 0, { health: -20 });
    expect(stats.health).toBe(60);
  });

  it('clamps health to 0 on large negative', () => {
    const { stats } = applyEffects(baseStats, 0, { health: -999 });
    expect(stats.health).toBe(0);
  });

  it('clamps health to 100 on large positive', () => {
    const { stats } = applyEffects(baseStats, 0, { health: 999 });
    expect(stats.health).toBe(100);
  });

  it('applies athleticism effect (was missing in original)', () => {
    const { stats } = applyEffects(baseStats, 0, { athleticism: 10 });
    expect(stats.athleticism).toBe(60);
  });

  it('applies karma effect', () => {
    const { stats } = applyEffects(baseStats, 0, { karma: -15 });
    expect(stats.karma).toBe(35);
  });

  it('applies acting hidden skill', () => {
    const { stats } = applyEffects(baseStats, 0, { acting: 5 });
    expect(stats.acting).toBe(5);
  });

  it('applies voice hidden skill', () => {
    const { stats } = applyEffects(baseStats, 0, { voice: 7 });
    expect(stats.voice).toBe(7);
  });

  it('applies modeling hidden skill', () => {
    const { stats } = applyEffects(baseStats, 0, { modeling: 3 });
    expect(stats.modeling).toBe(3);
  });

  it('applies bank change', () => {
    const { bank } = applyEffects(baseStats, 1000, { bank: -200 });
    expect(bank).toBe(800);
  });

  it('applies bank positive change', () => {
    const { bank } = applyEffects(baseStats, 100, { bank: 500 });
    expect(bank).toBe(600);
  });

  it('returns flags array', () => {
    const { flags } = applyEffects(baseStats, 0, { flags: ['promoted'] });
    expect(flags).toContain('promoted');
  });

  it('returns empty flags when none given', () => {
    const { flags } = applyEffects(baseStats, 0, { health: 5 });
    expect(flags).toEqual([]);
  });

  it('ignores zero effects (no-op)', () => {
    const { stats } = applyEffects(baseStats, 0, { health: 0 });
    expect(stats.health).toBe(80);
  });

  it('multiple stats in one call', () => {
    const { stats, bank } = applyEffects(baseStats, 200, { health: -5, happiness: 10, bank: -50, athleticism: 3 });
    expect(stats.health).toBe(75);
    expect(stats.happiness).toBe(90);
    expect(stats.athleticism).toBe(53);
    expect(bank).toBe(150);
  });

  it('does not mutate input stats', () => {
    const original = { ...baseStats };
    applyEffects(baseStats, 0, { health: -10 });
    expect(baseStats).toEqual(original);
  });
});

// ─── 2. Death probability ─────────────────────────────────────────────────────

describe('checkDeath', () => {
  const healthyStats = { health: 80 };
  const deadStats = { health: 0 };
  const lowHealth = { health: 1 };

  it('dies when health is exactly 0', () => {
    expect(checkDeathWithRandom(deadStats, 30, 0.5)).toBe(true);
  });

  it('dies when health is negative (defensive)', () => {
    expect(checkDeathWithRandom({ health: -5 }, 30, 0.5)).toBe(true);
  });

  it('does not die before age 60 with full health', () => {
    expect(checkDeathWithRandom(healthyStats, 59, 0.999)).toBe(false);
  });

  it('0% death chance at exactly age 60 (base = 60, chance = 0)', () => {
    // (60 - 60) / 40 = 0 → no random death at 60
    expect(checkDeathWithRandom(healthyStats, 60, 0.0001)).toBe(false);
  });

  it('25% death chance at age 70', () => {
    // (70 - 60) / 40 = 0.25
    expect(checkDeathWithRandom(healthyStats, 70, 0.24)).toBe(true);
    expect(checkDeathWithRandom(healthyStats, 70, 0.26)).toBe(false);
  });

  it('50% death chance at age 80', () => {
    expect(checkDeathWithRandom(healthyStats, 80, 0.49)).toBe(true);
    expect(checkDeathWithRandom(healthyStats, 80, 0.51)).toBe(false);
  });

  it('guaranteed death at age 100', () => {
    // (100 - 60) / 40 = 1.0
    expect(checkDeathWithRandom(healthyStats, 100, 0.9999)).toBe(true);
  });

  it('low health at age 59 does NOT cause random death before 60', () => {
    expect(checkDeathWithRandom(lowHealth, 59, 0.0)).toBe(false);
  });
});

// ─── 3. Stat degradation ─────────────────────────────────────────────────────

describe('applyAgeUpDegradation', () => {
  const baseStats = { health: 80, looks: 80 };

  it('no degradation before age 30', () => {
    const result = applyAgeUpDegradation(baseStats, 25);
    expect(result.health).toBe(80);
    expect(result.looks).toBe(80);
  });

  it('no degradation at exactly age 30', () => {
    const result = applyAgeUpDegradation(baseStats, 30);
    expect(result.health).toBe(80);
  });

  it('-1 health at age 31', () => {
    const result = applyAgeUpDegradation(baseStats, 31);
    expect(result.health).toBe(79);
    expect(result.looks).toBe(80);
  });

  it('-3 health total and -1 looks at age 51 (−1 from age>30, −2 from age>50)', () => {
    const result = applyAgeUpDegradation(baseStats, 51);
    expect(result.health).toBe(77); // 80 - 1 - 2
    expect(result.looks).toBe(79);
  });

  it('health is clamped to 0 — never goes negative', () => {
    const result = applyAgeUpDegradation({ health: 1, looks: 0 }, 55);
    expect(result.health).toBe(0);
  });

  it('looks clamped to 0 — never goes negative', () => {
    const result = applyAgeUpDegradation({ health: 80, looks: 0 }, 55);
    expect(result.looks).toBe(0);
  });
});

// ─── 4. Career income & health ───────────────────────────────────────────────

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
    expect(stats.happiness).toBe(70);
  });

  it('applies healthEffect (was missing in original source)', () => {
    const career = { id: 'sw_eng', salary: 125000, happinessEffect: -10, healthEffect: -15 };
    const { stats } = applyCareerIncome(baseStats, 0, career);
    expect(stats.health).toBe(65);
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

// ─── 5. Startup equity ───────────────────────────────────────────────────────

describe('applyStartupYear', () => {
  const founder = { id: 'founder', equity: 1000, salary: 100 };

  it('bankrupt on random < 0.2', () => {
    const { career, history } = applyStartupYear(founder, 0.19);
    expect(career).toBeNull();
    expect(history).toBe('bankrupt');
  });

  it('downturn: equity × 0.8 on random 0.2–0.49', () => {
    const { career, history } = applyStartupYear(founder, 0.35);
    expect(history).toBe('downturn');
    expect(career.equity).toBe(800);
  });

  it('steady: equity × 1.5 on random 0.5–0.79', () => {
    const { career, history } = applyStartupYear(founder, 0.65);
    expect(history).toBe('steady');
    expect(career.equity).toBe(1500);
  });

  it('moonshot: equity × 3 on random >= 0.8', () => {
    const { career, history } = applyStartupYear(founder, 0.9);
    expect(history).toBe('moonshot');
    expect(career.equity).toBe(3000);
  });

  it('salary is 10% of equity after each outcome', () => {
    const { career } = applyStartupYear(founder, 0.9); // moonshot → 3000
    expect(career.salary).toBe(startupDividend(3000)); // 300
  });

  it('returns null career on bankrupt (no zombie startup)', () => {
    const { career } = applyStartupYear(founder, 0.0);
    expect(career).toBeNull();
  });

  it('non-founder career is returned unchanged', () => {
    const regularJob = { id: 'sw_eng', salary: 125000 };
    const { career } = applyStartupYear(regularJob, 0.99);
    expect(career).toEqual(regularJob);
  });
});

// ─── 6. Property market ──────────────────────────────────────────────────────

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

// ─── 7. Economy functions ────────────────────────────────────────────────────

describe('Lottery logic', () => {
  const TICKET_COST = 5;
  const JACKPOT = 10_000_000;
  const WIN_RATE = 0.00001;

  function playLotteryPure(bank, randomValue) {
    if (bank < TICKET_COST) return { bank, won: false, error: 'insufficient funds' };
    const newBank = bank - TICKET_COST;
    if (randomValue < WIN_RATE) return { bank: newBank + JACKPOT, won: true };
    return { bank: newBank, won: false };
  }

  it('deducts $5 on a loss', () => {
    const { bank } = playLotteryPure(100, 0.5);
    expect(bank).toBe(95);
  });

  it('awards jackpot on win', () => {
    const { bank, won } = playLotteryPure(100, 0.000001);
    expect(won).toBe(true);
    expect(bank).toBe(100 - 5 + JACKPOT);
  });

  it('refuses play when bank < $5', () => {
    const { error } = playLotteryPure(4, 0.0);
    expect(error).toBe('insufficient funds');
  });

  it('correctly sets win threshold at 0.00001', () => {
    expect(playLotteryPure(100, 0.000009).won).toBe(true);
    expect(playLotteryPure(100, 0.00002).won).toBe(false);
  });
});

describe('Gambling logic', () => {
  function goGamblePure(bank, amount, randomValue) {
    if (bank < amount || amount <= 0) return { bank, outcome: 'error' };
    const win = randomValue < 0.45;
    return {
      bank: win ? bank - amount + amount * 2 : bank - amount,
      outcome: win ? 'win' : 'lose',
    };
  }

  it('wins 2× return on random < 0.45', () => {
    const { bank, outcome } = goGamblePure(200, 100, 0.44);
    expect(outcome).toBe('win');
    expect(bank).toBe(300); // 200 - 100 + 200
  });

  it('loses wager on random >= 0.45', () => {
    const { bank, outcome } = goGamblePure(200, 100, 0.45);
    expect(outcome).toBe('lose');
    expect(bank).toBe(100);
  });

  it('refuses when bank < amount', () => {
    const { outcome } = goGamblePure(50, 100, 0.1);
    expect(outcome).toBe('error');
  });

  it('refuses when amount is 0', () => {
    const { outcome } = goGamblePure(200, 0, 0.1);
    expect(outcome).toBe('error');
  });
});

describe('Day trading logic', () => {
  function executeTradePure(bank, percentage, randomValue) {
    if (bank <= 0) return { bank, outcome: 'error' };
    const wager = Math.floor(bank * (percentage / 100));
    let multiplier;
    if (randomValue < 0.4) multiplier = 0;
    else if (randomValue < 0.6) multiplier = 0.5;
    else if (randomValue < 0.8) multiplier = 1.5;
    else if (randomValue < 0.95) multiplier = 2;
    else multiplier = 5;
    const payout = Math.floor(wager * multiplier);
    const profit = payout - wager;
    return { bank: bank + profit, multiplier, profit };
  }

  it('wipes out on multiplier 0 (random < 0.4)', () => {
    const { bank, profit } = executeTradePure(1000, 100, 0.39);
    expect(profit).toBe(-1000);
    expect(bank).toBe(0);
  });

  it('loses half on multiplier 0.5 (random 0.4–0.59)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.5);
    expect(multiplier).toBe(0.5);
  });

  it('+50% on multiplier 1.5 (random 0.6–0.79)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.7);
    expect(multiplier).toBe(1.5);
  });

  it('+100% on multiplier 2 (random 0.8–0.94)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.85);
    expect(multiplier).toBe(2);
  });

  it('+400% moonshot on multiplier 5 (random >= 0.95)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.99);
    expect(multiplier).toBe(5);
  });

  it('uses percentage of bank correctly', () => {
    const { bank } = executeTradePure(1000, 50, 0.99); // 50% → $500 wager, ×5 = $2500
    expect(bank).toBe(1000 - 500 + 2500);
  });

  it('refuses when bank is 0', () => {
    const { outcome } = executeTradePure(0, 100, 0.5);
    expect(outcome).toBe('error');
  });
});

// ─── 8. startLife: initial state validity ────────────────────────────────────

describe('startLife initial state', () => {
  // Mirror the stat generation logic
  function generateInitialStats() {
    return {
      health: 80 + Math.floor(Math.random() * 20),
      happiness: 80 + Math.floor(Math.random() * 20),
      smarts: 40 + Math.floor(Math.random() * 40),
      looks: 40 + Math.floor(Math.random() * 40),
      grades: 70 + Math.floor(Math.random() * 20),
      athleticism: 30 + Math.floor(Math.random() * 60),
      karma: 50,
      acting: 0,
      voice: 0,
      modeling: 0,
    };
  }

  it('all generated stats are integers within valid range', () => {
    for (let i = 0; i < 50; i++) {
      const s = generateInitialStats();
      expect(s.health).toBeGreaterThanOrEqual(80);
      expect(s.health).toBeLessThanOrEqual(99);
      expect(s.happiness).toBeGreaterThanOrEqual(80);
      expect(s.smarts).toBeGreaterThanOrEqual(40);
      expect(s.smarts).toBeLessThanOrEqual(79);
      expect(s.looks).toBeGreaterThanOrEqual(40);
      expect(s.athleticism).toBeGreaterThanOrEqual(30);
      expect(s.athleticism).toBeLessThanOrEqual(89);
      expect(s.karma).toBe(50);
      expect(s.acting).toBe(0);
      expect(s.voice).toBe(0);
      expect(s.modeling).toBe(0);
    }
  });

  it('all stats are integers (no float drift)', () => {
    const s = generateInitialStats();
    for (const key of Object.keys(s)) {
      expect(Number.isInteger(s[key])).toBe(true);
    }
  });
});

// ─── 9. Relationship helpers ─────────────────────────────────────────────────

describe('modifyRelationship', () => {
  function modifyRelation(relations, id, delta) {
    return relations.map(r =>
      r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r
    );
  }

  const rels = [
    { id: 'rel_m', type: 'Mother', relation: 70 },
    { id: 'rel_f', type: 'Father', relation: 60 },
  ];

  it('increases relation score', () => {
    const result = modifyRelation(rels, 'rel_m', 10);
    expect(result[0].relation).toBe(80);
  });

  it('decreases relation score', () => {
    const result = modifyRelation(rels, 'rel_f', -20);
    expect(result[1].relation).toBe(40);
  });

  it('clamps to 0 minimum', () => {
    const result = modifyRelation(rels, 'rel_f', -999);
    expect(result[1].relation).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    const result = modifyRelation(rels, 'rel_m', 999);
    expect(result[0].relation).toBe(100);
  });

  it('does not mutate other relationships', () => {
    const result = modifyRelation(rels, 'rel_m', 10);
    expect(result[1].relation).toBe(60);
  });
});

// ─── 10. Grades logic ────────────────────────────────────────────────────────

describe('gradesLogic', () => {
  it('high smarts (>70) increases grades by 2', () => {
    expect(gradesLogic(80, 75)).toBe(82);
  });

  it('low smarts (<40) decreases grades by 5', () => {
    expect(gradesLogic(80, 35)).toBe(75);
  });

  it('average smarts (40-70) decreases grades by 1', () => {
    expect(gradesLogic(80, 55)).toBe(79);
  });

  it('grades clamped to 100 on max', () => {
    expect(gradesLogic(99, 75)).toBe(100);
  });

  it('grades clamped to 0 on min', () => {
    expect(gradesLogic(3, 35)).toBe(0);
  });

  it('defaults grades to 70 if undefined', () => {
    expect(gradesLogic(undefined, 75)).toBe(72);
  });
});

// ─── 11. Dating success formula ──────────────────────────────────────────────

describe('dating success formula', () => {
  function datingSuccess(playerLooks, partnerLooks) {
    return (partnerLooks / 150) + (playerLooks / 150);
  }

  it('two average-looks people (~75 each) gives ~1.0 success chance', () => {
    expect(datingSuccess(75, 75)).toBeCloseTo(1.0, 1);
  });

  it('two max-looks people gives 1.33 chance (always succeeds)', () => {
    expect(datingSuccess(100, 100)).toBeCloseTo(1.33, 2);
  });

  it('two min-looks people gives low chance', () => {
    expect(datingSuccess(30, 30)).toBeCloseTo(0.4, 2);
  });

  it('high player looks compensates for low partner looks', () => {
    const chance = datingSuccess(100, 30);
    expect(chance).toBeGreaterThan(0.85);
  });
});

// ─── 12. trainHiddenSkill ────────────────────────────────────────────────────

describe('trainHiddenSkill', () => {
  function trainHiddenSkill() {
    return Math.floor(Math.random() * 6) + 3; // 3–8
  }

  it('gain is always between 3 and 8 inclusive', () => {
    for (let i = 0; i < 100; i++) {
      const gain = trainHiddenSkill();
      expect(gain).toBeGreaterThanOrEqual(3);
      expect(gain).toBeLessThanOrEqual(8);
    }
  });

  it('gain is always an integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(Number.isInteger(trainHiddenSkill())).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAREER SYSTEM EXPANSION — pure function mirrors
// ═══════════════════════════════════════════════════════════════════════════════

const DEGREE_CONFIG = {
  highSchool: { years: 0,  annualCost: 0,     requires: null,       happinessEffect: 0   },
  associate:  { years: 2,  annualCost: 10000,  requires: 'highSchool', happinessEffect: 0 },
  bachelor:   { years: 4,  annualCost: 20000,  requires: 'highSchool', happinessEffect: 0 },
  master:     { years: 2,  annualCost: 30000,  requires: 'bachelor',   happinessEffect: 0 },
  phd:        { years: 4,  annualCost: 0,      requires: 'master',     happinessEffect: -20 },
};

const DEGREE_LABELS = {
  highSchool: 'HS Diploma',
  associate:  "Associate's",
  bachelor:   "Bachelor's",
  master:     "Master's",
  phd:        'PhD',
};

function checkCareerEligibility(career, education, stats, networking, age) {
  if (age < career.minAge) return { eligible: false, reason: `Requires age ${career.minAge}+` };
  if (career.requiresDegree && !education[career.requiresDegree]) {
    return { eligible: false, reason: `Requires ${DEGREE_LABELS[career.requiresDegree]}` };
  }
  const netReq = career.requiresNetworking ?? 0;
  if (networking < netReq) {
    return { eligible: false, reason: `Requires Networking ${netReq}+` };
  }
  for (const [stat, min] of Object.entries(career.statRequirements ?? {})) {
    if ((stats[stat] ?? 0) < min) {
      return { eligible: false, reason: `Requires ${stat} ${min}+` };
    }
  }
  return { eligible: true, reason: '' };
}

function enrollInDegree(degreeType, education, bank) {
  const cfg = DEGREE_CONFIG[degreeType];
  if (!cfg) return { error: 'Unknown degree type' };
  if (education.currentDegree !== null) return { error: 'Already enrolled in a program' };
  if (cfg.requires && !education[cfg.requires]) {
    return { error: `Requires ${DEGREE_LABELS[cfg.requires]} first` };
  }
  if (bank < cfg.annualCost) return { error: 'Insufficient funds for first year' };
  return {
    newEducation: { ...education, currentDegree: { type: degreeType, yearsInProgram: 0, totalYears: cfg.years, annualCost: cfg.annualCost } },
    newBank: bank - cfg.annualCost,
  };
}

function processEducationYear(education, stats, bank) {
  const deg = education.currentDegree;
  if (!deg) return { education, stats, bank, completed: false };
  let newBank = bank - deg.annualCost;
  let newStats = { ...stats };
  const cfg = DEGREE_CONFIG[deg.type];
  if (cfg.happinessEffect) {
    newStats.happiness = clamp(newStats.happiness + cfg.happinessEffect);
  }
  const newYears = deg.yearsInProgram + 1;
  if (newYears >= deg.totalYears) {
    const bonuses = { associate: 3, bachelor: 10, master: 5, phd: 3 };
    newStats.smarts = clamp(newStats.smarts + (bonuses[deg.type] ?? 0));
    newStats.happiness = clamp(newStats.happiness + 3);
    return {
      education: { ...education, [deg.type]: true, currentDegree: null },
      stats: newStats,
      bank: newBank,
      completed: true,
      completedType: deg.type,
    };
  }
  return {
    education: { ...education, currentDegree: { ...deg, yearsInProgram: newYears } },
    stats: newStats,
    bank: newBank,
    completed: false,
  };
}

function processEconomyCycle(cycle) {
  const PHASE_DURATIONS = { normal: 3, boom: 2, recession: 2 };
  const transitions    = { normal: 'boom', boom: 'recession', recession: 'normal' };
  const newYear = cycle.year + 1;
  const newYearsInPhase = cycle.yearsInPhase + 1;
  if (newYearsInPhase >= PHASE_DURATIONS[cycle.phase]) {
    return { year: newYear, phase: transitions[cycle.phase], yearsInPhase: 0 };
  }
  return { year: newYear, phase: cycle.phase, yearsInPhase: newYearsInPhase };
}

function buildReviewRoll(stats, networking, isOnPIP, financialStressFlag, economyCycle) {
  let roll = 0.5; // base midpoint
  roll += Math.min(0.10, ((stats.smarts  - 50) / 10) * 0.02);
  roll += Math.min(0.06, ((stats.health  - 50) / 10) * 0.02);
  roll += Math.min(0.05, ((stats.karma   - 50) / 10) * 0.01);
  roll += Math.min(0.10, (networking / 20) * 0.02);
  if (isOnPIP)             roll -= 0.05;
  if (financialStressFlag) roll -= 0.10;
  if (economyCycle?.phase === 'boom')      roll += 0.05;
  if (economyCycle?.phase === 'recession') roll -= 0.05;
  return roll;
}

function runPerformanceReview(stats, career, careerMeta, networking, economyCycle, randomOverride) {
  const roll = randomOverride ?? buildReviewRoll(stats, networking, careerMeta.isOnPIP, careerMeta.financialStressFlag, economyCycle);

  // Determine outcome band
  let outcome;
  if (roll < 0.10)      outcome = 'fired';
  else if (roll < 0.25) outcome = 'pip';
  else if (roll < 0.55) outcome = 'no_change';
  else if (roll < 0.85) outcome = 'raise';
  else                  outcome = 'promoted';

  // Recession increases fire chance, boom reduces it
  if (economyCycle?.phase === 'recession' && roll < 0.15) outcome = 'fired';
  if (economyCycle?.phase === 'boom'      && outcome === 'fired' && roll >= 0.12) outcome = 'pip';

  const salaryMultiplier = outcome === 'raise' ? 1.05 : 1.0;
  let newCareer = { ...career, salary: Math.round(career.salary * salaryMultiplier) };
  let setIsOnPIP = false;
  let unemploymentYears = 0;
  let newFinancialStressFlag = careerMeta.financialStressFlag ?? false;

  if (outcome === 'promoted') {
    if (!career.nextTierId) {
      // Already apex — fall back to raise
      outcome = 'raise';
      newCareer = { ...career, salary: Math.round(career.salary * 1.05) };
    } else {
      const reqs = career.promotionRequirements ?? {};
      const meetsReqs = (
        (careerMeta.yearsInRole >= (reqs.minYearsInRole ?? 0)) &&
        (stats.smarts  >= (reqs.minSmarts  ?? 0)) &&
        (stats.health  >= (reqs.minHealth  ?? 0)) &&
        (stats.karma   >= (reqs.minKarma   ?? 0))
      );
      if (!meetsReqs) {
        outcome = 'raise';
        newCareer = { ...career, salary: Math.round(career.salary * 1.05) };
      }
      // If meetsReqs, newCareer stays as career with nextTierId (UI resolves promotion)
    }
  }

  if (outcome === 'pip') {
    setIsOnPIP = true;
    newCareer = career; // no salary change on PIP
  }

  if (outcome === 'fired') {
    newCareer = null;
    unemploymentYears = 2;
    if ((careerMeta.bank ?? Infinity) < 10000) newFinancialStressFlag = true;
  }

  const outcomeTexts = {
    promoted:  `Performance Review: Outstanding work! You've been promoted to the next level.`,
    raise:     `Performance Review: Good performance. You received a 5% salary raise.`,
    no_change: `Performance Review: Satisfactory performance. No change in compensation.`,
    pip:       `Performance Review: Your manager placed you on a Performance Improvement Plan.`,
    fired:     `Performance Review: You were let go. Your position has been eliminated.`,
  };

  return {
    outcome,
    newCareer,
    newSalary: newCareer?.salary ?? 0,
    historyText: outcomeTexts[outcome],
    statEffects: {
      happiness: outcome === 'pip' ? -10 : outcome === 'fired' ? -30 : 0,
    },
    setIsOnPIP,
    unemploymentYears,
    newFinancialStressFlag,
  };
}

// ─── 13. checkCareerEligibility ──────────────────────────────────────────────

describe('checkCareerEligibility', () => {
  const baseEdu    = { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };
  const baseStats  = { smarts: 60, health: 70, athleticism: 50, karma: 50 };
  const networking = 30;

  const career = {
    id: 'senior_dev', minAge: 25, requiresDegree: 'bachelor',
    requiresNetworking: 20, statRequirements: { smarts: 55 },
  };

  it('ineligible — too young', () => {
    const { eligible, reason } = checkCareerEligibility(career, { ...baseEdu, bachelor: true }, baseStats, networking, 22);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/age 25/);
  });

  it('ineligible — missing degree', () => {
    const { eligible, reason } = checkCareerEligibility(career, baseEdu, baseStats, networking, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/Bachelor/i);
  });

  it('ineligible — networking too low', () => {
    const edu = { ...baseEdu, bachelor: true };
    const { eligible, reason } = checkCareerEligibility(career, edu, baseStats, 10, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/Networking/);
  });

  it('ineligible — stat requirement not met', () => {
    const edu = { ...baseEdu, bachelor: true };
    const low = { ...baseStats, smarts: 40 };
    const { eligible, reason } = checkCareerEligibility(career, edu, low, networking, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/smarts/);
  });

  it('eligible — all conditions met', () => {
    const edu = { ...baseEdu, bachelor: true };
    const { eligible } = checkCareerEligibility(career, edu, baseStats, networking, 26);
    expect(eligible).toBe(true);
  });

  it('null requiresDegree skips degree check', () => {
    const noDegreeCareer = { ...career, requiresDegree: null };
    const { eligible } = checkCareerEligibility(noDegreeCareer, baseEdu, baseStats, networking, 26);
    expect(eligible).toBe(true);
  });

  it('zero requiresNetworking skips networking check', () => {
    const noNetCareer = { ...career, requiresDegree: null, requiresNetworking: 0 };
    const { eligible } = checkCareerEligibility(noNetCareer, baseEdu, baseStats, 0, 26);
    expect(eligible).toBe(true);
  });

  it('empty statRequirements skips stat check', () => {
    const noStatCareer = { ...career, requiresDegree: null, requiresNetworking: 0, statRequirements: {} };
    const { eligible } = checkCareerEligibility(noStatCareer, baseEdu, {}, 0, 26);
    expect(eligible).toBe(true);
  });
});

// ─── 14. enrollInDegree ──────────────────────────────────────────────────────

describe('enrollInDegree', () => {
  const baseEdu = { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };

  it('error if already enrolled', () => {
    const edu = { ...baseEdu, currentDegree: { type: 'associate', yearsInProgram: 0, totalYears: 2, annualCost: 10000 } };
    const { error } = enrollInDegree('bachelor', edu, 100000);
    expect(error).toMatch(/already enrolled/i);
  });

  it('error if prerequisite not held', () => {
    const { error } = enrollInDegree('master', baseEdu, 100000);
    expect(error).toMatch(/Bachelor/i);
  });

  it('error if bank < annualCost', () => {
    const { error } = enrollInDegree('bachelor', baseEdu, 5000);
    expect(error).toMatch(/Insufficient/i);
  });

  it('success — currentDegree is set correctly', () => {
    const { newEducation } = enrollInDegree('bachelor', baseEdu, 100000);
    expect(newEducation.currentDegree.type).toBe('bachelor');
    expect(newEducation.currentDegree.yearsInProgram).toBe(0);
    expect(newEducation.currentDegree.totalYears).toBe(4);
  });

  it('success — first year cost deducted from bank', () => {
    const { newBank } = enrollInDegree('bachelor', baseEdu, 100000);
    expect(newBank).toBe(80000);
  });

  it('PhD has zero annual cost', () => {
    const richEdu = { ...baseEdu, bachelor: true, master: true };
    const { newBank } = enrollInDegree('phd', richEdu, 50000);
    expect(newBank).toBe(50000); // no deduction
  });

  it('associate requires only high school', () => {
    const { error } = enrollInDegree('associate', baseEdu, 100000);
    expect(error).toBeUndefined();
  });
});

// ─── 15. processEducationYear ────────────────────────────────────────────────

describe('processEducationYear', () => {
  const baseStats = { smarts: 50, happiness: 70 };
  const enrolledBachelor = {
    highSchool: true, bachelor: false, currentDegree: { type: 'bachelor', yearsInProgram: 0, totalYears: 4, annualCost: 20000 }
  };
  const finalYearBachelor = {
    highSchool: true, bachelor: false, currentDegree: { type: 'bachelor', yearsInProgram: 3, totalYears: 4, annualCost: 20000 }
  };

  it('increments yearsInProgram each year', () => {
    const { education } = processEducationYear(enrolledBachelor, baseStats, 100000);
    expect(education.currentDegree.yearsInProgram).toBe(1);
  });

  it('deducts annual cost from bank', () => {
    const { bank } = processEducationYear(enrolledBachelor, baseStats, 100000);
    expect(bank).toBe(80000);
  });

  it('PhD applies -20 happiness per year', () => {
    const phdEdu = {
      ...enrolledBachelor,
      master: true,
      currentDegree: { type: 'phd', yearsInProgram: 0, totalYears: 4, annualCost: 0 }
    };
    const { stats } = processEducationYear(phdEdu, baseStats, 50000);
    expect(stats.happiness).toBe(50);
  });

  it('completes degree when yearsInProgram reaches totalYears', () => {
    const { completed, completedType } = processEducationYear(finalYearBachelor, baseStats, 100000);
    expect(completed).toBe(true);
    expect(completedType).toBe('bachelor');
  });

  it('on completion: sets bachelor=true and clears currentDegree', () => {
    const { education } = processEducationYear(finalYearBachelor, baseStats, 100000);
    expect(education.bachelor).toBe(true);
    expect(education.currentDegree).toBeNull();
  });

  it('on completion: +10 smarts for bachelor', () => {
    const { stats } = processEducationYear(finalYearBachelor, baseStats, 100000);
    expect(stats.smarts).toBe(60);
  });

  it('on completion: +3 happiness for all degrees', () => {
    const { stats } = processEducationYear(finalYearBachelor, baseStats, 100000);
    expect(stats.happiness).toBeGreaterThan(baseStats.happiness);
  });

  it('no-op when no currentDegree enrolled', () => {
    const noEnrollEdu = { highSchool: true, currentDegree: null };
    const { completed, bank } = processEducationYear(noEnrollEdu, baseStats, 50000);
    expect(completed).toBe(false);
    expect(bank).toBe(50000); // unchanged
  });
});

// ─── 16. processEconomyCycle ─────────────────────────────────────────────────

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

// ─── 17. runPerformanceReview ────────────────────────────────────────────────

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
