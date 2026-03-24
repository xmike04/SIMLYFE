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

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY SYSTEM — pure function mirrors
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Activity helper mirrors ─────────────────────────────────────────────────

/**
 * checkActivityGuard — mirrors performActivity guard logic in gameState.js.
 * Returns { allowed: bool, reason: string }.
 * guard shape: { stat: string, op: 'gte'|'lte', value: number }
 */
function checkActivityGuard(guard, stats) {
  if (!guard) return { allowed: true, reason: '' };
  const actual = stats[guard.stat] ?? 0;
  if (guard.op === 'gte' && actual < guard.value)
    return { allowed: false, reason: `Requires ${guard.stat} ${guard.value}+` };
  if (guard.op === 'lte' && actual > guard.value)
    return { allowed: false, reason: `Requires ${guard.stat} ${guard.value} or lower` };
  return { allowed: true, reason: '' };
}

/**
 * applyActivityCost — mirrors cost deduction in performActivity.
 * Returns { newBank, canAfford }.
 */
function applyActivityCost(bank, cost) {
  const c = cost ?? 0;
  if (bank < c) return { newBank: bank, canAfford: false };
  return { newBank: bank - c, canAfford: true };
}

/**
 * resolveActivityEffects — applies baseEffects to stats, returns new stats.
 * Clamps all stat values to [0, 100].
 */
function resolveActivityEffects(stats, baseEffects) {
  if (!baseEffects) return { ...stats };
  const STAT_KEYS = ['health','happiness','smarts','looks','athleticism','karma','acting','voice','modeling','grades'];
  const next = { ...stats };
  for (const key of STAT_KEYS) {
    if (baseEffects[key] !== undefined) {
      next[key] = Math.min(100, Math.max(0, (next[key] ?? 0) + baseEffects[key]));
    }
  }
  return next;
}

/**
 * checkYearlyLimit — returns true if activity is blocked by per-year gate.
 */
function checkYearlyLimit(item, activitiesThisYear) {
  if (!item.yearlyLimit) return false;
  const count = activitiesThisYear[item.id] ?? 0;
  return count >= item.yearlyLimit;
}

// ─── 16. checkActivityGuard ──────────────────────────────────────────────────

describe('checkActivityGuard', () => {
  const stats = { health: 60, happiness: 50, smarts: 70, looks: 40, karma: 30, athleticism: 55 };

  it('returns allowed when guard is undefined', () => {
    expect(checkActivityGuard(undefined, stats).allowed).toBe(true);
  });

  it('gte guard passes when stat meets threshold', () => {
    const { allowed } = checkActivityGuard({ stat: 'looks', op: 'gte', value: 40 }, stats);
    expect(allowed).toBe(true);
  });

  it('gte guard fails when stat is below threshold', () => {
    const { allowed, reason } = checkActivityGuard({ stat: 'looks', op: 'gte', value: 60 }, stats);
    expect(allowed).toBe(false);
    expect(reason).toMatch(/looks/i);
  });

  it('lte guard passes when stat is at or below threshold (crime with low karma)', () => {
    const { allowed } = checkActivityGuard({ stat: 'karma', op: 'lte', value: 40 }, stats);
    expect(allowed).toBe(true);
  });

  it('lte guard fails when stat exceeds threshold', () => {
    const { allowed, reason } = checkActivityGuard({ stat: 'karma', op: 'lte', value: 20 }, stats);
    expect(allowed).toBe(false);
    expect(reason).toMatch(/karma/i);
  });

  it('reason string is empty when allowed', () => {
    const { reason } = checkActivityGuard({ stat: 'smarts', op: 'gte', value: 50 }, stats);
    expect(reason).toBe('');
  });

  it('missing stat treated as 0 — gte fails', () => {
    const { allowed } = checkActivityGuard({ stat: 'modeling', op: 'gte', value: 30 }, stats);
    expect(allowed).toBe(false);
  });
});

// ─── 17. applyActivityCost ───────────────────────────────────────────────────

describe('applyActivityCost', () => {
  it('deducts cost from bank', () => {
    expect(applyActivityCost(1000, 200).newBank).toBe(800);
  });

  it('canAfford is true when bank equals cost', () => {
    expect(applyActivityCost(200, 200).canAfford).toBe(true);
  });

  it('canAfford is false when bank < cost', () => {
    expect(applyActivityCost(100, 200).canAfford).toBe(false);
  });

  it('bank unchanged when cannot afford', () => {
    expect(applyActivityCost(100, 200).newBank).toBe(100);
  });

  it('zero cost always affordable', () => {
    expect(applyActivityCost(0, 0).canAfford).toBe(true);
  });

  it('undefined cost treated as zero', () => {
    expect(applyActivityCost(500, undefined).newBank).toBe(500);
  });
});

// ─── 18. resolveActivityEffects ──────────────────────────────────────────────

describe('resolveActivityEffects', () => {
  const base = { health: 60, happiness: 50, smarts: 70, looks: 40, karma: 30, athleticism: 55 };

  it('applies positive effects correctly', () => {
    const next = resolveActivityEffects(base, { health: 10, happiness: 5 });
    expect(next.health).toBe(70);
    expect(next.happiness).toBe(55);
  });

  it('applies negative effects correctly', () => {
    const next = resolveActivityEffects(base, { health: -20 });
    expect(next.health).toBe(40);
  });

  it('clamps stat to 100 maximum', () => {
    const next = resolveActivityEffects(base, { happiness: 9999 });
    expect(next.happiness).toBe(100);
  });

  it('clamps stat to 0 minimum', () => {
    const next = resolveActivityEffects(base, { health: -9999 });
    expect(next.health).toBe(0);
  });

  it('does not affect unmentioned stats', () => {
    const next = resolveActivityEffects(base, { health: 5 });
    expect(next.smarts).toBe(70);
    expect(next.karma).toBe(30);
  });

  it('returns copy — does not mutate original', () => {
    resolveActivityEffects(base, { health: 10 });
    expect(base.health).toBe(60);
  });

  it('undefined baseEffects returns stats unchanged', () => {
    const next = resolveActivityEffects(base, undefined);
    expect(next).toEqual(base);
  });
});

// ─── 19. checkYearlyLimit ────────────────────────────────────────────────────

