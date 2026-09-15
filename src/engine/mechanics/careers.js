/** Game rules extracted from the state owner; keep runtime behavior here testable. */
import { calculateIncomeTax } from '../../config/wealthTiers';
import { hasRequiredDegree, DEGREE_LABELS } from './education';

export const HEADHUNTER_COST = 1000;

/** Single source of truth for Launch Tech Startup — charged only inside startStartup(). */
export const STARTUP_COST = 500;

export const MILITARY_ENLIST_CAREER_ID = 'soldier';

export function canAffordHeadhunter(bank, cost = HEADHUNTER_COST) {
  return (bank ?? 0) >= cost;
}

/** Pure startup launch math — exactly one STARTUP_COST deduction and no founder reset. */
export function computeStartupLaunch(bank, currentCareer = null, cost = STARTUP_COST) {
  if (currentCareer?.id === 'founder') return { ok: false, reason: 'already_founder' };
  if ((bank ?? 0) < cost) return { ok: false, reason: 'insufficient_funds' };
  return {
    ok: true,
    newBank: bank - cost,
    career: { id: 'founder', title: 'Startup Founder', salary: 0, type: 'business', equity: 500 },
    cost,
  };
}

/** Convert catalog stress intensity into a bounded yearly stat delta. */
export function normalizeCareerEffect(effect) {
  if (!Number.isFinite(effect) || effect === 0) return 0;
  return Math.sign(effect) * Math.max(1, Math.ceil(Math.abs(effect) / 8));
}

export function applyCareerYearEffects(stats, career) {
  if (!career || career.id === 'founder') return { ...stats };
  return {
    ...stats,
    happiness: Math.min(100, Math.max(0, (stats.happiness ?? 0) + normalizeCareerEffect(career.happinessEffect))),
    health: Math.min(100, Math.max(0, (stats.health ?? 0) + normalizeCareerEffect(career.healthEffect))),
  };
}

/** Highest-salary eligible full-time career for headhunter placement. */
export function pickHeadhunterPlacement(careersData, { age, education, stats, networking }) {
  const list = (careersData ?? [])
    .filter((c) => c.type === 'full_time')
    .filter((c) => {
      if (age < (c.minAge ?? 0)) return false;
      if (!hasRequiredDegree(education, c.requiresDegree)) return false;
      if ((c.requiresNetworking ?? 0) > (networking ?? 0)) return false;
      for (const [stat, min] of Object.entries(c.statRequirements ?? {})) {
        if ((stats?.[stat] ?? 0) < min) return false;
      }
      return true;
    })
    .sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0));
  return list[0] ?? null;
}

/**
 * One founder equity year with injectable randomness. Non-founder careers pass
 * through unchanged. A career of null means the startup folded (the hook
 * applies the happiness penalty and history text).
 */
export function applyStartupYear(career, randomValue) {
  if (!career || career.id !== 'founder') return { career, outcome: null, dividend: 0 };
  let newEquity = career.equity;
  let outcome;
  if (randomValue < 0.2) {
    newEquity = 0;
    outcome = 'bankrupt';
  } else if (randomValue < 0.5) {
    newEquity = Math.floor(newEquity * 0.8);
    outcome = 'downturn';
  } else if (randomValue < 0.8) {
    newEquity = Math.floor(newEquity * 1.5);
    outcome = 'steady';
  } else {
    newEquity = Math.floor(newEquity * 3);
    outcome = 'moonshot';
  }
  if (newEquity === 0) return { career: null, outcome, dividend: 0 };
  const dividend = Math.floor(newEquity * 0.1);
  return { career: { ...career, equity: newEquity, salary: dividend }, outcome, dividend };
}

/**
 * One salaried career year: city-adjusted gross, income tax, and the career's
 * own stat effects. Founder equity is handled by applyStartupYear instead, and
 * a null/founder career is a no-op. The hook composes the history text.
 */
export function computeCareerYearIncome(career, stats, bank, salaryMultiplier = 1) {
  if (!career || career.id === 'founder') {
    return { stats, bank, grossSalary: 0, tax: 0, netSalary: 0 };
  }
  const multiplier = Number.isFinite(salaryMultiplier) ? salaryMultiplier : 1;
  const grossSalary = Math.round((career.salary ?? 0) * multiplier);
  const tax = calculateIncomeTax(grossSalary, bank);
  const netSalary = grossSalary - tax;
  let newStats = applyCareerYearEffects(stats, career);
  if (career.smarts_gain) {
    newStats = { ...newStats, smarts: Math.min(100, newStats.smarts + career.smarts_gain) };
  }
  return { stats: newStats, bank: bank + netSalary, grossSalary, tax, netSalary };
}

