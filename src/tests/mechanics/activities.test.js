/** activities mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { yearlyActivityTrackId, canConsumeYearlyActivity } from '../../engine/mechanics/activities';
import { applyEffectsPure } from '../../engine/mechanics/life';

// Legacy test-only helpers below are migration targets, not production exports.
function checkActivityGuard(guard, stats) {
  if (!guard) return { allowed: true, reason: '' };
  const actual = stats[guard.stat] ?? 0;
  if (guard.op === 'gte' && actual < guard.value)
    return { allowed: false, reason: `Requires ${guard.stat} ${guard.value}+` };
  if (guard.op === 'lte' && actual > guard.value)
    return { allowed: false, reason: `Requires ${guard.stat} ${guard.value} or lower` };
  return { allowed: true, reason: '' };
}

function applyActivityCost(bank, cost) {
  const c = cost ?? 0;
  if (bank < c) return { newBank: bank, canAfford: false };
  return { newBank: bank - c, canAfford: true };
}

// Signature adapter to the real event/activity effects implementation.
function resolveActivityEffects(stats, baseEffects) {
  return applyEffectsPure(stats, 0, [], baseEffects).stats;
}

// Translate legacy test ids into the engine's category/item tracking key.
function checkYearlyLimit(item, activitiesThisYear) {
  const counts = { [yearlyActivityTrackId('test', item.id)]: activitiesThisYear[item.id] };
  return !canConsumeYearlyActivity(counts, 'test', item.id, item.yearlyLimit);
}

describe('trainHiddenSkill (legacy mirror)', () => {
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

describe('yearly activity limits', () => {
  it('builds stable track ids for gym/run', () => {
    expect(yearlyActivityTrackId('mind_body', 'Go to the Gym')).toBe('mind_body__Go to the Gym');
    expect(yearlyActivityTrackId('mind_body', 'Go for a Run')).toBe('mind_body__Go for a Run');
  });

  it('blocks when yearlyLimit is reached', () => {
    const used = { 'mind_body__Go to the Gym': 1 };
    expect(canConsumeYearlyActivity(used, 'mind_body', 'Go to the Gym', 1)).toBe(false);
    expect(canConsumeYearlyActivity(used, 'mind_body', 'Go for a Run', 1)).toBe(true);
    expect(canConsumeYearlyActivity({}, 'mind_body', 'Go to the Gym', 1)).toBe(true);
  });
});

describe('checkActivityGuard (legacy mirror)', () => {
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

describe('applyActivityCost (legacy mirror)', () => {
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

describe('activity cost + guard integration (legacy mirror)', () => {
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