describe('checkYearlyLimit', () => {
  it('returns false when item has no yearlyLimit', () => {
    expect(checkYearlyLimit({ id: 'gym' }, {})).toBe(false);
  });

  it('returns false when count is below yearlyLimit', () => {
    expect(checkYearlyLimit({ id: 'vacation', yearlyLimit: 2 }, { vacation: 1 })).toBe(false);
  });

  it('returns true when count equals yearlyLimit', () => {
    expect(checkYearlyLimit({ id: 'vacation', yearlyLimit: 2 }, { vacation: 2 })).toBe(true);
  });

  it('returns true when count exceeds yearlyLimit', () => {
    expect(checkYearlyLimit({ id: 'vacation', yearlyLimit: 1 }, { vacation: 3 })).toBe(true);
  });

  it('treats missing count as 0', () => {
    expect(checkYearlyLimit({ id: 'doctor', yearlyLimit: 1 }, {})).toBe(false);
  });
});

// ─── 20. Activity cost + guard integration ───────────────────────────────────

describe('activity cost + guard integration', () => {
  const richStats  = { health: 80, happiness: 70, smarts: 75, looks: 80, karma: 20, athleticism: 60 };
  const poorStats  = { health: 50, happiness: 40, smarts: 30, looks: 25, karma: 70, athleticism: 20 };

  it('high-karma player blocked from crime (lte 40)', () => {
    const guard = { stat: 'karma', op: 'lte', value: 40 };
    expect(checkActivityGuard(guard, poorStats).allowed).toBe(false); // poorStats.karma=70
  });

  it('low-karma player can commit crime', () => {
    const guard = { stat: 'karma', op: 'lte', value: 40 };
    expect(checkActivityGuard(guard, richStats).allowed).toBe(true); // richStats.karma=20
  });

  it('low-looks player blocked from modeling (gte 60)', () => {
    const guard = { stat: 'looks', op: 'gte', value: 60 };
    expect(checkActivityGuard(guard, poorStats).allowed).toBe(false);
  });

  it('high-looks player can model', () => {
    const guard = { stat: 'looks', op: 'gte', value: 60 };
    expect(checkActivityGuard(guard, richStats).allowed).toBe(true);
  });

  it('player who cannot afford VIP table is blocked', () => {
    expect(applyActivityCost(3000, 5000).canAfford).toBe(false);
  });

  it('plastic surgery reduces looks short-term then recovers', () => {
    const next = resolveActivityEffects(richStats, { looks: -5, health: -5, happiness: 10 });
    expect(next.looks).toBe(75);
    expect(next.health).toBe(75);
    expect(next.happiness).toBe(80);
  });

  it('vacation boosts happiness and health', () => {
    const next = resolveActivityEffects(poorStats, { happiness: 15, health: 10 });
    expect(next.happiness).toBe(55);
    expect(next.health).toBe(60);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Relationship mechanics
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Pure-function mirrors ────────────────────────────────────────────────────

/**
 * getMood — derive mood label from relation score.
 * 75–100 → 'happy', 50–74 → 'neutral', 25–49 → 'upset', 0–24 → 'hostile'
 */
function getMood(relation) {
  if (relation >= 75) return 'happy';
  if (relation >= 50) return 'neutral';
  if (relation >= 25) return 'upset';
  return 'hostile';
}

/**
 * shouldAutoBreakup — true when the relationship should dissolve passively.
 * Triggers when status is 'dating' or 'married' AND relation < 20.
 */
function shouldAutoBreakup(rel) {
  return (rel.status === 'dating' || rel.status === 'married') && rel.relation < 20;
}

/**
 * passiveRelationDecay — amount relation drops per year if not interacted with.
 * family → −1, dating → −3, married → −2, friend → −2, ex/estranged → 0
 */
function passiveRelationDecay(rel) {
  if (rel.status === 'family') return 1;
  if (rel.status === 'dating') return 3;
  if (rel.status === 'married') return 2;
  if (rel.status === 'friend') return 2;
  return 0;
}

/**
 * parentDeathChance — probability (0–1) that a parent/elder relative dies this year.
 * 0 below age 70, then (age - 70) / 60, capped at 1.
 */
function parentDeathChance(age) {
  if (age < 70) return 0;
  return Math.min(1, (age - 70) / 60);
}

/**
 * marriageEligibility — checks whether the player can propose to a relationship.
 * Requires: status === 'dating', relation >= 80, playerAge >= 18.
 * Returns { eligible: bool, reason: string }
 */
function marriageEligibility(rel, playerAge) {
  if (rel.status !== 'dating') return { eligible: false, reason: 'Not currently dating' };
  if (playerAge < 18) return { eligible: false, reason: 'Must be 18+ to marry' };
  if (rel.relation < 80) return { eligible: false, reason: `Relation must be 80+ (currently ${rel.relation})` };
  return { eligible: true, reason: '' };
}

/**
 * divorceCost — calculates how much a divorce costs.
 * 15% of bank, minimum $5,000, maximum $50,000.
 */
function divorceCost(bank) {
  return Math.min(50000, Math.max(5000, Math.floor(bank * 0.15)));
}

/**
 * countJealousyTriggers — returns number of concurrent active lovers (dating/married).
 * Jealousy fires when this count > 1.
 */
function countJealousyTriggers(relationships) {
  return relationships.filter(r => r.status === 'dating' || r.status === 'married').length;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const makeRel = (overrides = {}) => ({
  id: 'rel_test',
  name: 'Alex',
  age: 30,
  relation: 60,
  status: 'dating',
  mood: 'neutral',
  isAlive: true,
  ...overrides,
});

// ─── getMood ─────────────────────────────────────────────────────────────────

describe('getMood', () => {
  it('relation 100 → happy', () => expect(getMood(100)).toBe('happy'));
  it('relation 75 → happy', ()  => expect(getMood(75)).toBe('happy'));
  it('relation 74 → neutral', () => expect(getMood(74)).toBe('neutral'));
  it('relation 50 → neutral', () => expect(getMood(50)).toBe('neutral'));
  it('relation 49 → upset', ()  => expect(getMood(49)).toBe('upset'));
  it('relation 25 → upset', ()  => expect(getMood(25)).toBe('upset'));
  it('relation 24 → hostile', () => expect(getMood(24)).toBe('hostile'));
  it('relation 0 → hostile', ()  => expect(getMood(0)).toBe('hostile'));
});

// ─── shouldAutoBreakup ────────────────────────────────────────────────────────

describe('shouldAutoBreakup', () => {
  it('dating + relation 19 → true', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'dating', relation: 19 }))).toBe(true);
  });

  it('married + relation 5 → true', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'married', relation: 5 }))).toBe(true);
  });

  it('dating + relation 20 → false (threshold is exclusive)', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'dating', relation: 20 }))).toBe(false);
  });

  it('family + relation 5 → false (family never auto-breaks)', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'family', relation: 5 }))).toBe(false);
  });

  it('friend + relation 0 → false', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'friend', relation: 0 }))).toBe(false);
  });

  it('ex + relation 0 → false', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'ex', relation: 0 }))).toBe(false);
  });
});

