/** Game rules extracted from the state owner; keep runtime behavior here testable. */
import { getWealthTier } from '../../config/wealthTiers';

/**
 * Yearly lifestyle upkeep expected of the player's wealth tier, scaled by the
 * city's cost of living. Falling into debt costs the tier's happiness penalty.
 */
export function computeLifestyleCost(bank, stats, colMultiplier = 1) {
  const tier = getWealthTier(bank);
  if (!(tier.lifestyleCost > 0)) {
    return { bank, stats, cost: 0, tier, inDebt: false };
  }
  const multiplier = Number.isFinite(colMultiplier) ? colMultiplier : 1;
  const cost = Math.round(tier.lifestyleCost * multiplier);
  const newBank = bank - cost;
  const inDebt = newBank < 0;
  return {
    bank: newBank,
    stats: inDebt
      ? { ...stats, happiness: Math.max(0, stats.happiness - tier.happinessPenalty) }
      : stats,
    cost,
    tier,
    inDebt,
  };
}

/** Fixed normal → boom → recession cycle. */
export function processEconomyCycle(cycle) {
  const PHASE_DURATIONS = { normal: 3, boom: 2, recession: 2 };
  const phaseTransitions = { normal: 'boom', boom: 'recession', recession: 'normal' };
  const newYearsInPhase = cycle.yearsInPhase + 1;
  return newYearsInPhase >= PHASE_DURATIONS[cycle.phase]
    ? { year: cycle.year + 1, phase: phaseTransitions[cycle.phase], yearsInPhase: 0 }
    : { year: cycle.year + 1, phase: cycle.phase, yearsInPhase: newYearsInPhase };

}
