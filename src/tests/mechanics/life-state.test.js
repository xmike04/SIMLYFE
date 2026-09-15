/** life state mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { applyEffectsPure, checkDeathPure, applyAgeUpDegradation, generateInitialStats } from '../../engine/mechanics/life';
import { buildLifeSave, LIFE_SAVE_KEYS } from '../../engine/lifeSave';
import { computeGradesDrift } from '../../engine/mechanics/education';
import { applyEffects } from './support/adapters.js';

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

describe('checkDeath', () => {
  const healthyStats = { health: 80 };
  const deadStats = { health: 0 };
  const lowHealth = { health: 1 };

  it('dies when health is exactly 0', () => {
    expect(checkDeathPure(deadStats, 30, 0.5)).toBe(true);
  });

  it('dies when health is negative (defensive)', () => {
    expect(checkDeathPure({ health: -5 }, 30, 0.5)).toBe(true);
  });

  it('does not die before age 60 with full health', () => {
    expect(checkDeathPure(healthyStats, 59, 0.999)).toBe(false);
  });

  it('0% death chance at exactly age 60 (base = 60, chance = 0)', () => {
    // (60 - 60) / 40 = 0 → no random death at 60
    expect(checkDeathPure(healthyStats, 60, 0.0001)).toBe(false);
  });

  it('25% death chance at age 70', () => {
    // (70 - 60) / 40 = 0.25
    expect(checkDeathPure(healthyStats, 70, 0.24)).toBe(true);
    expect(checkDeathPure(healthyStats, 70, 0.26)).toBe(false);
  });

  it('50% death chance at age 80', () => {
    expect(checkDeathPure(healthyStats, 80, 0.49)).toBe(true);
    expect(checkDeathPure(healthyStats, 80, 0.51)).toBe(false);
  });

  it('guaranteed death at age 100', () => {
    // (100 - 60) / 40 = 1.0
    expect(checkDeathPure(healthyStats, 100, 0.9999)).toBe(true);
  });

  it('low health at age 59 does NOT cause random death before 60', () => {
    expect(checkDeathPure(lowHealth, 59, 0.0)).toBe(false);
  });
});

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

describe('startLife initial state', () => {
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

describe('buildLifeSave', () => {
  it('always includes every persisted life key', () => {
    const save = buildLifeSave({});
    for (const key of LIFE_SAVE_KEYS) {
      expect(save).toHaveProperty(key);
    }
    expect(Object.keys(save).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
  });

  it('reset payload clears character, death, career, and pets', () => {
    const save = buildLifeSave({ character: null, isDead: false });
    expect(save.character).toBeNull();
    expect(save.isDead).toBe(false);
    expect(save.career).toBeNull();
    expect(save.pets).toEqual([]);
    expect(save.relationships).toEqual([]);
    expect(save.belongings).toEqual([]);
    expect(save.properties).toEqual([]);
    expect(save.history).toEqual([]);
    expect(save.bank).toBe(0);
    expect(save.age).toBe(0);
  });

  it('new-life payload explicitly wipes career and pets', () => {
    const character = { name: 'Ada', gender: 'Female', country: 'USA', city: null };
    const stats = { health: 90, happiness: 85, smarts: 50, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 };
    const history = [{ age: 0, text: 'Born.' }];
    const relationships = [{ id: 'm', type: 'Mother' }];
    const save = buildLifeSave({
      character,
      age: 0,
      stats,
      bank: 0,
      history,
      isDead: false,
      flags: [],
      career: null,
      relationships,
      belongings: [],
      properties: [],
      networking: 0,
      pets: [],
    });
    expect(save.character).toEqual(character);
    expect(save.isDead).toBe(false);
    expect(save.career).toBeNull();
    expect(save.pets).toEqual([]);
    expect(save.relationships).toEqual(relationships);
    expect(save.history).toEqual(history);
  });

  it('explicit nulls overwrite leftover prior-life fields', () => {
    // Simulates replace write after a life that had career + pets in cloud
    const save = buildLifeSave({
      character: { name: 'Bob', gender: 'Male', country: 'USA', city: null },
      career: null,
      pets: [],
      isDead: false,
    });
    expect(save.career).toBeNull();
    expect(save.pets).toEqual([]);
    expect(save.isDead).toBe(false);
  });
});

describe('applyEffectsPure', () => {
  it('applies bank and clamped stats', () => {
    const { stats, bank, flags } = applyEffectsPure(
      { health: 50, happiness: 50, smarts: 50, looks: 50, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, grades: 70 },
      1000,
      [],
      { health: 10, bank: -100, flags: ['x'] }
    );
    expect(stats.health).toBe(60);
    expect(bank).toBe(900);
    expect(flags).toEqual(['x']);
  });
});

describe('persistLife payload merge', () => {
  it('buildLifeSave merges overrides over a snapshot without dropping bank', () => {
    const snapshot = buildLifeSave({
      character: { name: 'A', gender: 'Female', country: 'USA', city: null },
      bank: 5000,
      history: [{ age: 1, text: 'Hi' }],
      career: { id: 'dev', title: 'Dev' },
      pets: [{ id: 'p1' }],
    });
    const merged = buildLifeSave({
      ...snapshot,
      history: [...snapshot.history, { age: 1, text: 'Event choice' }],
      bank: 4900,
    });
    expect(merged.bank).toBe(4900);
    expect(merged.career?.id).toBe('dev');
    expect(merged.pets).toHaveLength(1);
    expect(merged.history).toHaveLength(2);
    for (const key of LIFE_SAVE_KEYS) {
      expect(merged).toHaveProperty(key);
    }
  });
});

describe('computeGradesDrift', () => {
  it('high smarts (>70) increases grades by 2', () => {
    expect(computeGradesDrift(80, 75)).toBe(82);
  });

  it('low smarts (<40) decreases grades by 5', () => {
    expect(computeGradesDrift(80, 35)).toBe(75);
  });

  it('average smarts (40-70) decreases grades by 1', () => {
    expect(computeGradesDrift(80, 55)).toBe(79);
  });

  it('grades clamped to 100 on max', () => {
    expect(computeGradesDrift(99, 75)).toBe(100);
  });

  it('grades clamped to 0 on min', () => {
    expect(computeGradesDrift(3, 35)).toBe(0);
  });

  it('defaults grades to 70 if undefined', () => {
    expect(computeGradesDrift(undefined, 75)).toBe(72);
  });

  it('an earned grade of 0 stays 0 — never bounces back to the 70 default', () => {
    expect(computeGradesDrift(0, 75)).toBe(2);
    expect(computeGradesDrift(0, 35)).toBe(0);
  });
});