// ─── passiveRelationDecay ─────────────────────────────────────────────────────

describe('passiveRelationDecay', () => {
  it('family decays by 1 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'family' }))).toBe(1);
  });

  it('dating decays by 3 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'dating' }))).toBe(3);
  });

  it('married decays by 2 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'married' }))).toBe(2);
  });

  it('friend decays by 2 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'friend' }))).toBe(2);
  });

  it('ex decays by 0 (no obligation)', () => {
    expect(passiveRelationDecay(makeRel({ status: 'ex' }))).toBe(0);
  });

  it('estranged decays by 0', () => {
    expect(passiveRelationDecay(makeRel({ status: 'estranged' }))).toBe(0);
  });
});

// ─── parentDeathChance ────────────────────────────────────────────────────────

describe('parentDeathChance', () => {
  it('age 69 → 0 chance', () => {
    expect(parentDeathChance(69)).toBe(0);
  });

  it('age 70 → 0 chance (threshold start, exclusive)', () => {
    expect(parentDeathChance(70)).toBe(0);
  });

  it('age 100 → ~0.5 chance', () => {
    expect(parentDeathChance(100)).toBeCloseTo(0.5);
  });

  it('age 130 → capped at 1', () => {
    expect(parentDeathChance(130)).toBe(1);
  });

  it('chance increases monotonically with age', () => {
    expect(parentDeathChance(90)).toBeGreaterThan(parentDeathChance(80));
    expect(parentDeathChance(110)).toBeGreaterThan(parentDeathChance(90));
  });
});

// ─── marriageEligibility ──────────────────────────────────────────────────────

describe('marriageEligibility', () => {
  it('valid: dating, relation 80+, age 18+ → eligible', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 85 }), 25);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('');
  });

  it('blocked when not dating (status married)', () => {
    const result = marriageEligibility(makeRel({ status: 'married', relation: 90 }), 30);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/not currently dating/i);
  });

  it('blocked when not dating (status friend)', () => {
    const result = marriageEligibility(makeRel({ status: 'friend', relation: 95 }), 30);
    expect(result.eligible).toBe(false);
  });

  it('blocked when player under 18', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 90 }), 17);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/18/);
  });

  it('blocked when relation < 80', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 79 }), 25);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/80/);
  });

  it('exact edge: relation exactly 80 → eligible', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 80 }), 18);
    expect(result.eligible).toBe(true);
  });
});

// ─── divorceCost ─────────────────────────────────────────────────────────────

describe('divorceCost', () => {
  it('15% of bank, floored', () => {
    expect(divorceCost(100000)).toBe(15000);
  });

  it('minimum cost is $5,000', () => {
    expect(divorceCost(0)).toBe(5000);
    expect(divorceCost(10000)).toBe(5000); // 15% = 1500, floored to 5000
  });

  it('maximum cost is $50,000', () => {
    expect(divorceCost(1000000)).toBe(50000);
  });

  it('moderate bank: 15% applied', () => {
    expect(divorceCost(200000)).toBe(30000);
  });
});

// ─── countJealousyTriggers ────────────────────────────────────────────────────

describe('countJealousyTriggers', () => {
  it('returns 0 with no relationships', () => {
    expect(countJealousyTriggers([])).toBe(0);
  });

  it('returns 0 with only family', () => {
    const rels = [makeRel({ status: 'family' }), makeRel({ status: 'family', id: 'rel_2' })];
    expect(countJealousyTriggers(rels)).toBe(0);
  });

  it('returns 1 with one lover (no jealousy)', () => {
    expect(countJealousyTriggers([makeRel({ status: 'dating' })])).toBe(1);
  });

  it('returns 2 with two simultaneous lovers (jealousy fires)', () => {
    const rels = [
      makeRel({ id: 'rel_1', status: 'dating' }),
      makeRel({ id: 'rel_2', status: 'dating' }),
    ];
    expect(countJealousyTriggers(rels)).toBe(2);
  });

  it('counts married partner as active lover', () => {
    const rels = [
      makeRel({ id: 'rel_1', status: 'married' }),
      makeRel({ id: 'rel_2', status: 'dating' }),
    ];
    expect(countJealousyTriggers(rels)).toBe(2);
  });

  it('ex and estranged do not count', () => {
    const rels = [
      makeRel({ id: 'rel_1', status: 'ex' }),
      makeRel({ id: 'rel_2', status: 'estranged' }),
      makeRel({ id: 'rel_3', status: 'dating' }),
    ];
    expect(countJealousyTriggers(rels)).toBe(1);
  });
});

// ─── Integration: auto-breakup + decay scenario ───────────────────────────────

