/** Game rules extracted from the state owner; keep runtime behavior here testable. */

export const EFFECT_STAT_KEYS = ['health', 'happiness', 'smarts', 'looks', 'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades'];

/** Pure apply of event/activity effects — used by handleChoice + tests. */
export function applyEffectsPure(stats, bank, flags, effects = {}) {
  const newStats = { ...stats };
  for (const key of EFFECT_STAT_KEYS) {
    if (effects[key] != null) {
      newStats[key] = Math.min(100, Math.max(0, (newStats[key] ?? 0) + effects[key]));
    }
  }
  const newBank = bank + (effects.bank ?? 0);
  const newFlags = effects.flags
    ? [...new Set([...(flags ?? []), ...effects.flags])]
    : (flags ?? []);
  return { stats: newStats, bank: newBank, flags: newFlags };
}

/** Death check with injectable randomness — the hook's checkDeath supplies Math.random(). */
export function checkDeathPure(stats, age, randomValue) {
  if (stats.health <= 0) return true;
  if (age >= 60) {
    const chance = (age - 60) / 40; // 0% at 60, 100% at 100
    return randomValue < chance;
  }
  return false;
}

/** Yearly aging wear: −1 health after 30; a further −2 health and −1 looks after 50. */
export function applyAgeUpDegradation(stats, age) {
  const next = { ...stats };
  if (age > 30) next.health = Math.max(0, next.health - 1);
  if (age > 50) {
    next.health = Math.max(0, next.health - 2);
    next.looks = Math.max(0, next.looks - 1);
  }
  return next;
}

/** Newborn stat roll — used by startLife and tested directly. */
export function generateInitialStats() {
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