/** Deterministic review score; the annual simulation does not roll randomness. */
export function computePerformanceReviewRoll(stats, networking, isOnPIP, financialStressFlag, economy) {
  let roll = 0.5;
  roll += Math.min(0.10, ((stats.smarts  - 50) / 10) * 0.02);
  roll += Math.min(0.06, ((stats.health  - 50) / 10) * 0.02);
  roll += Math.min(0.05, ((stats.karma   - 50) / 10) * 0.01);
  roll += Math.min(0.10, (networking / 20) * 0.02);
  if (isOnPIP)             roll -= 0.05;
  if (financialStressFlag) roll -= 0.10;
  if (economy?.phase === 'boom')      roll += 0.05;
  if (economy?.phase === 'recession') roll -= 0.05;
  return roll;
}

export function runPerformanceReview(currentStats, currentCareer, currentMeta, currentNetworking, currentEconomy, rollOverride) {
  const roll = rollOverride ?? computePerformanceReviewRoll(currentStats, currentNetworking, currentMeta.isOnPIP, currentMeta.financialStressFlag, currentEconomy);

  let outcome;
  if (roll < 0.10)      outcome = 'fired';
  else if (roll < 0.25) outcome = 'pip';
  else if (roll < 0.55) outcome = 'no_change';
  else if (roll < 0.85) outcome = 'raise';
  else                  outcome = 'promoted';

  if (currentEconomy?.phase === 'recession' && roll < 0.15) outcome = 'fired';
  if (currentEconomy?.phase === 'boom' && outcome === 'fired' && roll >= 0.12) outcome = 'pip';

  let newCareer = { ...currentCareer };
  let setIsOnPIP = false;
  let unemploymentYears = 0;
  let newFinancialStressFlag = currentMeta.financialStressFlag ?? false;

  if (outcome === 'promoted') {
    if (!currentCareer.nextTierId) {
      outcome = 'raise';
    } else {
      const reqs = currentCareer.promotionRequirements ?? {};
      const meetsReqs = (
        (currentMeta.yearsInRole >= (reqs.minYearsInRole ?? 0)) &&
        (currentStats.smarts >= (reqs.minSmarts ?? 0)) &&
        (currentStats.health >= (reqs.minHealth ?? 0)) &&
        (currentStats.karma  >= (reqs.minKarma  ?? 0))
      );
      if (!meetsReqs) outcome = 'raise';
    }
  }

  if (outcome === 'raise') {
    newCareer = { ...currentCareer, salary: Math.round(currentCareer.salary * 1.05) };
  } else if (outcome === 'pip') {
    setIsOnPIP = true;
    newCareer = { ...currentCareer };
  } else if (outcome === 'fired') {
    newCareer = null;
    unemploymentYears = 2;
    newFinancialStressFlag = true;
  }

  const texts = {
    promoted:  `Career: Outstanding performance — you've been promoted! Your manager wants to discuss next steps.`,
    raise:     `Career: Good performance. You received a 5% salary raise ($${Math.round(currentCareer.salary * 0.05).toLocaleString()}).`,
    no_change: `Career: Satisfactory year. No change in compensation.`,
    pip:       `Career: Your manager placed you on a Performance Improvement Plan. Shape up.`,
    fired:     `Career: You were let go. Your position has been eliminated. Unemployment benefits activated.`,
  };

  return { outcome, newCareer, setIsOnPIP, unemploymentYears, newFinancialStressFlag, historyText: texts[outcome],
    statEffects: { happiness: outcome === 'pip' ? -10 : outcome === 'fired' ? -30 : 0 } };
}

export function checkCareerEligibility(career, education, stats, networking, age) {
  if (age < career.minAge) return { eligible: false, reason: `Requires age ${career.minAge}+` };
  if (!hasRequiredDegree(education, career.requiresDegree)) {
    return { eligible: false, reason: `Requires ${DEGREE_LABELS[career.requiresDegree]}` };
  }
  const netReq = career.requiresNetworking ?? 0;
  if (networking < netReq) return { eligible: false, reason: `Requires Networking ${netReq}+` };
  for (const [stat, min] of Object.entries(career.statRequirements ?? {})) {
    if ((stats[stat] ?? 0) < min) return { eligible: false, reason: `Requires ${stat} ${min}+` };
  }
  return { eligible: true, reason: '' };
}