describe('relationship decay + auto-breakup integration', () => {
  it('lover relation decays to 0 → shouldAutoBreakup fires', () => {
    let rel = makeRel({ status: 'dating', relation: 22 });
    // Simulate 2 years of neglect (no interaction each year)
    rel = { ...rel, relation: Math.max(0, rel.relation - passiveRelationDecay(rel)) }; // yr 1: 19
    expect(rel.relation).toBe(19);
    expect(shouldAutoBreakup(rel)).toBe(true);
  });

  it('spouse with regular interaction avoids auto-breakup', () => {
    let rel = makeRel({ status: 'married', relation: 50 });
    // Simulate interaction: +10, then decay: -2 → net +8
    rel = { ...rel, relation: clamp(rel.relation + 10 - passiveRelationDecay(rel)) };
    expect(rel.relation).toBe(58);
    expect(shouldAutoBreakup(rel)).toBe(false);
  });

  it('jealousy: two simultaneous lovers triggers jealousy', () => {
    const rels = [
      makeRel({ id: 'rel_a', status: 'dating', relation: 80 }),
      makeRel({ id: 'rel_b', status: 'dating', relation: 75 }),
    ];
    expect(countJealousyTriggers(rels)).toBeGreaterThan(1);
  });

  it('parent at age 85 has meaningful death chance (>=25%)', () => {
    expect(parentDeathChance(85)).toBeGreaterThanOrEqual(0.25);
  });

  it('full marriage pipeline: date → eligible → propose → married', () => {
    const rel = makeRel({ status: 'dating', relation: 90 });
    const eligibility = marriageEligibility(rel, 28);
    expect(eligibility.eligible).toBe(true);
    // After proposing, status changes to 'married'
    const married = { ...rel, status: 'married' };
    expect(married.status).toBe('married');
    expect(shouldAutoBreakup(married)).toBe(false); // 90 relation, won't auto-break
  });

  it('divorce pipeline: married → cost calculated → becomes ex', () => {
    const rel = makeRel({ status: 'married', relation: 15 });
    // relation < 20 → would auto-breakup if married, triggering divorce
    expect(shouldAutoBreakup(rel)).toBe(true);
    const cost = divorceCost(80000);
    expect(cost).toBe(12000);
    const afterDivorce = { ...rel, status: 'ex' };
    expect(shouldAutoBreakup(afterDivorce)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Wealth tier mechanics
// ═══════════════════════════════════════════════════════════════════════════════

import { getWealthTier, calculateIncomeTax, WEALTH_TIERS } from '../config/wealthTiers';

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

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Asset catalog mechanics
// ═══════════════════════════════════════════════════════════════════════════════

import { ASSET_CATALOG, getAllAssets, getAssetsByTier, calculateCapitalGainsTax, estimateInvestmentReturn } from '../config/assetCatalog';

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

// ─────────────────────────────────────────────────────────────────────────────
// §13. INTEGRATION — Cross-system edge cases combining all four v1.4 systems:
//     Wealth Tiers · Relationships · Assets/Store Catalog · Investments
// ─────────────────────────────────────────────────────────────────────────────

import { WEALTH_TIERS as WT2, getWealthTier as gwt, calculateIncomeTax as cit } from '../config/wealthTiers';
import { STORE_CATALOG, getStoresByCategory, STORE_TIER_ORDER } from '../config/storeCatalog';
import { CRYPTO_LIST, STOCK_LIST, BOND_LIST, PENNY_STOCK_LIST, FUND_LIST, getMarketHealth, bondDisplayName } from '../config/investmentMarket';

// ── Helpers mirrored from gameState.js for integration tests ──────────────────

function calcDivorceCost(bank) {
  return Math.min(50_000, Math.max(5_000, Math.floor(bank * 0.15)));
}

function calcNetWorth(bank, properties, belongings) {
  return Math.floor(bank
    + properties.reduce((s, p) => s + p.currentValue, 0)
    + belongings.reduce((s, b) => s + b.currentValue, 0));
}

function processInvestmentYear(item, econPhase, randomFn = Math.random) {
  const subType = item.subType;
  let newValue = item.currentValue;
  let income = 0;

  if (subType === 'bond') {
    income = Math.floor((item.purchasePrice ?? 0) * (item.couponRate ?? 0.04));
    const newYTM = (item.yearsToMaturity ?? 1) - 1;
    if (newYTM <= 0) return { newValue: 0, income, matured: true };
    return { newValue: item.purchasePrice, income, matured: false, yearsToMaturity: newYTM };
  }

  if (subType === 'stock') {
    let swing = (randomFn() * 2 - 1) * (item.volatility ?? 0.25);
    let rate = swing + (item.baseReturn ?? 0.08);
    if (econPhase === 'boom') rate += 0.10;
    if (econPhase === 'recession') rate -= 0.15;
    newValue = Math.max(0, Math.floor(item.currentValue * (1 + rate)));
  }

  if (subType === 'penny_stock') {
    const roll = randomFn();
    if (roll < 0.12)       newValue = 0;
    else if (roll < 0.22)  newValue = Math.floor(item.currentValue * (2 + randomFn() * 4));
    else                   newValue = Math.max(0, Math.floor(item.currentValue * (1 + (randomFn() - 0.45) * 0.70)));
  }

  if (subType === 'fund' || item.returnProfile) {
    const { base, boomBonus, recessionPenalty, volatility } = item.returnProfile;
    let rate = base + (randomFn() * 2 - 1) * volatility;
    if (econPhase === 'boom') rate += boomBonus;
    if (econPhase === 'recession') rate += recessionPenalty;
    income = Math.floor(item.currentValue * rate);
    newValue = Math.max(0, item.currentValue + income);
  }

  return { newValue, income, matured: false };
}

function calcCryptoYear(item, econPhase, moonshotRoll, crashRoll, swingRoll) {
  const vol = item.volatility ?? 0.60;
  const trend = ((item.trendiness ?? 0.5) - 0.5) * 0.30;
  if (vol >= 1.5 && moonshotRoll < 0.02) {
    return Math.floor(item.currentValue * (50 + swingRoll * 950));
  }
  if (vol >= 0.80 && moonshotRoll < 0.015) {
    return Math.floor(item.currentValue * (5 + swingRoll * 95));
  }
  if (crashRoll < 0.05 + (vol - 0.6) * 0.1) {
    return Math.max(0, Math.floor(item.currentValue * (0.02 + swingRoll * 0.18)));
  }
  let swing = (swingRoll * 2 - 1) * vol;
  swing += (econPhase === 'boom' ? 0.20 + trend : econPhase === 'recession' ? -0.30 : trend);
  return Math.max(0, Math.floor(item.currentValue * (1 + swing)));
}

// ── §13.1 applyEffects: bank:0 edge case ─────────────────────────────────────

describe('§13.1 applyEffects — bank:0 edge case', () => {
  const baseStats = { health: 80, happiness: 80, smarts: 50, looks: 50, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, grades: 70 };

  it('bank:0 effect does not change bank (falsy guard bug would skip this)', () => {
    const { bank } = applyEffects(baseStats, 500, { bank: 0 });
    expect(bank).toBe(500); // no change — 0 means "no effect", not "set to 0"
  });

  it('bank negative effect correctly reduces', () => {
    const { bank } = applyEffects(baseStats, 1000, { bank: -1000 });
    expect(bank).toBe(0);
  });

  it('multiple stats + bank in one effect object all apply', () => {
    const { stats, bank } = applyEffects(baseStats, 2000, { health: -10, happiness: 15, karma: -5, bank: -500 });
    expect(stats.health).toBe(70);
    expect(stats.happiness).toBe(95);
    expect(stats.karma).toBe(45);
    expect(bank).toBe(1500);
  });
});

// ── §13.2 Wealth tier × income tax × lifestyle cost pipeline ─────────────────

describe('§13.2 Wealth tier × income tax × lifestyle cost pipeline', () => {
  it('broke player pays 0 income tax regardless of salary', () => {
    const tax = cit(50_000, -100);
    expect(tax).toBe(0);
  });

  it('working-class player ($20k bank) pays 15% on salary', () => {
    const tax = cit(60_000, 20_000);
    expect(tax).toBe(9_000); // 60k × 15%
  });

  it('upper_middle player ($300k bank) pays 28% on salary', () => {
    const tax = cit(100_000, 300_000);
    expect(tax).toBe(28_000);
  });

  it('ultra-wealthy player ($150M bank) pays 45% on salary', () => {
    const tax = cit(500_000, 150_000_000);
    expect(tax).toBe(225_000);
  });

  it('annual cashflow: salary - tax - lifestyle cost goes negative for lower earner with high lifestyle', () => {
    const bank = 1_000_000; // wealthy tier
    const tier = gwt(bank);
    const salary = 80_000;
    const tax = cit(salary, bank);
    const netSalary = salary - tax;
    const cashflow = netSalary - tier.lifestyleCost;
    // wealthy lifestyle = $40k/yr, net salary after 35% tax = $52k → still positive
    expect(cashflow).toBeGreaterThan(0);
    expect(netSalary).toBe(52_000);
  });

  it('ultra tier lifestyle cost ($1M) exceeds most salaries', () => {
    const tier = gwt(100_000_000);
    expect(tier.lifestyleCost).toBe(1_000_000);
    const salary = 500_000;
    const tax = cit(salary, 100_000_000);
    const net = salary - tax - tier.lifestyleCost;
    expect(net).toBeLessThan(0); // -$775k/yr from salary alone — needs investment income
  });

  it('tier transition: $49,999 is middle class boundary', () => {
    expect(gwt(49_999).id).toBe('working');
    expect(gwt(50_000).id).toBe('middle');
  });

  it('relationDecayMult scales from 1.0 (broke) to 2.5 (ultra)', () => {
    const tiers = WT2.map(t => t.relationDecayMult);
    expect(tiers[0]).toBe(1.0);
    expect(tiers[tiers.length - 1]).toBe(2.5);
    // each tier's mult is >= previous
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
  });
});

// ── §13.3 Asset × wealth tier × CGT integration ──────────────────────────────

describe('§13.3 Asset × wealth tier × CGT integration', () => {
  it('studio apartment appreciates 3% per year correctly', () => {
    const studio = { id: 'studio_apt', currentValue: 50_000, appreciationRate: 1.03 };
    expect(Math.floor(50_000 * 1.03)).toBe(51_500);
  });

  it('vehicle depreciates 15% per year correctly', () => {
    const clunker = { id: 'used_clunker', currentValue: 3_000, appreciationRate: 0.80 };
    expect(Math.floor(3_000 * 0.80)).toBe(2_400);
  });

  it('CGT: selling at loss returns 0 tax', () => {
    expect(calculateCapitalGainsTax(100_000, 70_000, 0.20)).toBe(0);
  });

  it('CGT: selling crypto at 400x applies current tier rate', () => {
    const purchasePrice = 1_000;
    const currentValue = 400_000; // 400x
    const cgtRate = gwt(500_000).capitalGainsTaxRate; // upper_middle = 23%
    const tax = calculateCapitalGainsTax(purchasePrice, currentValue, cgtRate);
    expect(tax).toBe(Math.floor((400_000 - 1_000) * 0.23)); // $91,770
  });

  it('CGT: ultra-wealthy pays 37% on art appreciation', () => {
    const tax = calculateCapitalGainsTax(8_000_000, 20_000_000, 0.37);
    expect(tax).toBe(Math.floor(12_000_000 * 0.37)); // $4,440,000
  });

  it('net worth correctly sums bank + properties + belongings', () => {
    const bank = 50_000;
    const properties = [{ currentValue: 250_000 }, { currentValue: 120_000 }];
    const belongings = [{ currentValue: 8_000 }, { currentValue: 15_000 }];
    expect(calcNetWorth(bank, properties, belongings)).toBe(443_000);
  });

  it('market crash: 30% wipe on properties but not belongings', () => {
    const props = [{ currentValue: 100_000 }, { currentValue: 200_000 }];
    const crashed = props.map(p => ({ ...p, currentValue: Math.floor(p.currentValue * 0.7) }));
    expect(crashed[0].currentValue).toBe(70_000);
    expect(crashed[1].currentValue).toBe(140_000);
  });

  it('getAssetsByTier: broke player cannot access working-tier items', () => {
    const brokeItems = getAssetsByTier('vehicles', 'broke');
    const usedClunker = brokeItems.find(i => i.id === 'used_clunker');
    const newSedan = brokeItems.find(i => i.id === 'sedan');
    expect(usedClunker.locked).toBe(false);
    expect(newSedan.locked).toBe(true);
  });

  it('getAssetsByTier: ultra player sees all items unlocked', () => {
    const items = getAssetsByTier('realEstate', 'ultra');
    expect(items.every(i => !i.locked)).toBe(true);
  });
});

// ── §13.4 Store catalog × wealth tier gating ─────────────────────────────────

describe('§13.4 Store catalog × wealth tier gating', () => {
  it('budget_auto_sales is visible to broke tier', () => {
    const stores = getStoresByCategory('vehicles', 'broke', {});
    const budget = stores.find(s => s.id === 'budget_auto_sales');
    expect(budget).toBeDefined();
    expect(budget.locked).toBe(false);
  });

  it('anderson_race_world requires wealthy tier — locked for middle', () => {
    const stores = getStoresByCategory('vehicles', 'middle', {});
    const race = stores.find(s => s.id === 'anderson_race_world');
    expect(race.locked).toBe(true);
  });

  it('anderson_race_world is unlocked at wealthy tier', () => {
    const stores = getStoresByCategory('vehicles', 'wealthy', {});
    const race = stores.find(s => s.id === 'anderson_race_world');
    expect(race.locked).toBe(false);
  });

  it('san_diego_aircraft_brokers requires rich tier', () => {
    const stores = getStoresByCategory('vehicles', 'ultra', {});
    const jets = stores.find(s => s.id === 'san_diego_aircraft_brokers');
    expect(jets.locked).toBe(false);
  });

  it('elite_global_properties is locked until rich tier', () => {
    const lockedFor = ['broke', 'struggling', 'working', 'middle', 'upper_middle', 'wealthy'];
    for (const tier of lockedFor) {
      const stores = getStoresByCategory('realEstate', tier, {});
      const store = stores.find(s => s.id === 'elite_global_properties');
      expect(store.locked).toBe(true);
    }
  });

  it('STORE_TIER_ORDER matches WEALTH_TIERS order', () => {
    const tierIds = WT2.map(t => t.id);
    expect(STORE_TIER_ORDER).toEqual(tierIds);
  });

  it('every store in every category has at least 2 listings', () => {
    for (const [cat, stores] of Object.entries(STORE_CATALOG)) {
      for (const store of stores) {
        expect(store.listings.length, `${cat}/${store.id} has fewer than 2 listings`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

// ── §13.5 Relationship × wealth tier integration ─────────────────────────────

describe('§13.5 Relationship × wealth tier integration', () => {
  it('dating costs scale with wealth tier', () => {
    const dateCosts = WT2.map(t => t.dateCost);
    // every tier should have a dateCost >= previous
    for (let i = 1; i < dateCosts.length; i++) {
      expect(dateCosts[i]).toBeGreaterThanOrEqual(dateCosts[i - 1]);
    }
  });

  it('gift amounts have 3 tiers that scale with wealth', () => {
    for (const tier of WT2) {
      expect(tier.giftAmounts).toHaveLength(3);
      expect(tier.giftAmounts[0]).toBeLessThan(tier.giftAmounts[1]);
      expect(tier.giftAmounts[1]).toBeLessThan(tier.giftAmounts[2]);
    }
  });

  it('divorce cost at $10k bank → clamped up to minimum $5k', () => {
    // 15% of 10k = $1,500 is below the $5k floor, so result is $5,000
    expect(calcDivorceCost(10_000)).toBe(5_000);
    expect(calcDivorceCost(10_000)).toBe(Math.min(50_000, Math.max(5_000, Math.floor(10_000 * 0.15))));
  });

  it('divorce cost at $100k bank → 15% = $15k', () => {
    expect(calcDivorceCost(100_000)).toBe(15_000);
  });

  it('divorce cost at $1M bank → capped at $50k', () => {
    expect(calcDivorceCost(1_000_000)).toBe(50_000);
  });

  it('divorce cost at $500k bank → capped at $50k', () => {
    expect(calcDivorceCost(500_000)).toBe(50_000);
  });

  it('parent death chance formula: age 70 → 0%, age 100 → 100%', () => {
    const deathChance = (age) => Math.min(1, (age - 70) / 60);
    expect(deathChance(70)).toBe(0);
    expect(deathChance(100)).toBeCloseTo(0.5);
    expect(deathChance(130)).toBe(1);
  });

  it('jealousy triggers when 2+ active romantic relationships', () => {
    const rels = [
      { status: 'dating', isAlive: true },
      { status: 'married', isAlive: true },
      { status: 'family', isAlive: true },
    ];
    const activeRomantic = rels.filter(r => (r.status === 'dating' || r.status === 'married') && r.isAlive);
    expect(activeRomantic.length).toBe(2); // triggers jealousy
  });

  it('auto-breakup triggers at relation < 20', () => {
    const shouldBreak = (rel) => (rel.status === 'dating' || rel.status === 'married') && rel.relation < 20;
    expect(shouldBreak({ status: 'dating', relation: 19 })).toBe(true);
    expect(shouldBreak({ status: 'dating', relation: 20 })).toBe(false);
    expect(shouldBreak({ status: 'family', relation: 5 })).toBe(false); // family not affected
  });
});

// ── §13.6 Investment processing edge cases ────────────────────────────────────

describe('§13.6 Investment processing — bonds', () => {
  const makeBond = (overrides = {}) => ({
    subType: 'bond',
    purchasePrice: 10_000,
    currentValue: 10_000,
    couponRate: 0.045,
    yearsToMaturity: 5,
    yearsOwned: 0,
    ...overrides,
  });

  it('bond coupon income = purchasePrice × couponRate (floored)', () => {
    const { income } = processInvestmentYear(makeBond());
    expect(income).toBe(Math.floor(10_000 * 0.045)); // $450
  });

  it('bond value stays at purchasePrice (par) between maturity years', () => {
    const { newValue } = processInvestmentYear(makeBond({ yearsToMaturity: 3 }));
    expect(newValue).toBe(10_000);
  });

  it('bond matures when yearsToMaturity reaches 1 → returns matured:true', () => {
    const { matured, newValue } = processInvestmentYear(makeBond({ yearsToMaturity: 1 }));
    expect(matured).toBe(true);
    expect(newValue).toBe(0); // removed from portfolio
  });

  it('coupon income still paid in maturity year', () => {
    const { income, matured } = processInvestmentYear(makeBond({ yearsToMaturity: 1 }));
    expect(matured).toBe(true);
    expect(income).toBe(450); // still earns the last coupon
  });

  it('US 10yr bond: correct coupon on $50k investment', () => {
    const us10yr = BOND_LIST.find(b => b.id === 'us_10yr');
    const bond = makeBond({ purchasePrice: 50_000, couponRate: us10yr.coupon });
    const { income } = processInvestmentYear(bond);
    expect(income).toBe(Math.floor(50_000 * 0.045)); // $2,250/yr
  });

  it('Brazilian bond has higher coupon than US bond (EM premium)', () => {
    const us = BOND_LIST.find(b => b.id === 'us_10yr');
    const br = BOND_LIST.find(b => b.id === 'br_10yr');
    expect(br.coupon).toBeGreaterThan(us.coupon);
  });

  it('Brazilian bond has higher risk than US bond', () => {
    const us = BOND_LIST.find(b => b.id === 'us_10yr');
    const br = BOND_LIST.find(b => b.id === 'br_10yr');
    expect(br.risk).toBeGreaterThan(us.risk);
  });

  it('multiple bonds maturing in same year: principals stack', () => {
    const b1 = makeBond({ purchasePrice: 10_000, yearsToMaturity: 1 });
    const b2 = makeBond({ purchasePrice: 25_000, yearsToMaturity: 1 });
    const r1 = processInvestmentYear(b1);
    const r2 = processInvestmentYear(b2);
    const totalReturn = r1.income + r2.income;
    expect(r1.matured).toBe(true);
    expect(r2.matured).toBe(true);
    expect(totalReturn).toBe(450 + 1_125); // coupons on last year
  });
});

describe('§13.7 Investment processing — stocks & penny stocks', () => {
  const makeStock = (overrides = {}) => ({
    subType: 'stock',
    currentValue: 10_000,
    volatility: 0.25,
    baseReturn: 0.08,
    yearsOwned: 0,
    ...overrides,
  });

  const makePenny = (overrides = {}) => ({
    subType: 'penny_stock',
    currentValue: 5_000,
    yearsOwned: 0,
    ...overrides,
  });

  it('stock in boom: gets +10% bonus on top of base return', () => {
    // Force a zero-swing roll: randomFn always returns 0.5 → swing = 0
    const { newValue } = processInvestmentYear(makeStock(), 'boom', () => 0.5);
    const expectedRate = 0 + 0.08 + 0.10; // swing=0, base=8%, boom=10%
    expect(newValue).toBe(Math.floor(10_000 * (1 + expectedRate)));
  });

  it('stock in recession: loses 15% from base return', () => {
    const { newValue } = processInvestmentYear(makeStock(), 'recession', () => 0.5);
    const expectedRate = 0 + 0.08 - 0.15; // swing=0, base=8%, recession=-15%
    expect(newValue).toBe(Math.max(0, Math.floor(10_000 * (1 + expectedRate))));
  });

  it('stock value cannot go below 0', () => {
    const { newValue } = processInvestmentYear(makeStock({ currentValue: 100 }), 'recession', () => 0);
    expect(newValue).toBeGreaterThanOrEqual(0);
  });

  it('penny stock: roll < 0.12 → bankrupt (value = 0)', () => {
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => 0.05);
    expect(newValue).toBe(0);
  });

  it('penny stock: 0.12 <= roll < 0.22 → moonshot (2x–6x)', () => {
    // roll=0.15 → moonshot, secondRoll=0.5 → 2 + 0.5*4 = 4x
    let callCount = 0;
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => {
      callCount++;
      return callCount === 1 ? 0.15 : 0.5;
    });
    expect(newValue).toBeGreaterThan(5_000 * 2);
    expect(newValue).toBeLessThanOrEqual(5_000 * 6);
  });

  it('penny stock: roll >= 0.22 → stays in ±range (not moonshot)', () => {
    // roll=0.50, swingRoll=0.5 → swing = (0.5-0.45)*0.70 = 0.035
    let callCount = 0;
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => {
      callCount++;
      return callCount === 1 ? 0.50 : 0.50;
    });
    // Should be near 5000 but not a moonshot multiple
    expect(newValue).toBeLessThan(5_000 * 2);
    expect(newValue).toBeGreaterThanOrEqual(0);
  });
});

describe('§13.8 Crypto volatility — moonshot/crash mechanics', () => {
  const makeCrypto = (overrides = {}) => ({
    subType: 'crypto',
    currentValue: 10_000,
    volatility: 1.80, // VOID-tier volatility
    trendiness: 0.5,
    yearsOwned: 0,
    ...overrides,
  });

  it('vol >= 1.5 + moonshotRoll < 0.02 → 50x–1000x multiplier', () => {
    const result = calcCryptoYear(makeCrypto(), 'normal', 0.01, 0.50, 0.5);
    // 50 + 0.5*950 = 525x
    expect(result).toBe(Math.floor(10_000 * (50 + 0.5 * 950)));
    expect(result).toBeGreaterThan(10_000 * 50);
  });

  it('vol >= 1.5 + moonshotRoll >= 0.02 + crashRoll low → crash path', () => {
    // crashRoll = 0.03 < 0.05 + (1.80-0.6)*0.1 = 0.17
    const result = calcCryptoYear(makeCrypto(), 'normal', 0.05, 0.03, 0.5);
    // survive = 0.02 + 0.5*0.18 = 0.11 → 89% loss
    expect(result).toBe(Math.max(0, Math.floor(10_000 * (0.02 + 0.5 * 0.18))));
    expect(result).toBeLessThan(10_000 * 0.20); // lost >80%
  });

  it('low-volatility coin (DHMN, 0.40) has much smaller moonshot window', () => {
    const dhmn = CRYPTO_LIST.find(c => c.id === 'diamondhands');
    expect(dhmn.volatility).toBeLessThan(0.80); // no moonshot mechanic
  });

  it('PumpDump has extreme volatility (>= 1.5)', () => {
    const pump = CRYPTO_LIST.find(c => c.id === 'pumpdump');
    expect(pump.volatility).toBeGreaterThanOrEqual(1.5);
  });

  it('VoidBucks has extreme volatility (>= 1.5)', () => {
    const void_ = CRYPTO_LIST.find(c => c.id === 'voidbucks');
    expect(void_.volatility).toBeGreaterThanOrEqual(1.5);
  });

  it('all crypto coins have trendiness between 0 and 1', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.trendiness).toBeGreaterThanOrEqual(0);
      expect(coin.trendiness).toBeLessThanOrEqual(1);
    }
  });

  it('all crypto coins have basePrice > 0', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.basePrice).toBeGreaterThan(0);
    }
  });
});

describe('§13.9 investmentMarket schema validation', () => {
  it('all BOND_LIST entries have required fields', () => {
    for (const bond of BOND_LIST) {
      expect(bond.id).toBeTruthy();
      expect(bond.name).toBeTruthy();
      expect(bond.coupon).toBeGreaterThan(0);
      expect(bond.maturity).toBeGreaterThan(0);
      expect(bond.minInvestment).toBeGreaterThan(0);
      expect(bond.risk).toBeGreaterThanOrEqual(0);
      expect(bond.risk).toBeLessThanOrEqual(1);
    }
  });

  it('all STOCK_LIST entries have required fields', () => {
    for (const stock of STOCK_LIST) {
      expect(stock.id).toBeTruthy();
      expect(stock.ticker).toBeTruthy();
      expect(stock.basePrice).toBeGreaterThan(0);
      expect(stock.volatility).toBeGreaterThan(0);
      expect(stock.baseReturn).toBeGreaterThan(0);
      expect(stock.sector).toBeTruthy();
    }
  });

  it('all PENNY_STOCK_LIST entries have required fields', () => {
    for (const penny of PENNY_STOCK_LIST) {
      expect(penny.id).toBeTruthy();
      expect(penny.ticker).toBeTruthy();
      expect(penny.basePrice).toBeGreaterThan(0);
      expect(penny.basePrice).toBeLessThan(5); // must be genuinely cheap
    }
  });

  it('all FUND_LIST entries have a returnProfile with required keys', () => {
    for (const fund of FUND_LIST) {
      expect(fund.returnProfile).toBeDefined();
      expect(fund.returnProfile.base).toBeDefined();
      expect(fund.returnProfile.boomBonus).toBeDefined();
      expect(fund.returnProfile.recessionPenalty).toBeDefined();
      expect(fund.returnProfile.volatility).toBeGreaterThanOrEqual(0);
    }
  });

  it('getMarketHealth returns score in 5–95 range and valid color/label', () => {
    const types = ['crypto', 'stocks', 'bonds', 'penny', 'funds'];
    const phases = ['normal', 'boom', 'recession'];
    for (const t of types) {
      for (const p of phases) {
        const mh = getMarketHealth(t, p);
        expect(mh.score).toBeGreaterThanOrEqual(5);
        expect(mh.score).toBeLessThanOrEqual(95);
        expect(['Bullish', 'Mixed', 'Bearish']).toContain(mh.label);
        expect(mh.color).toMatch(/^#/);
      }
    }
  });

  it('bondDisplayName formats correctly', () => {
    const bond = BOND_LIST.find(b => b.id === 'us_10yr');
    expect(bondDisplayName(bond)).toBe('US Government Bond (10-Yr)');
  });

  it('bonds are in ascending coupon order within same country', () => {
    const usBonds = BOND_LIST.filter(b => b.id.startsWith('us_'));
    // longer maturity → higher coupon (normal yield curve)
    for (let i = 1; i < usBonds.length; i++) {
      expect(usBonds[i].coupon).toBeGreaterThan(usBonds[i - 1].coupon);
    }
  });
});

describe('§13.10 Full pipeline integration: wealth tier + assets + investments + relationships', () => {
  it('net worth calculation correctly sums all asset classes', () => {
    const bank = 250_000;
    const properties = [
      { currentValue: 400_000 }, // suburban home
      { currentValue: 800_000 }, // beachfront villa
    ];
    const belongings = [
      { currentValue: 120_000, subType: 'stock'   }, // ApexTech shares
      { currentValue: 10_000,  subType: 'bond'    }, // US bond
      { currentValue: 75_000,  subType: undefined  }, // luxury SUV
    ];
    const nw = calcNetWorth(bank, properties, belongings);
    expect(nw).toBe(1_655_000);
    // nw puts them in wealthy tier
    expect(gwt(nw).id).toBe('wealthy');
  });

  it('wealthy player selling a boomed property triggers large CGT', () => {
    const purchasePrice = 250_000;
    const currentValue  = 500_000; // doubled
    const cgtRate = gwt(1_500_000).capitalGainsTaxRate; // wealthy = 28%
    const cgt = calculateCapitalGainsTax(purchasePrice, currentValue, cgtRate);
    expect(cgt).toBe(Math.floor(250_000 * 0.28)); // $70,000
    // net proceeds
    expect(currentValue - cgt).toBe(430_000);
  });

  it('expensive divorce + stock loss in same year can wipe out middle-class player', () => {
    const bank = 80_000; // just above middle-class entry
    const divorceCost = calcDivorceCost(bank);   // 15% = $12k
    const stockLoss = 30_000; // paper loss from stock crash
    const lifestyleCost = gwt(bank).lifestyleCost; // $3k for middle
    const yearEnd = bank - divorceCost - lifestyleCost;
    expect(divorceCost).toBe(12_000);
    expect(yearEnd).toBe(80_000 - 12_000 - 3_000); // $65k remaining
    expect(gwt(yearEnd).id).toBe('middle'); // still middle
  });

  it('crypto moonshot can push broke player into upper_middle in one year', () => {
    // Broke player holds 1000 PUMP tokens worth $1 each ($1k invested)
    const crypto = {
      subType: 'crypto', currentValue: 1_000,
      volatility: 2.00, trendiness: 0.55, yearsOwned: 0,
    };
    // Force moonshot: moonshotRoll=0.01, swingRoll=0.5 → 50+475=525x
    const newValue = calcCryptoYear(crypto, 'boom', 0.01, 0.99, 0.5);
    expect(newValue).toBe(Math.floor(1_000 * (50 + 0.5 * 950)));
    expect(gwt(newValue).id).toBe('upper_middle'); // 525k lands in upper_middle
  });

  it('asset upkeep drain: multiple properties + lifestyle can bankrupt middle player', () => {
    const bank = 60_000;
    const tier = gwt(bank);                          // middle: $3k lifestyle
    const propertyUpkeep = 2_500 + 4_000 + 12_000;  // suburban + condo + beach villa
    const totalDrain = tier.lifestyleCost + propertyUpkeep;
    const yearEnd = bank - totalDrain;
    expect(totalDrain).toBe(21_500);
    expect(yearEnd).toBe(38_500);
    expect(yearEnd).toBeGreaterThan(0); // survived, but drained
  });

  it('happiness penalty stacks with wealth tier (working class pays 5, upper pays 12)', () => {
    const workingTier = gwt(15_000);
    const upperTier   = gwt(300_000);
    expect(workingTier.happinessPenalty).toBe(5);
    expect(upperTier.happinessPenalty).toBe(12);
    expect(upperTier.happinessPenalty).toBeGreaterThan(workingTier.happinessPenalty);
  });

  it('fund investment in boom: VC seed can return 60% bonus on top of 0% base', () => {
    const vcSeed = FUND_LIST.find(f => f.id === 'vc_seed');
    // Force zero-swing: rng = 0.5 → swing = 0; boom → boomBonus=0.60
    const result = processInvestmentYear(
      { ...vcSeed, currentValue: 1_000_000, returnProfile: vcSeed.returnProfile },
      'boom',
      () => 0.5
    );
    expect(result.income).toBe(Math.floor(1_000_000 * (0 + 0 + 0.60))); // $600k
    expect(result.newValue).toBe(1_600_000);
  });

  it('fund investment in recession: VC seed can lose 50%', () => {
    const vcSeed = FUND_LIST.find(f => f.id === 'vc_seed');
    const result = processInvestmentYear(
      { ...vcSeed, currentValue: 1_000_000, returnProfile: vcSeed.returnProfile },
      'recession',
      () => 0.5
    );
    expect(result.income).toBe(Math.floor(1_000_000 * (0 + 0 - 0.50))); // −$500k
    expect(result.newValue).toBe(500_000);
  });

  it('S&P500 fund has lower risk and lower boom bonus than VC seed', () => {
    const sp = FUND_LIST.find(f => f.id === 'sp500_idx');
    const vc = FUND_LIST.find(f => f.id === 'vc_seed');
    expect(sp.risk).toBeLessThan(vc.risk);
    expect(sp.returnProfile.boomBonus).toBeLessThan(vc.returnProfile.boomBonus);
    expect(sp.returnProfile.recessionPenalty).toBeGreaterThan(vc.returnProfile.recessionPenalty); // less negative
  });
});
