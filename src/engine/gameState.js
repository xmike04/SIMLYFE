import { useState, useCallback, useEffect, useRef } from 'react';
import { generateDynamicEvent } from './llmService';
import { getWealthTier, calculateIncomeTax } from '../config/wealthTiers';
import { calculateCapitalGainsTax, estimateInvestmentReturn, getAllAssets } from '../config/assetCatalog';
import { PET_CATALOG } from '../config/petCatalog.js';
import { getCityById } from '../config/cityData.js';
import {
  createDiagnosticId,
  diagnosticNow,
  emitDiagnostic,
  emitLlmDiagnostic,
  getDiagnosticStateFields,
  getErrorClass,
} from './diagnostics';
import { validateHydratedSave } from './stateValidation';
import { setFirebaseIdTokenProvider } from './firebaseToken';

import staticCareers from './careers.json';

const INITIAL_STATS = { health: 80, happiness: 80, smarts: 50, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 };
const MATERNAL_NAMES = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"];
const PATERNAL_NAMES = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles"];
const NAMES = [...MATERNAL_NAMES, ...PATERNAL_NAMES];
const NPC_JOB_LABELS = ['teacher', 'nurse', 'accountant', 'engineer', 'chef',
                        'electrician', 'journalist', 'manager', 'therapist', 'designer'];
const NPC_STARTER_JOBS = ['barista', 'intern', 'junior developer', 'sales rep', 'assistant'];

export const DEGREE_CONFIG = {
  highSchool: { years: 0,  annualCost: 0,     requires: null,         happinessEffect: 0   },
  associate:  { years: 2,  annualCost: 10000,  requires: 'highSchool', happinessEffect: 0   },
  bachelor:   { years: 4,  annualCost: 20000,  requires: 'highSchool', happinessEffect: 0   },
  master:     { years: 2,  annualCost: 30000,  requires: 'bachelor',   happinessEffect: 0   },
  phd:        { years: 4,  annualCost: 0,      requires: 'master',     happinessEffect: -20 },
};

export const DEGREE_LABELS = {
  highSchool: 'HS Diploma',
  associate:  "Associate's Degree",
  bachelor:   "Bachelor's Degree",
  master:     "Master's Degree",
  phd:        'PhD',
};

const DEGREE_RANK = { highSchool: 0, associate: 1, bachelor: 2, master: 3, phd: 4 };

/** Career degree requirements are minimum levels, so higher completed degrees qualify. */
export function hasRequiredDegree(education, requiredDegree) {
  if (!requiredDegree) return true;
  const requiredRank = DEGREE_RANK[requiredDegree];
  if (requiredRank === undefined) return false;
  return Object.entries(DEGREE_RANK).some(
    ([degree, rank]) => rank >= requiredRank && education?.[degree] === true
  );
}

/** Keep gendered parent labels aligned with the generated first-name pool. */
export function pickParentName(parentType, randomValue = Math.random()) {
  const pool = parentType === 'Mother' ? MATERNAL_NAMES : PATERNAL_NAMES;
  const safeRandom = Number.isFinite(randomValue) ? Math.min(0.999999, Math.max(0, randomValue)) : 0;
  return pool[Math.floor(safeRandom * pool.length)];
}

const INITIAL_EDUCATION = { highSchool: false, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };
const INITIAL_CAREER_META = { yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 };
const INITIAL_ECONOMY = { year: 0, phase: 'normal', yearsInPhase: 0 };

/** Keys always written on life-boundary cloud replaces (startLife / resetLife).
 * See docs/architecture.md — Cloud sync modes / Death restart flow.
 */
export const LIFE_SAVE_KEYS = [
  'character', 'age', 'stats', 'bank', 'history', 'isDead', 'flags',
  'career', 'careerMeta', 'relationships', 'belongings', 'properties',
  'education', 'networking', 'economyCycle', 'pets', 'will',
];

/**
 * Canonical persisted life document. Always includes every LIFE_SAVE_KEYS entry.
 * Nulls/empties are intentional so setDoc without merge wipes prior-life leftovers.
 * See docs/architecture.md.
 */
export function buildLifeSave(fields = {}) {
  return {
    character: fields.character ?? null,
    age: fields.age ?? 0,
    stats: fields.stats ?? { ...INITIAL_STATS },
    bank: fields.bank ?? 0,
    history: fields.history ?? [],
    isDead: fields.isDead ?? false,
    flags: fields.flags ?? [],
    career: fields.career ?? null,
    careerMeta: fields.careerMeta ? { ...fields.careerMeta } : { ...INITIAL_CAREER_META },
    relationships: fields.relationships ?? [],
    belongings: fields.belongings ?? [],
    properties: fields.properties ?? [],
    education: fields.education ? { ...fields.education } : { ...INITIAL_EDUCATION },
    networking: fields.networking ?? 0,
    economyCycle: fields.economyCycle ? { ...fields.economyCycle } : { ...INITIAL_ECONOMY },
    pets: fields.pets ?? [],
    will: fields.will ?? null,
  };
}

const DEGREE_SMARTS_BONUS = { associate: 3, bachelor: 10, master: 5, phd: 3 };

/**
 * Enroll in a degree: charge year-1 tuition and set yearsInProgram = 1 (year 1 prepaid).
 * See docs/game-mechanics.md — Education.
 */
export function enrollDegree(degreeType, education, bank) {
  const cfg = DEGREE_CONFIG[degreeType];
  if (!cfg) return { error: 'Unknown degree type' };
  if (education.currentDegree !== null) return { error: 'Already enrolled in a program' };
  if (cfg.requires && !education[cfg.requires]) {
    return { error: `Requires ${DEGREE_LABELS[cfg.requires]} first` };
  }
  if (bank < cfg.annualCost) return { error: 'Insufficient funds for first year' };
  return {
    newEducation: {
      ...education,
      currentDegree: {
        type: degreeType,
        yearsInProgram: 1,
        totalYears: cfg.years,
        annualCost: cfg.annualCost,
      },
    },
    newBank: bank - cfg.annualCost,
  };
}

/**
 * Advance one enrolled school year.
 * yearsInProgram = years already paid. Charge then increment while yearsInProgram < totalYears.
 * Legacy saves with yearsInProgram === 0: skip charge (enroll already paid), bump to 1.
 */
export function advanceDegreeYear(education, stats, bank) {
  const deg = education.currentDegree;
  if (!deg) return { education, stats, bank, completed: false, history: null, charged: 0 };

  let newBank = bank;
  const newStats = { ...stats };
  const cfg = DEGREE_CONFIG[deg.type];
  if (cfg?.happinessEffect) {
    newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + cfg.happinessEffect));
  }

  let newYears;
  let charged = 0;
  if (deg.yearsInProgram === 0) {
    newYears = 1;
  } else if (deg.yearsInProgram < deg.totalYears) {
    charged = deg.annualCost;
    newBank -= deg.annualCost;
    newYears = deg.yearsInProgram + 1;
  } else {
    newYears = deg.yearsInProgram;
  }

  if (newYears >= deg.totalYears) {
    const bonus = DEGREE_SMARTS_BONUS[deg.type] ?? 0;
    newStats.smarts = Math.max(0, Math.min(100, newStats.smarts + bonus));
    newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + 3));
    return {
      education: { ...education, [deg.type]: true, currentDegree: null },
      stats: newStats,
      bank: newBank,
      completed: true,
      completedType: deg.type,
      charged,
      history: `Education: You earned your ${DEGREE_LABELS[deg.type]}! +${bonus} Smarts.`,
    };
  }

  return {
    education: { ...education, currentDegree: { ...deg, yearsInProgram: newYears } },
    stats: newStats,
    bank: newBank,
    completed: false,
    charged,
    history: charged
      ? `Education: Year ${newYears}/${deg.totalYears} of your ${DEGREE_LABELS[deg.type]}. ($${charged.toLocaleString()} paid)`
      : `Education: Year ${newYears}/${deg.totalYears} of your ${DEGREE_LABELS[deg.type]}.`,
  };
}

/** Mark-to-market only — do not also credit bank (avoids double-counting net worth). */
export function applyPaperInvestmentReturn(currentValue, ret) {
  return {
    newValue: Math.max(0, (currentValue ?? 0) + (ret ?? 0)),
    cashDelta: 0,
  };
}

/** Spouse lookup for death summary / UI. Only current marriages (status), not leftover type. */
export function findSpouse(relationships) {
  return (relationships ?? []).find(
    (r) => r.status === 'married' && r.isAlive !== false
  ) ?? null;
}

/** Clear romantic status/type on breakup or divorce so findSpouse / romance UI stay correct. */
export function markAsEx(rel) {
  if (!rel) return rel;
  const wasMarried = rel.status === 'married' || rel.type === 'Spouse';
  const wasLover = rel.type === 'Lover' || rel.status === 'dating';
  return {
    ...rel,
    status: 'ex',
    type: wasMarried || wasLover ? 'Ex' : rel.type,
  };
}

/**
 * Normalize an NPC before adding to relationships.
 * Dating-app matches historically omitted status/isAlive, which broke romance UI + ageUp.
 */
export function normalizeRelationshipNpc(npc, { asDating = false } = {}) {
  if (!npc || typeof npc !== 'object') return npc;
  const next = { ...npc };
  if (next.isAlive === undefined || next.isAlive === null) next.isAlive = true;
  if (asDating) {
    next.status = 'dating';
    next.isAlive = true;
    if (!next.type || next.type === 'Lover') next.type = next.type || 'Lover';
  } else if (!next.status && (next.type === 'Lover' || next.type === 'Partner')) {
    next.status = 'dating';
    next.isAlive = true;
  }
  return next;
}

export const HEADHUNTER_COST = 1000;
/** Single source of truth for Launch Tech Startup — charged only inside startStartup(). */
export const STARTUP_COST = 500;
export const MILITARY_ENLIST_CAREER_ID = 'soldier';

const INVESTMENT_SUBTYPE_ALIASES = {
  crypto: 'crypto',
  stock: 'stock',
  stocks: 'stock',
  penny: 'penny_stock',
  penny_stock: 'penny_stock',
  bond: 'bond',
  bonds: 'bond',
  fund: 'fund',
  funds: 'fund',
};

export function normalizeInvestmentSubType(subType) {
  return INVESTMENT_SUBTYPE_ALIASES[subType] ?? null;
}

export function yearlyActivityTrackId(categoryId, itemText) {
  return `${categoryId}__${itemText}`;
}

export function canConsumeYearlyActivity(activitiesThisYear, categoryId, itemText, yearlyLimit) {
  if (!yearlyLimit) return true;
  const count = (activitiesThisYear ?? {})[yearlyActivityTrackId(categoryId, itemText)] ?? 0;
  return count < yearlyLimit;
}

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

export function computeGambleResult(bank, amount, randomValue) {
  if (!Number.isFinite(bank) || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (bank < amount) return { ok: false, reason: 'insufficient_funds' };
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    return { ok: false, reason: 'invalid_random' };
  }
  if (randomValue < 0.45) {
    return { ok: true, outcome: 'win', newBank: bank + amount, happinessDelta: 5, payout: amount * 2 };
  }
  if (randomValue < 0.70) {
    const payout = Math.floor(amount * 0.5);
    return { ok: true, outcome: 'partial', newBank: bank - amount + payout, happinessDelta: -5, payout };
  }
  return { ok: true, outcome: 'loss', newBank: bank - amount, happinessDelta: -5, payout: 0 };
}

export function prepareInvestmentPurchase(instrument, amountDollars, subType, bank) {
  if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument) || !instrument.id || !instrument.name) {
    return { ok: false, reason: 'invalid_instrument' };
  }
  const normalizedSubType = normalizeInvestmentSubType(subType);
  if (!normalizedSubType) return { ok: false, reason: 'invalid_subtype' };
  const amount = Math.floor(Number(amountDollars));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
  if (!Number.isFinite(bank) || bank < amount) return { ok: false, reason: 'insufficient_funds' };

  const basePrice = Number(instrument.basePrice ?? 1);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return { ok: false, reason: 'invalid_instrument' };
  const minimum = Number(instrument.minInvestment ?? (instrument.basePrice ? Math.ceil(basePrice) : 1));
  if (!Number.isFinite(minimum) || minimum <= 0 || amount < minimum) {
    return { ok: false, reason: 'below_minimum' };
  }

  const units = normalizedSubType === 'bond' ? amount : Math.floor(amount / basePrice);
  if (!Number.isFinite(units) || units <= 0) return { ok: false, reason: 'below_minimum' };
  const pricePerUnit = normalizedSubType === 'bond' ? 1 : basePrice;
  const actualCost = normalizedSubType === 'bond' ? amount : units * pricePerUnit;
  if (!Number.isFinite(actualCost) || actualCost <= 0 || actualCost > bank) {
    return { ok: false, reason: 'insufficient_funds' };
  }
  return { ok: true, subType: normalizedSubType, amount, units, pricePerUnit, actualCost };
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

const EFFECT_STAT_KEYS = ['health', 'happiness', 'smarts', 'looks', 'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades'];

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

/**
 * Validate a drafted will before state mutation.
 * allocations: [{ id, pct }] — whole percents, ids must be current relationships,
 * total ≤ 100. Zero-pct entries are dropped; an empty result is a valid
 * "standard will" (even split across living relationships at death).
 */
export function prepareWillDraft(allocations, relationships) {
  if (!Array.isArray(allocations)) return { ok: false, reason: 'invalid_allocations' };
  const known = new Set((relationships ?? []).map(r => r?.id).filter(Boolean));
  const seen = new Set();
  const cleaned = [];
  let total = 0;
  for (const entry of allocations) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, reason: 'invalid_allocations' };
    }
    const pct = Math.floor(Number(entry.pct));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, reason: 'invalid_pct' };
    if (pct === 0) continue;
    if (typeof entry.id !== 'string' || !known.has(entry.id)) {
      return { ok: false, reason: 'unknown_beneficiary' };
    }
    if (seen.has(entry.id)) return { ok: false, reason: 'duplicate_beneficiary' };
    seen.add(entry.id);
    total += pct;
    cleaned.push({ id: entry.id, pct });
  }
  if (total > 100) return { ok: false, reason: 'over_allocated' };
  return { ok: true, allocations: cleaned, allocatedPct: total };
}

/**
 * Settle the estate at death — pure, rendered by DeathScreen.
 * - No will → 'unwilled': the whole estate is taxed/donated.
 * - Will with no allocations → 'even_split' across living relationships.
 * - Directed will → living beneficiaries get their pct of net worth; lapsed
 *   shares (beneficiary dead or no longer known) fall to the residue, which is
 *   taxed/donated. Payouts never exceed the estate even on malformed saves.
 */
export function computeEstateDistribution(will, relationships, netWorth) {
  const rawWorth = Number(netWorth);
  const estate = Number.isFinite(rawWorth) ? Math.max(0, Math.floor(rawWorth)) : 0;
  const living = (relationships ?? []).filter(r => r && r.id && r.isAlive !== false);

  if (!will || !Array.isArray(will.allocations)) {
    return { mode: 'unwilled', estateValue: estate, bequests: [], residualValue: estate };
  }

  if (will.allocations.length === 0) {
    if (living.length === 0 || estate === 0) {
      return { mode: 'even_split', estateValue: estate, bequests: [], residualValue: estate };
    }
    const share = Math.floor(estate / living.length);
    const bequests = living.map(r => ({ id: r.id, name: r.name, type: r.type, pct: null, amount: share }));
    return { mode: 'even_split', estateValue: estate, bequests, residualValue: estate - share * living.length };
  }

  const byId = new Map(living.map(r => [r.id, r]));
  const bequests = [];
  let paid = 0;
  for (const alloc of will.allocations) {
    const pct = Math.floor(Number(alloc?.pct));
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const rel = byId.get(alloc?.id);
    if (!rel) continue; // lapsed bequest — share stays in the residue
    const amount = Math.min(Math.floor(estate * Math.min(pct, 100) / 100), estate - paid);
    if (amount <= 0) continue;
    paid += amount;
    bequests.push({ id: rel.id, name: rel.name, type: rel.type, pct, amount });
  }
  return { mode: 'directed', estateValue: estate, bequests, residualValue: estate - paid };
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

/**
 * School-year grades drift by smarts. Missing grades default to 70; an earned
 * grade of 0 stays 0 (nullish default, not falsy — see engine.mechanics tests).
 */
export function computeGradesDrift(grades, smarts) {
  const current = grades ?? 70;
  if (smarts > 70) return Math.min(100, current + 2);
  if (smarts < 40) return Math.max(0, current - 5);
  return Math.max(0, current - 1);
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

/** Day-trade outcome with injectable randomness — the hook supplies Math.random(). */
export function executeTradePure(bank, percentage, randomValue) {
  if (!Number.isFinite(bank) || bank <= 0) return { ok: false, reason: 'no_funds' };
  const wager = Math.floor(bank * (percentage / 100));
  let multiplier;
  if (randomValue < 0.4) multiplier = 0;
  else if (randomValue < 0.6) multiplier = 0.5;
  else if (randomValue < 0.8) multiplier = 1.5;
  else if (randomValue < 0.95) multiplier = 2;
  else multiplier = 5;
  const payout = Math.floor(wager * multiplier);
  const profit = payout - wager;
  return { ok: true, bank: bank + profit, wager, payout, profit, multiplier };
}

/** Investment sale settlement: bonds recover par early; others net CGT on realized gains. */
export function computeInvestmentSale(item, bank, cgtRate) {
  if (normalizeInvestmentSubType(item.subType) === 'bond') {
    const proceeds = Math.floor(item.purchasePrice ?? item.currentValue);
    return { isBond: true, proceeds, gain: 0, cgt: 0, newBank: bank + proceeds };
  }
  const gain = Math.floor(item.currentValue) - (item.purchasePrice ?? 0);
  const cgt = gain > 0 ? calculateCapitalGainsTax(item.purchasePrice ?? 0, item.currentValue, cgtRate) : 0;
  const proceeds = Math.floor(item.currentValue) - cgt;
  return { isBond: false, proceeds, gain, cgt, newBank: bank + proceeds };
}

/** Privacy-lean auth summary for the account UI — never fed into diagnostics. */
export function summarizeAuthUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: !!user.isAnonymous,
    name: user.displayName ?? null,
    email: user.email ?? null,
    photo: user.photoURL ?? null,
  };
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

export function useGameState() {
  const [cloudSync, setCloudSync] = useState(null);
  const [careersData, setCareersData] = useState(staticCareers);

  const [character, setCharacter] = useState(null);
  const [age, setAge] = useState(0);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [flags, setFlags] = useState([]);
  const [isDead, setIsDead] = useState(false);
  const [career, setCareer] = useState(null);
  const [bank, setBank] = useState(0);
  const [history, setHistory] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [activitiesThisYear, setActivitiesThisYear] = useState({});
  const [relationships, setRelationships] = useState([]);
  const [belongings, setBelongings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [isAging, setIsAging] = useState(false);
  const [education, setEducation] = useState(INITIAL_EDUCATION);
  const [careerMeta, setCareerMeta] = useState(INITIAL_CAREER_META);
  const [networking, setNetworking] = useState(0);
  const [economyCycle, setEconomyCycle] = useState(INITIAL_ECONOMY);
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [pets, setPets] = useState([]);
  const [will, setWill] = useState(null);
  const [authAccount, setAuthAccount] = useState(null);
  /** When true, ignore a late cloud getDoc so startLife/resetLife win the race. */
  const ignoreCloudLoadRef = useRef(false);
  /** Latest persisted-life fields; updated every render and eagerly inside persistLife. */
  const lifeSnapshotRef = useRef({
    character: null,
    age: 0,
    stats: INITIAL_STATS,
    bank: 0,
    history: [],
    isDead: false,
    flags: [],
    career: null,
    careerMeta: INITIAL_CAREER_META,
    relationships: [],
    belongings: [],
    properties: [],
    education: INITIAL_EDUCATION,
    networking: 0,
    economyCycle: INITIAL_ECONOMY,
    pets: [],
    will: null,
  });
  lifeSnapshotRef.current = {
    character, age, stats, bank, history, isDead, flags, career, careerMeta,
    relationships, belongings, properties, education, networking, economyCycle, pets, will,
  };

  /** Apply a cloud save document to local state — used at boot and on account switch. */
  const hydrateFromSave = useCallback((data) => {
    if (data.character) setCharacter(data.character);
    if (data.age !== undefined) setAge(data.age);
    if (data.stats) setStats({ grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, ...data.stats });
    if (data.bank !== undefined) setBank(data.bank);
    if (data.history) setHistory(data.history);
    if (data.isDead !== undefined) setIsDead(data.isDead);
    if (data.career !== undefined) setCareer(data.career);
    if (data.relationships) setRelationships(data.relationships);
    if (data.belongings) setBelongings(data.belongings);
    if (data.properties) setProperties(data.properties);
    if (data.education) setEducation({ ...INITIAL_EDUCATION, ...data.education });
    if (data.careerMeta) setCareerMeta({ ...INITIAL_CAREER_META, ...data.careerMeta });
    if (data.networking !== undefined) setNetworking(data.networking);
    if (data.economyCycle) setEconomyCycle({ ...INITIAL_ECONOMY, ...data.economyCycle });
    if (data.pets) setPets(data.pets);
    if (data.will !== undefined) setWill(data.will);
  }, []);

  // 1. Adopt the persisted auth session (or start an anonymous one) and load
  // the cloud save if configured
  useEffect(() => {
    let cancelled = false;
    let unsubscribeFirstAuth = null;
    setFirebaseIdTokenProvider(null);
    const loadOperationId = createDiagnosticId('save-load');
    const loadStartedAt = diagnosticNow();

    async function initCloudSync() {
      try {
        const [
          firebaseConfig,
          authApi,
          firestoreApi,
        ] = await Promise.all([
          import('../config/firebase'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);

        const { auth, db } = firebaseConfig;
        if (cancelled) return;
        if (!auth || !db) {
          emitDiagnostic('save_load', {
            operationId: loadOperationId,
            status: 'skipped',
            durationMs: diagnosticNow() - loadStartedAt,
            fields: [],
          });
          return;
        }

        const { signInAnonymously, onAuthStateChanged } = authApi;
        const { doc, setDoc, getDoc, collection, getDocs } = firestoreApi;

        emitDiagnostic('save_load', {
          operationId: loadOperationId,
          status: 'started',
          durationMs: 0,
          fields: [],
        });

        // Adopt a persisted session (anonymous or Google-linked) so returning
        // players keep their uid; only first-time visitors mint a new
        // anonymous account. signInAnonymously would replace a Google session.
        const persistedUser = await new Promise((resolve) => {
          unsubscribeFirstAuth = onAuthStateChanged(auth, resolve, () => resolve(null));
        });
        unsubscribeFirstAuth?.();
        unsubscribeFirstAuth = null;
        const user = persistedUser ?? (await signInAnonymously(auth)).user;
        if (cancelled) return;

        setFirebaseIdTokenProvider(() => user.getIdToken());
        setCloudSync({ db, userId: user.uid, doc, setDoc });
        setAuthAccount(summarizeAuthUser(user));

        try {
          const saveRef = doc(db, 'users', user.uid, 'saves', 'currentLife');
          const saveSnap = await getDoc(saveRef);
          if (cancelled) return;
          if (!ignoreCloudLoadRef.current && saveSnap.exists()) {
            const data = saveSnap.data();
            const validation = validateHydratedSave(data);
            hydrateFromSave(data);
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: validation.hasWarnings ? 'loaded_with_warnings' : 'loaded',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: validation.hasWarnings
                ? validation.warningFields
                : getDiagnosticStateFields(data),
            });
          } else if (!ignoreCloudLoadRef.current) {
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: 'not_found',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: [],
            });
          }
        } catch (e) {
          if (!cancelled) {
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: 'failed',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: [],
              errorClass: getErrorClass(e),
            });
          }
        }

        getDocs(collection(db, 'careers')).then(snapshot => {
          if (!cancelled && !snapshot.empty) setCareersData(snapshot.docs.map(skip => skip.data()));
        }).catch(console.error);
      } catch (error) {
        if (!cancelled) {
          emitDiagnostic('save_load', {
            operationId: loadOperationId,
            status: 'failed',
            durationMs: diagnosticNow() - loadStartedAt,
            fields: [],
            errorClass: getErrorClass(error),
          });
        }
      }
    }

    initCloudSync();
    return () => {
      cancelled = true;
      unsubscribeFirstAuth?.();
      setFirebaseIdTokenProvider(null);
    };
  }, [hydrateFromSave]);

  // 2. Sync to Cloud — pass { replace: true } on life boundaries to wipe stale fields
  const syncToCloud = useCallback(async (stateData, options = {}) => {
    const saveOperationId = createDiagnosticId('save-sync');
    const saveStartedAt = diagnosticNow();
    const fields = getDiagnosticStateFields(stateData);
    if (!cloudSync) {
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'skipped',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
      });
      return;
    }
    emitDiagnostic('save_sync', {
      operationId: saveOperationId,
      status: 'started',
      durationMs: 0,
      fields,
    });
    try {
      const saveRef = cloudSync.doc(cloudSync.db, 'users', cloudSync.userId, 'saves', 'currentLife');
      if (options.replace) {
        await cloudSync.setDoc(saveRef, stateData);
      } else {
        await cloudSync.setDoc(saveRef, stateData, { merge: true });
      }
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'saved',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
      });
    } catch (e) {
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'failed',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
        errorClass: getErrorClass(e),
      });
    }
  }, [cloudSync]);

  /**
   * Mid-life persist: always write a full buildLifeSave payload (merge).
   * Pass every field you just mutated as overrides — React setState has not flushed yet.
   * Eagerly updates lifeSnapshotRef so chained persists in the same tick stay consistent.
   * See docs/architecture.md — mid-life sync.
   */
  const persistLife = useCallback((overrides = {}) => {
    const next = { ...lifeSnapshotRef.current, ...overrides };
    lifeSnapshotRef.current = next;
    syncToCloud(buildLifeSave(next));
  }, [syncToCloud]);

  const isActionLocked = () => isDead || isAging || !!currentEvent;

  /** Clear the in-memory life only — no cloud write. Shared by resetLife and account changes. */
  const clearLocalLife = () => {
    setCharacter(null);
    setAge(0);
    setStats({ ...INITIAL_STATS });
    setFlags([]);
    setIsDead(false);
    setCareer(null);
    setBank(0);
    setHistory([]);
    setCurrentEvent(null);
    setActivitiesThisYear({});
    setRelationships([]);
    setBelongings([]);
    setProperties([]);
    setIsAging(false);
    setEducation({ ...INITIAL_EDUCATION });
    setCareerMeta({ ...INITIAL_CAREER_META });
    setNetworking(0);
    setEconomyCycle({ ...INITIAL_ECONOMY });
    setPets([]);
    setWill(null);
  };

  /**
   * Live Again: clear local + full-replace cloud so App shows CharacterCreation.
   * Must not use location.reload() — that reloads isDead:true from Firestore.
   * See docs/architecture.md#death-restart-flow.
   */
  const resetLife = () => {
    ignoreCloudLoadRef.current = true;
    clearLocalLife();
    syncToCloud(buildLifeSave({ character: null, isDead: false }), { replace: true });
  };

  /**
   * Google sign-in for cloud saves. An anonymous player is LINKED (same uid —
   * the current life survives untouched). If the Google account already
   * belongs to another uid, we SWITCH to that account and load its save
   * instead. Returns { ok: true, mode } or { ok: false, reason } — reasons
   * are sanitized codes, never raw provider errors.
   */
  const signInWithGoogle = async () => {
    try {
      const [firebaseConfig, authApi, firestoreApi] = await Promise.all([
        import('../config/firebase'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const { auth, db } = firebaseConfig;
      if (!auth || !db) return { ok: false, reason: 'unavailable' };
      const { GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithCredential } = authApi;

      const adopt = (user) => {
        setFirebaseIdTokenProvider(() => user.getIdToken());
        setCloudSync({ db, userId: user.uid, doc: firestoreApi.doc, setDoc: firestoreApi.setDoc });
        setAuthAccount(summarizeAuthUser(user));
      };
      const loadAccountSave = async (uid) => {
        clearLocalLife();
        const snap = await firestoreApi.getDoc(firestoreApi.doc(db, 'users', uid, 'saves', 'currentLife'));
        if (snap.exists()) hydrateFromSave(snap.data());
      };

      const provider = new GoogleAuthProvider();
      const current = auth.currentUser;
      try {
        if (current && !current.isAnonymous) return { ok: true, mode: 'already' };
        if (current) {
          const result = await linkWithPopup(current, provider);
          adopt(result.user); // same uid — the in-progress life is untouched
          return { ok: true, mode: 'linked' };
        }
        const result = await signInWithPopup(auth, provider);
        adopt(result.user);
        await loadAccountSave(result.user.uid);
        return { ok: true, mode: 'signed_in' };
      } catch (e) {
        if (e?.code === 'auth/credential-already-in-use') {
          // This Google account already owns a save under another uid — switch to it.
          const credential = GoogleAuthProvider.credentialFromError(e);
          if (!credential) return { ok: false, reason: 'error' };
          const result = await signInWithCredential(auth, credential);
          adopt(result.user);
          await loadAccountSave(result.user.uid);
          return { ok: true, mode: 'switched' };
        }
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request' || e?.code === 'auth/popup-blocked') {
          return { ok: false, reason: 'cancelled' };
        }
        return { ok: false, reason: 'error' };
      }
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  /**
   * Sign out of Google on this device: a fresh anonymous session starts and
   * the local life clears. The Google account's cloud save is left untouched.
   */
  const signOutAccount = async () => {
    try {
      const [firebaseConfig, authApi, firestoreApi] = await Promise.all([
        import('../config/firebase'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const { auth, db } = firebaseConfig;
      if (!auth || !db) return { ok: false, reason: 'unavailable' };
      if (auth.currentUser?.isAnonymous) return { ok: true, mode: 'already_guest' };
      await authApi.signOut(auth);
      const cred = await authApi.signInAnonymously(auth);
      setFirebaseIdTokenProvider(() => cred.user.getIdToken());
      setCloudSync({ db, userId: cred.user.uid, doc: firestoreApi.doc, setDoc: firestoreApi.setDoc });
      setAuthAccount(summarizeAuthUser(cred.user));
      clearLocalLife();
      return { ok: true, mode: 'signed_out' };
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  const startLife = (name, gender, country, cityId) => {
    ignoreCloudLoadRef.current = true;
    const city = getCityById(cityId);
    const newChar = { name, gender, country, city: cityId ?? null };
    const initialStats = generateInitialStats();

    setCharacter(newChar);
    setAge(0);
    setStats(initialStats);
    setFlags([]);
    setIsDead(false);
    setCareer(null);
    setBank(0);
    setActivitiesThisYear({});
    setBelongings([]);
    setProperties([]);
    setEducation({ ...INITIAL_EDUCATION });
    setCareerMeta({ ...INITIAL_CAREER_META });
    setNetworking(0);
    setEconomyCycle({ ...INITIAL_ECONOMY });
    setPets([]);
    setWill(null);
    setIsAging(false);

    const lastName = name.split(' ').pop();
    const initialFamily = [
      { id: `rel_${Date.now()}_m`, type: "Mother", name: `${pickParentName('Mother')} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 70 + Math.floor(Math.random() * 30), status: 'family', isAlive: true },
      { id: `rel_${Date.now()}_f`, type: "Father", name: `${pickParentName('Father')} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 60 + Math.floor(Math.random() * 40), status: 'family', isAlive: true }
    ];
    const numSiblings = Math.floor(Math.random() * 4);
    for (let i=0; i<numSiblings; i++) {
       initialFamily.push({ id: `rel_${Date.now()}_s${i}_${Math.floor(Math.random() * 1000000)}`, type: "Sibling", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: Math.floor(Math.random() * 15), relation: 40 + Math.floor(Math.random() * 60), status: 'family', isAlive: true });
    }
    setRelationships(initialFamily);

    const cityLabel = city ? `${city.name}, ${country}` : country;
    const initialHistory = [{ age: 0, text: `You were born in ${cityLabel}. You are a ${gender} named ${name}.` }];
    setHistory(initialHistory);
    setCurrentEvent(null);

    syncToCloud(buildLifeSave({
      character: newChar,
      age: 0,
      stats: initialStats,
      bank: 0,
      history: initialHistory,
      isDead: false,
      flags: [],
      career: null,
      careerMeta: INITIAL_CAREER_META,
      relationships: initialFamily,
      belongings: [],
      properties: [],
      education: INITIAL_EDUCATION,
      networking: 0,
      economyCycle: INITIAL_ECONOMY,
      pets: [],
      will: null,
    }), { replace: true });
  };

  const checkDeath = useCallback((currentStats, currentAge) => (
    checkDeathPure(currentStats, currentAge, Math.random())
  ), []);

  const applyEffects = (effects) => {
    const applied = applyEffectsPure(stats, bank, flags, effects);
    setStats(applied.stats);
    setBank(applied.bank);
    setFlags(applied.flags);
    return applied;
  };

  const handleChoice = (choice) => {
    let nextStats = stats;
    let nextBank = bank;
    let nextFlags = flags;
    let nextRelationships = relationships;

    if (choice.effects) {
      const applied = applyEffects(choice.effects);
      nextStats = applied.stats;
      nextBank = applied.bank;
      nextFlags = applied.flags;
    }

    const historyLines = [];

    if (currentEvent?.isCustodyBattle && choice.custodyOutcome) {
      const { exId, childIds } = currentEvent;
      const childLabel = childIds.length > 1 ? 'children' : 'child';

      if (choice.custodyOutcome === 'fight') {
        const won = Math.random() < 0.8;
        if (won) {
          historyLines.push(`Legal: You won full custody of your ${childLabel}. The judge ruled in your favor.`);
        } else {
          historyLines.push(`Legal: You lost the custody battle. The judge awarded full custody to your ex.`);
          nextRelationships = nextRelationships.map(r => childIds.includes(r.id) ? { ...r, custodyWith: 'ex' } : r);
        }
      } else if (choice.custodyOutcome === 'negotiate') {
        historyLines.push(`Legal: Joint custody agreed. You pay $2,400/yr in child support.`);
        nextRelationships = nextRelationships.map(r => r.id === exId ? { ...r, childSupport: 2400 } : r);
      } else if (choice.custodyOutcome === 'surrender') {
        historyLines.push(`Legal: You signed away custody. You may see them on holidays.`);
        nextRelationships = nextRelationships.map(r => childIds.includes(r.id) ? { ...r, custodyWith: 'ex' } : r);
      }
    }

    historyLines.push(`Event: ${currentEvent.description} -> You chose: ${choice.text}`);
    const updatedHistory = [...history, ...historyLines.map(text => ({ age, text }))];

    if (nextRelationships !== relationships) setRelationships(nextRelationships);
    setHistory(updatedHistory);
    setCurrentEvent(null);
    persistLife({
      history: updatedHistory,
      stats: nextStats,
      bank: nextBank,
      flags: nextFlags,
      relationships: nextRelationships,
    });
  };

  const runPerformanceReview = useCallback((currentStats, currentCareer, currentMeta, currentNetworking, currentEconomy) => {
    let roll = 0.5;
    roll += Math.min(0.10, ((currentStats.smarts  - 50) / 10) * 0.02);
    roll += Math.min(0.06, ((currentStats.health  - 50) / 10) * 0.02);
    roll += Math.min(0.05, ((currentStats.karma   - 50) / 10) * 0.01);
    roll += Math.min(0.10, (currentNetworking / 20) * 0.02);
    if (currentMeta.isOnPIP)             roll -= 0.05;
    if (currentMeta.financialStressFlag) roll -= 0.10;
    if (currentEconomy?.phase === 'boom')      roll += 0.05;
    if (currentEconomy?.phase === 'recession') roll -= 0.05;

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
  }, []);

  const ageUp = useCallback(async () => {
    if (isDead || currentEvent || isAging) return;

    setIsAging(true);
    const transitionOperationId = createDiagnosticId('age-transition');
    const transitionStartedAt = diagnosticNow();
    emitDiagnostic('age_transition', {
      operationId: transitionOperationId,
      status: 'started',
      durationMs: 0,
      fromAge: age,
      toAge: age + 1,
    });

    try {
    const nextAge = age + 1;
    let nextStats = { ...stats };
    if (nextAge >= 5 && nextAge <= 22) {
      nextStats.grades = computeGradesDrift(nextStats.grades, nextStats.smarts);
    }
    let nextBank = bank;
    let nextCareer = career;
    let businessHistory = null;
    let educationHistory = null;

    // ── Economy cycle ─────────────────────────────────────────────────────────
    const PHASE_DURATIONS = { normal: 3, boom: 2, recession: 2 };
    const phaseTransitions = { normal: 'boom', boom: 'recession', recession: 'normal' };
    const newYearsInPhase = economyCycle.yearsInPhase + 1;
    const nextEconomy = newYearsInPhase >= PHASE_DURATIONS[economyCycle.phase]
      ? { year: economyCycle.year + 1, phase: phaseTransitions[economyCycle.phase], yearsInPhase: 0 }
      : { year: economyCycle.year + 1, phase: economyCycle.phase, yearsInPhase: newYearsInPhase };

    // ── Auto high-school diploma at 18 ────────────────────────────────────────
    let nextEducation = { ...education };
    if (nextAge >= 18 && !nextEducation.highSchool) {
      nextEducation = { ...nextEducation, highSchool: true };
      educationHistory = `Education: You earned your High School Diploma!`;
    }

    // ── Process in-progress degree ────────────────────────────────────────────
    if (nextEducation.currentDegree) {
      const advanced = advanceDegreeYear(nextEducation, nextStats, nextBank);
      nextEducation = advanced.education;
      nextStats = advanced.stats;
      nextBank = advanced.bank;
      if (advanced.history) educationHistory = advanced.history;
    }

    nextStats = applyAgeUpDegradation(nextStats, nextAge);

    if (nextCareer) {
      if (nextCareer.id === 'founder') {
        const startupYear = applyStartupYear(nextCareer, Math.random());
        businessHistory = {
          bankrupt: "Your startup went bankrupt. You lost everything.",
          downturn: "Your startup had a tough year.",
          steady: "Your startup grew steadily.",
          moonshot: "Your startup valuation skyrocketed!",
        }[startupYear.outcome];

        if (!startupYear.career) {
          nextStats.happiness = Math.max(0, nextStats.happiness - 30);
          nextCareer = null;
        } else {
          nextCareer = startupYear.career;
          nextBank += startupYear.dividend;
          businessHistory += ` Valuation: $${startupYear.career.equity}. Dividend: $${startupYear.dividend}.`;
        }
      } else {
        const currentCity = getCityById(character?.city);
        const salaryMultiplier = currentCity?.salaryMultiplier ?? 1.0;
        const grossSalary = Math.round(nextCareer.salary * salaryMultiplier);
        const tax = calculateIncomeTax(grossSalary, nextBank);
        const netSalary = grossSalary - tax;
        nextBank += netSalary;
        nextStats = applyCareerYearEffects(nextStats, nextCareer);
        if (nextCareer.smarts_gain) nextStats.smarts = Math.min(100, nextStats.smarts + nextCareer.smarts_gain);
        if (tax > 0) businessHistory = (businessHistory ? businessHistory + ' ' : '') + `Paid $${tax.toLocaleString()} in income tax (${Math.round(tax / grossSalary * 100)}% bracket).`;
      }
    }

    // ── Lifestyle cost (wealth tier expectation) ──────────────────────────────
    const currentCity = getCityById(character?.city);
    const colMultiplier = currentCity?.colMultiplier ?? 1.0;
    const currentTier = getWealthTier(nextBank);
    let lifestyleHistoryStr = null;
    if (currentTier.lifestyleCost > 0) {
      const adjustedLifestyleCost = Math.round(currentTier.lifestyleCost * colMultiplier);
      nextBank -= adjustedLifestyleCost;
      if (nextBank < 0) {
        nextStats.happiness = Math.max(0, nextStats.happiness - currentTier.happinessPenalty);
        lifestyleHistoryStr = `Lifestyle: You can't maintain your ${currentTier.label} status. Went into debt paying $${adjustedLifestyleCost.toLocaleString()} in lifestyle costs. −${currentTier.happinessPenalty} Happiness.`;
      } else {
        lifestyleHistoryStr = `Lifestyle: Spent $${adjustedLifestyleCost.toLocaleString()} maintaining your ${currentTier.label} lifestyle.`;
      }
    }

    // ── Performance review & networking gain ──────────────────────────────────
    let nextCareerMeta = { ...careerMeta };
    let nextNetworking = networking;
    let reviewHistory  = null;

    if (nextCareer && nextCareer.id !== 'founder') {
      nextCareerMeta = { ...nextCareerMeta, yearsInRole: nextCareerMeta.yearsInRole + 1 };
      // Networking gain from job
      nextNetworking = Math.min(100, nextNetworking + (nextCareer.networking_gain ?? 0));

      const review = runPerformanceReview(nextStats, nextCareer, nextCareerMeta, nextNetworking, nextEconomy);
      reviewHistory = review.historyText;
      nextStats.happiness = Math.min(100, Math.max(0, nextStats.happiness + review.statEffects.happiness));
      nextCareerMeta = { ...nextCareerMeta, isOnPIP: review.setIsOnPIP, financialStressFlag: review.newFinancialStressFlag, unemploymentYearsLeft: review.unemploymentYears };

      if (review.outcome === 'promoted' && review.newCareer?.nextTierId) {
        // Resolve the promotion to the actual next-tier career object
        const promoted = careersData.find(c => c.id === nextCareer.nextTierId);
        if (promoted) {
          nextCareer = promoted;
          nextCareerMeta = { ...nextCareerMeta, yearsInRole: 0 };
        }
      } else if (review.outcome === 'raise' || review.outcome === 'no_change') {
        nextCareer = review.newCareer;
      } else if (review.outcome === 'fired') {
        nextCareer = null;
        nextCareerMeta = { ...nextCareerMeta, yearsInRole: 0 };
      }
    } else if (!nextCareer && nextCareerMeta.unemploymentYearsLeft > 0) {
      // Unemployment stipend
      const stipend = 4000;
      nextBank += stipend;
      nextCareerMeta = { ...nextCareerMeta, unemploymentYearsLeft: nextCareerMeta.unemploymentYearsLeft - 1 };
      reviewHistory = nextCareerMeta.unemploymentYearsLeft > 0
        ? `Unemployment: Received $${stipend.toLocaleString()} in benefits.`
        : `Unemployment: Benefits expired. Time to find work.`;
    }

    // Financial stress flag: unemployed and broke
    if (!nextCareer && nextBank < 0) nextCareerMeta = { ...nextCareerMeta, financialStressFlag: true };

    let nextProperties = [...properties];
    let nextBelongings = [...belongings];
    let totalUpkeep = 0;
    
    const marketCrash = Math.random() < 0.05; 
    const marketBoom = !marketCrash && Math.random() < 0.10; 

    // Resolve catalog appreciation rates for all owned assets
    const catalogMap = Object.fromEntries(getAllAssets().map(a => [a.id, a]));

    let investmentIncome = 0;
    let investmentHistoryStr = null;

    nextProperties = nextProperties.map(prop => {
      let newValue = prop.currentValue;
      if (prop.type === 'investment') {
        // Investments use returnProfile for annual gains/losses
        const catalogEntry = { ...prop, currentValue: prop.currentValue };
        const ret = estimateInvestmentReturn(catalogEntry, nextEconomy.phase);
        newValue = Math.max(0, prop.currentValue + ret);
        investmentIncome += ret;
      } else if (marketCrash) {
        newValue = Math.floor(newValue * 0.7);
      } else if (marketBoom) {
        newValue = Math.floor(newValue * 1.3);
      } else {
        // Use catalog appreciation rate if available, else default +2–5%
        const rate = catalogMap[prop.catalogId]?.appreciationRate ?? (1 + (Math.random() * 0.03 + 0.02));
        newValue = Math.floor(newValue * rate);
      }
      totalUpkeep += prop.upkeep || 0;
      // Apply passive stat effects from owned assets
      const fx = catalogMap[prop.catalogId]?.statEffects ?? {};
      for (const [stat, delta] of Object.entries(fx)) {
        if (nextStats[stat] !== undefined) nextStats[stat] = Math.min(100, Math.max(0, nextStats[stat] + delta));
      }
      return { ...prop, currentValue: Math.max(0, newValue), yearsOwned: prop.yearsOwned + 1 };
    });

    const bondMaturities = []; // collect bond principal returns
    nextBelongings = nextBelongings.map(item => {
      let newValue = item.currentValue;
      const subType = item.type === 'investment' ? normalizeInvestmentSubType(item.subType) : null;
      if (item.type === 'investment') {
        if (subType === 'bond') {
          // Annual coupon income, then principal back at maturity
          const couponIncome = Math.floor((item.purchasePrice ?? 0) * (item.couponRate ?? 0.04));
          investmentIncome += couponIncome;
          const newYTM = (item.yearsToMaturity ?? 1) - 1;
          if (newYTM <= 0) {
            // Bond matures: principal returned, bond removed
            bondMaturities.push({ name: item.name, principal: item.purchasePrice ?? item.currentValue });
            return null; // will be filtered out below
          }
          return { ...item, subType, currentValue: item.purchasePrice ?? item.currentValue, yearsOwned: item.yearsOwned + 1, yearsToMaturity: newYTM };

        } else if (subType === 'crypto') {
          const vol = item.volatility ?? 0.60;
          const trend = ((item.trendiness ?? 0.5) - 0.5) * 0.30;
          const crashRoll = Math.random();
          const moonRoll  = Math.random();
          // Moonshot: small chance of insane multi (higher chance for ultra-volatile coins)
          if (vol >= 1.5 && moonRoll < 0.02) {
            const mult = 50 + Math.random() * 950; // 50x–1000x
            newValue = Math.floor(item.currentValue * mult);
          } else if (vol >= 0.80 && moonRoll < 0.015) {
            const mult = 5 + Math.random() * 95;   // 5x–100x
            newValue = Math.floor(item.currentValue * mult);
          // Crash: small chance of near-total wipe
          } else if (crashRoll < 0.05 + (vol - 0.6) * 0.1) {
            const survive = 0.02 + Math.random() * 0.18; // lose 80–98%
            newValue = Math.max(0, Math.floor(item.currentValue * survive));
          } else {
            let swing = (Math.random() * 2 - 1) * vol;
            if (nextEconomy.phase === 'boom') swing += 0.20 + trend;
            if (nextEconomy.phase === 'recession') swing -= 0.30;
            else swing += trend;
            newValue = Math.max(0, Math.floor(item.currentValue * (1 + swing)));
          }

        } else if (subType === 'stock') {
          let swing = (Math.random() * 2 - 1) * (item.volatility ?? 0.25);
          let rate = swing + (item.baseReturn ?? 0.08);
          if (nextEconomy.phase === 'boom') rate += 0.10;
          if (nextEconomy.phase === 'recession') rate -= 0.15;
          newValue = Math.max(0, Math.floor(item.currentValue * (1 + rate)));

        } else if (subType === 'penny_stock') {
          const roll = Math.random();
          if (roll < 0.12) {
            newValue = 0; // bankrupt
          } else if (roll < 0.22) {
            newValue = Math.floor(item.currentValue * (2 + Math.random() * 4)); // 2x–6x
          } else {
            const swing = (Math.random() - 0.45) * 0.70;
            newValue = Math.max(0, Math.floor(item.currentValue * (1 + swing)));
          }

        } else if (subType === 'fund' || item.returnProfile) {
          const ret = estimateInvestmentReturn({ ...item }, nextEconomy.phase);
          // Paper gain/loss only — do not also add to bank (net-worth double-count)
          newValue = applyPaperInvestmentReturn(item.currentValue, ret).newValue;

        } else {
          // Legacy catalog-based investment — same mark-to-market treatment
          const ret = estimateInvestmentReturn({ ...item }, nextEconomy.phase);
          newValue = applyPaperInvestmentReturn(item.currentValue, ret).newValue;
        }
      } else {
        // Non-investment belongings: use catalog appreciation rate
        const rate = catalogMap[item.catalogId]?.appreciationRate;
        if (rate) {
          newValue = Math.floor(item.currentValue * rate);
        } else if (item.type === 'luxury' || item.type === 'heirloom' || item.type === 'jewelry') {
          newValue = Math.floor(item.currentValue * 1.025);
        } else {
          newValue = Math.floor(item.currentValue * 0.85);
        }
      }
      totalUpkeep += item.upkeep || 0;
      const fx = catalogMap[item.catalogId]?.statEffects ?? {};
      for (const [stat, delta] of Object.entries(fx)) {
        if (nextStats[stat] !== undefined) nextStats[stat] = Math.min(100, Math.max(0, nextStats[stat] + delta));
      }
      return { ...item, subType: subType ?? item.subType, currentValue: Math.max(0, newValue), yearsOwned: item.yearsOwned + 1 };
    }).filter(Boolean); // remove matured bonds

    // Add matured bond principals to bank + history
    for (const bond of bondMaturities) {
      nextBank += bond.principal;
      investmentHistoryStr = (investmentHistoryStr ? investmentHistoryStr + ' ' : '') + `Bond Maturity: ${bond.name} matured — principal of $${bond.principal.toLocaleString()} returned.`;
    }

    if (investmentIncome !== 0) {
      nextBank += investmentIncome;
      const incomeMsg = investmentIncome > 0
        ? `Investments: Your portfolio returned $${investmentIncome.toLocaleString()} this year.`
        : `Investments: Your portfolio lost $${Math.abs(investmentIncome).toLocaleString()} this year.`;
      investmentHistoryStr = investmentHistoryStr
        ? `${investmentHistoryStr} | ${incomeMsg}`
        : incomeMsg;
    }

    nextBank -= totalUpkeep;
    let upkeepHistoryStr = null;
    let marketHistoryStr = null;

    if (totalUpkeep > 0) {
      if (nextBank < 0) {
         nextStats.happiness = Math.max(0, nextStats.happiness - 20);
         upkeepHistoryStr = `Economy: You went into debt paying $${totalUpkeep.toLocaleString()} in maintenance fees!`;
      } else {
         upkeepHistoryStr = `Economy: Paid $${totalUpkeep.toLocaleString()} in property taxes and maintenance.`;
      }
    }
    
    if (marketCrash && properties.length > 0) marketHistoryStr = "Economy: The housing market crashed! Real estate shed 30% of its value.";
    if (marketBoom && properties.length > 0) marketHistoryStr = "Economy: A booming housing market skyrocketed your property values!";

    // ── Child support obligations ─────────────────────────────────────────────
    let childSupportTotal = 0;
    let childSupportHistoryStr = null;
    relationships.forEach(r => {
      if (r.childSupport && r.childSupport > 0) childSupportTotal += r.childSupport;
    });
    if (childSupportTotal > 0) {
      nextBank -= childSupportTotal;
      childSupportHistoryStr = `Family: Child support payments: -$${childSupportTotal.toLocaleString()}`;
    }

    // ── Pet lifecycle ─────────────────────────────────────────────────────────
    let petHappinessBonus = 0;
    let petMaintenanceCost = 0;
    const petDeathMessages = [];

    const petUpdates = pets.map(pet => {
      if (!pet.isAlive) return pet;
      const petDef = PET_CATALOG[pet.speciesId];
      if (!petDef) return pet;

      const newAge = pet.age + 1;
      petMaintenanceCost += petDef.annualMaintenanceCost;
      petHappinessBonus += petDef.happinessBonus;

      const deathChance = newAge >= petDef.lifespanMax ? 1.0
        : newAge >= petDef.lifespanMin
          ? (newAge - petDef.lifespanMin) / (petDef.lifespanMax - petDef.lifespanMin) * 0.3
          : 0;

      if (Math.random() < deathChance) {
        petDeathMessages.push(`Your ${petDef.species} ${pet.name} passed away at age ${newAge}. You'll miss them dearly.`);
        return { ...pet, age: newAge, isAlive: false };
      }
      return { ...pet, age: newAge };
    });

    nextBank -= petMaintenanceCost;
    if (petHappinessBonus > 0) {
      nextStats.happiness = Math.min(100, nextStats.happiness + petHappinessBonus);
    }
    nextStats.happiness = Math.max(0, nextStats.happiness - petDeathMessages.length * 5);

    setPets(petUpdates);

    setAge(nextAge);
    setStats(nextStats);
    setBank(nextBank);
    setCareer(nextCareer);
    setCareerMeta(nextCareerMeta);
    setNetworking(nextNetworking);
    setEconomyCycle(nextEconomy);
    setEducation(nextEducation);
    setActivitiesThisYear({});
    setProperties(nextProperties);
    setBelongings(nextBelongings);
    
    // ── Relationship passive decay, auto-breakup, parent death, jealousy ────────
    const getRelDecay = (rel) => {
      if (rel.status === 'family')   return 1;
      if (rel.status === 'dating')   return 3;
      if (rel.status === 'married')  return 2;
      if (rel.status === 'friend')   return 2;
      return 0;
    };

    // Age every living relationship and apply passive decay if not interacted with
    const wealthTier = getWealthTier(nextBank);
    let nextRelationships = relationships.map(rel => {
      if (!rel.isAlive) return rel;
      const nextRel = { ...rel, age: rel.age + 1 };
      const interacted = !!activitiesThisYear[`rel_interact__${rel.id}`];
      const baseDecay = getRelDecay(rel);
      if (!interacted && baseDecay > 0) {
        // Romantic partners decay faster as wealth increases (they expect more attention/spending)
        const mult = (rel.status === 'dating' || rel.status === 'married') ? wealthTier.relationDecayMult : 1.0;
        const totalDecay = Math.ceil(baseDecay * mult);
        return { ...nextRel, relation: Math.max(0, nextRel.relation - totalDecay) };
      }
      return nextRel;
    });

    // Auto-breakup: romantic relationships that hit rock bottom dissolve
    const relationshipEvents = [];
    nextRelationships = nextRelationships.map(rel => {
      if (!rel.isAlive) return rel;
      if ((rel.status === 'dating' || rel.status === 'married') && rel.relation < 20) {
        const wasMarried = rel.status === 'married';
        relationshipEvents.push(wasMarried
          ? `Relationships: Your marriage with ${rel.name} fell apart and ended in divorce.`
          : `Relationships: Things fell apart with ${rel.name}. You broke up.`
        );
        return markAsEx(rel);
      }
      return rel;
    });

    // Parent/elder death chance
    nextRelationships = nextRelationships.map(rel => {
      if (!rel.isAlive) return rel;
      if (rel.status === 'family' && rel.age >= 70) {
        const deathChance = Math.min(1, (rel.age - 70) / 60);
        if (Math.random() < deathChance) {
          relationshipEvents.push(`Life Event: Your ${rel.type}, ${rel.name}, passed away at age ${rel.age}.`);
          nextStats.happiness = Math.max(0, nextStats.happiness - 10);
          return { ...rel, isAlive: false };
        }
      }
      return rel;
    });

    // Jealousy: multiple simultaneous lovers drain happiness
    const activeLovers = nextRelationships.filter(r => r.isAlive && (r.status === 'dating' || r.status === 'married'));
    if (activeLovers.length > 1) {
      nextStats.happiness = Math.max(0, nextStats.happiness - 5);
      relationshipEvents.push(`Relationships: The jealousy of maintaining ${activeLovers.length} simultaneous partners is taking a toll.`);
    }

    // === NPC Autonomy Pass ===
    nextRelationships = nextRelationships.map(rel => {
      if (rel.isAlive === false) return rel;
      if (rel.status === 'ex') return rel;

      let updated = { ...rel };
      const npcAge = rel.age ?? 0;

      // Job events (aged 22-45, no job yet)
      if (!updated.npcJob && npcAge >= 22 && npcAge <= 45) {
        if (Math.random() < 0.05) {
          const job = NPC_JOB_LABELS[Math.floor(Math.random() * NPC_JOB_LABELS.length)];
          updated.npcJob = job;
          relationshipEvents.push(`📱 ${rel.name} landed a job as a ${job}.`);
        }
      }

      // Marriage events (aged 25-50, not yet married)
      if (!updated.npcSpouse && npcAge >= 25 && npcAge <= 50) {
        if (Math.random() < 0.04) {
          updated.npcSpouse = true;
          relationshipEvents.push(`💍 ${rel.name} got married. You heard about it on social media.`);
        }
      }

      // Illness events (aged 40+, probability scales with age)
      if (!updated.npcSick && npcAge >= 40) {
        const sickChance = 0.03 + Math.max(0, npcAge - 40) * 0.002;
        if (Math.random() < sickChance) {
          updated.npcSick = true;
          updated.relation = Math.max(0, (updated.relation ?? 50) - 5);
          relationshipEvents.push(`🏥 ${rel.name} was diagnosed with a health condition and has become more withdrawn.`);
        }
      }

      // Children growing up
      const isNpcChild = rel.relation === 'child' || rel.relation === 'son' || rel.relation === 'daughter'
        || rel.type === 'Child' || rel.type === 'Son' || rel.type === 'Daughter';
      if (isNpcChild && rel.custodyWith !== 'ex') {
        if (npcAge === 18) {
          updated.status = 'family_adult';
          relationshipEvents.push(`🎓 Your child ${rel.name} has turned 18 and left for college.`);
        } else if (npcAge === 22 && !updated.npcJob) {
          const job = NPC_STARTER_JOBS[Math.floor(Math.random() * NPC_STARTER_JOBS.length)];
          updated.npcJob = job;
          relationshipEvents.push(`🎉 Your child ${rel.name} got their first job as a ${job}.`);
        }
      }

      return updated;
    });

    setRelationships(nextRelationships);

    const died = checkDeath(nextStats, nextAge);
    
    let updatedHistory = [...history];
    if (died) {
      setIsDead(true);
      updatedHistory.push({ age: nextAge, text: `You passed away peacefully at age ${nextAge}.` });
      setHistory(updatedHistory);
      persistLife({
        age: nextAge,
        stats: nextStats,
        bank: nextBank,
        isDead: true,
        history: updatedHistory,
        belongings: nextBelongings,
        properties: nextProperties,
        career: nextCareer,
        careerMeta: nextCareerMeta,
        networking: nextNetworking,
        economyCycle: nextEconomy,
        education: nextEducation,
        relationships: nextRelationships,
        pets: petUpdates,
      });
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'death',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: age,
        toAge: nextAge,
      });
      return;
    }

    let eventTriggered = false;
    const dynamicEvent = await generateDynamicEvent({
      character, age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, history: updatedHistory,
      narrativeMode, relationships, pets, city: getCityById(character?.city)?.name ?? null, education: nextEducation,
      economyPhase: nextEconomy?.phase,
    });

    if (dynamicEvent && dynamicEvent.description && dynamicEvent.choices) {
      // Re-map format if necessary to ensure stability with UI
      const safeEvent = {
        description: dynamicEvent.description,
        choices: dynamicEvent.choices.map(c => ({
          text: c.text || "Continue",
          effects: c.effects || {}
        }))
      };
      setCurrentEvent(safeEvent);
      eventTriggered = true;
    } else {
      setCurrentEvent({
        description: 'LLM ERROR: Dynamic event generation returned no event.',
        choices: [{ text: 'Understood', effects: {} }],
      });
      eventTriggered = true;
    }

    if (!eventTriggered) {
      updatedHistory.push({ age: nextAge, text: `Age ${nextAge}: An uneventful year passed.` });
    }
    
    if (businessHistory) updatedHistory.push({ age: nextAge, text: `Business: ${businessHistory}` });
    if (investmentHistoryStr) updatedHistory.push({ age: nextAge, text: investmentHistoryStr });
    if (lifestyleHistoryStr) updatedHistory.push({ age: nextAge, text: lifestyleHistoryStr });
    if (educationHistory) updatedHistory.push({ age: nextAge, text: educationHistory });
    if (reviewHistory)   updatedHistory.push({ age: nextAge, text: reviewHistory });
    if (upkeepHistoryStr) updatedHistory.push({ age: nextAge, text: upkeepHistoryStr });
    if (marketHistoryStr) updatedHistory.push({ age: nextAge, text: marketHistoryStr });
    if (childSupportHistoryStr) updatedHistory.push({ age: nextAge, text: childSupportHistoryStr });
    for (const relEvent of relationshipEvents) {
      updatedHistory.push({ age: nextAge, text: relEvent });
    }
    for (const petMsg of petDeathMessages) {
      updatedHistory.push({ age: nextAge, text: petMsg });
    }
    if (petMaintenanceCost > 0) {
      updatedHistory.push({ age: nextAge, text: `Pets: Spent $${petMaintenanceCost.toLocaleString()} on pet care this year.` });
    }

    setHistory(updatedHistory);

    persistLife({ age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy, education: nextEducation, history: updatedHistory, relationships: nextRelationships, properties: nextProperties, belongings: nextBelongings, pets: petUpdates });
    emitDiagnostic('age_transition', {
      operationId: transitionOperationId,
      status: 'completed',
      durationMs: diagnosticNow() - transitionStartedAt,
      fromAge: age,
      toAge: nextAge,
    });
    } catch (error) {
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'failed',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: age,
        toAge: age + 1,
        errorClass: getErrorClass(error),
      });
      throw error;
    } finally {
      setIsAging(false);
    }
  }, [age, stats, bank, isDead, currentEvent, career, careerMeta, networking, economyCycle, education, history, checkDeath, persistLife, isAging, character, relationships, properties, belongings, runPerformanceReview, careersData, pets, activitiesThisYear, narrativeMode]);

  // ─── Career expansion helpers ────────────────────────────────────────────────

  const checkCareerEligibility = useCallback((careerEntry) => {
    if (age < careerEntry.minAge) return { eligible: false, reason: `Requires age ${careerEntry.minAge}+` };
    if (!hasRequiredDegree(education, careerEntry.requiresDegree)) {
      return { eligible: false, reason: `Requires ${DEGREE_LABELS[careerEntry.requiresDegree]}` };
    }
    const netReq = careerEntry.requiresNetworking ?? 0;
    if (networking < netReq) return { eligible: false, reason: `Requires Networking ${netReq}+` };
    for (const [stat, min] of Object.entries(careerEntry.statRequirements ?? {})) {
      if ((stats[stat] ?? 0) < min) return { eligible: false, reason: `Requires ${stat} ${min}+` };
    }
    return { eligible: true, reason: '' };
  }, [age, education, networking, stats]);

  const enrollInDegree = (degreeType) => {
    if (isActionLocked()) return;
    const result = enrollDegree(degreeType, education, bank);
    if (result.error) {
      setHistory(prev => [...prev, { age, text: `Education: ${result.error}.` }]);
      return;
    }
    setBank(result.newBank);
    setEducation(result.newEducation);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Education: You enrolled in a ${DEGREE_LABELS[degreeType]} program (Year 1/${DEGREE_CONFIG[degreeType].years}).` }];
      persistLife({ education: result.newEducation, history: updated, bank: result.newBank });
      return updated;
    });
  };

  const chooseCareer = (jobId) => {
    if (isActionLocked()) return;
    if (jobId === null) {
      setCareer(null);
      const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: careerMeta.financialStressFlag };
      setCareerMeta(newMeta);
      setHistory(prev => {
        const updated = [...prev, { age, text: `You quit your current occupation.` }];
        persistLife({ history: updated, career: null, careerMeta: newMeta });
        return updated;
      });
      return;
    }
    const selected = careersData.find(c => c.id === jobId);
    if (!selected) return;
    const { eligible, reason } = checkCareerEligibility(selected);
    if (!eligible) {
      setHistory(prev => [...prev, { age, text: `Career: Can't apply — ${reason}.` }]);
      return;
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    setCareer(selected);
    setCareerMeta(newMeta);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Career: You got a job as a ${selected.title} ($${selected.salary.toLocaleString()}/yr).` }];
      persistLife({ history: updated, career: selected, careerMeta: newMeta });
      return updated;
    });
  };

  /**
   * performActivity — unified activity dispatcher.
   * @param {object} item  — the full ACTIVITY_MENUS item object
   * @param {string} categoryId — the parent category id (used as namespace for yearlyLimit tracking)
   * Handles: yearlyLimit gating, cost deduction, statGuard check, baseEffects, then LLM event.
   * Returns: 'blocked_yearly' | 'blocked_guard' | 'blocked_cost' | 'ok'
   */
  const performActivity = (item, categoryId) => {
    if (isActionLocked()) return 'blocked_busy';
    const trackId = yearlyActivityTrackId(categoryId, item.text);

    // 1. Per-year limit gate
    if (item.yearlyLimit && !canConsumeYearlyActivity(activitiesThisYear, categoryId, item.text, item.yearlyLimit)) {
      return 'blocked_yearly';
    }

    // 2. Stat guard
    if (item.statGuard) {
      const { stat, op, value } = item.statGuard;
      const actual = stats[stat] ?? 0;
      if (op === 'gte' && actual < value) return 'blocked_guard';
      if (op === 'lte' && actual > value) return 'blocked_guard';
    }

    // 3. Cost deduction + base effects (compute synchronously for cloud persist)
    const cost = item.cost ?? 0;
    if (cost > 0 && bank < cost) return 'blocked_cost';

    let nextBank = bank;
    let nextStats = stats;
    let nextFlags = flags;
    if (cost > 0) nextBank = bank - cost;
    if (item.baseEffects) {
      const applied = applyEffectsPure(nextStats, nextBank, nextFlags, item.baseEffects);
      nextStats = applied.stats;
      nextBank = applied.bank;
      nextFlags = applied.flags;
    }
    if (nextBank !== bank) setBank(nextBank);
    if (item.baseEffects) {
      setStats(nextStats);
      setFlags(nextFlags);
    }

    // 5. Track usage
    if (item.yearlyLimit) {
      setActivitiesThisYear(prev => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
    }

    if (nextBank !== bank || item.baseEffects) {
      persistLife({ bank: nextBank, stats: nextStats, flags: nextFlags });
    }

    // 6. Fire LLM event
    triggerActivityEvent(item.context);
    return 'ok';
  };

  const modifyRelationship = (id, delta) => {
    if (isActionLocked()) return;
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r);
      persistLife({ relationships: next });
      return next;
    });
    if (delta > 0) setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${id}`]: 1 }));
  };

  const modifyProperty = (id, valueDelta) => {
    if (isActionLocked()) return;
    setProperties(prev => {
      const next = prev.map(p => p.id === id ? { ...p, currentValue: p.currentValue + valueDelta } : p);
      persistLife({ properties: next });
      return next;
    });
  };

  const trainHiddenSkill = (skill) => {
    if (isActionLocked()) return 0;
    let gain = Math.floor(Math.random() * 6) + 3;
    const nextStats = { ...stats, [skill]: Math.min(100, (stats[skill] || 0) + gain) };
    setStats(nextStats);
    persistLife({ stats: nextStats });
    return gain;
  };

  const performGig = (name, payout) => {
    if (isActionLocked()) return;
    const newBank = bank + payout;
    const updatedHistory = [...history, { age, text: `Gig: You earned $${payout} from ${name}.` }];
    setBank(newBank);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const executeTrade = (percentage) => {
    if (isActionLocked()) return;
    const trade = executeTradePure(bank, percentage, Math.random());
    if (!trade.ok) return;
    const { wager, payout, profit, multiplier, bank: newBank } = trade;
    let msg = profit > 0 ? `Day Trade: Risked $${wager}, walked away with $${payout} (+$${profit}).` : `Day Trade: Risked $${wager} and lost $${Math.abs(profit)}.`;
    if (multiplier === 0) msg = `Day Trade: You risked $${wager} and got wiped out completely!`;
    const updatedHistory = [...history, { age, text: msg }];
    setBank(newBank);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const startStartup = () => {
    if (isActionLocked()) return 'blocked';
    const launch = computeStartupLaunch(bank, career);
    if (!launch.ok) return launch.reason;
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `You invested $${STARTUP_COST} and launched your own startup.` }];
    setBank(launch.newBank);
    setCareer(launch.career);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: launch.newBank, career: launch.career, careerMeta: newMeta });
    return 'ok';
  };

  /** Enlist via Military menu — places into soldier career track (branch is flavor in history). */
  const enlistMilitary = (branch = 'Army') => {
    if (isActionLocked()) return 'blocked';
    const soldier = careersData.find((c) => c.id === MILITARY_ENLIST_CAREER_ID);
    if (!soldier) return 'missing';
    const { eligible, reason } = checkCareerEligibility(soldier);
    if (!eligible) {
      const updatedHistory = [...history, { age, text: `Military: Couldn't enlist in the ${branch} — ${reason}.` }];
      setHistory(updatedHistory);
      persistLife({ history: updatedHistory });
      return 'ineligible';
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `Military: You enlisted in the ${branch} as a ${soldier.title}.` }];
    setCareer(soldier);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ career: soldier, careerMeta: newMeta, history: updatedHistory });
    triggerActivityEvent(`Enlisted in the ${branch} and began basic training as a ${soldier.title}.`);
    return 'ok';
  };

  /** Pay headhunter fee and take the highest-salary eligible full-time job. */
  const hireViaHeadhunter = () => {
    if (isActionLocked()) return 'blocked';
    if (!canAffordHeadhunter(bank)) return 'broke';
    const pick = pickHeadhunterPlacement(careersData, { age, education, stats, networking });
    const newBank = bank - HEADHUNTER_COST;
    if (!pick) {
      const updatedHistory = [...history, { age, text: `Career: Paid a headhunter $${HEADHUNTER_COST.toLocaleString()} but they found no roles you qualify for.` }];
      setBank(newBank);
      setHistory(updatedHistory);
      persistLife({ bank: newBank, history: updatedHistory });
      return 'no_match';
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `Career: Headhunter placed you as a ${pick.title} (−$${HEADHUNTER_COST.toLocaleString()}).` }];
    setBank(newBank);
    setCareer(pick);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ bank: newBank, career: pick, careerMeta: newMeta, history: updatedHistory });
    triggerActivityEvent(`Paid a headhunter $${HEADHUNTER_COST} who placed you in an executive-track role as a ${pick.title}.`);
    return 'ok';
  };

  const playLottery = (ticketCount = 1) => {
    if (isActionLocked()) return;
    const cost = 5 * ticketCount;
    if (bank < cost) return;
    let won = false;
    for (let i = 0; i < ticketCount; i++) { if (Math.random() < 0.00001) { won = true; break; } }
    const newBank = won ? bank - cost + 10000000 : bank - cost;
    const msg = won
      ? `Lottery: HOLY MOLY! You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} and WON $10,000,000!`
      : `Lottery: You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} ($${cost}) and lost.`;
    setBank(newBank);
    const updatedHistory = [...history, { age, text: msg }];
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const studyHard = () => {
    if (isActionLocked()) return;
    const nextStats = {
      ...stats,
      happiness: Math.max(0, stats.happiness - 10),
      smarts: Math.min(100, stats.smarts + 2),
      grades: Math.min(100, stats.grades !== undefined ? stats.grades + 5 : 75),
    };
    const updatedHistory = [...history, { age, text: "You studied extremely hard for your classes." }];
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, stats: nextStats });
  };

  const goGamble = (amount) => {
    if (isActionLocked()) return 'blocked';
    const result = computeGambleResult(bank, amount, Math.random());
    if (!result.ok) return result.reason;
    let msg;
    if (result.outcome === 'win') {
      msg = `Casino: You gambled $${amount.toLocaleString()} and WON $${result.payout.toLocaleString()}!`;
    } else if (result.outcome === 'partial') {
      msg = `Casino: You gambled $${amount.toLocaleString()} and got half back ($${result.payout.toLocaleString()}).`;
    } else {
      msg = `Casino: You gambled $${amount.toLocaleString()} and lost it all.`;
    }
    const nextStats = { ...stats, happiness: Math.max(0, stats.happiness + result.happinessDelta) };
    const updatedHistory = [...history, { age, text: msg }];
    setBank(result.newBank);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: result.newBank, stats: nextStats });
    return result.outcome;
  };

  const visitDoctor = (visitType = 'checkup') => {
    if (isActionLocked()) return;
    const DOCTOR_VISITS = {
      checkup:   { cost: 100,  health: 15, happiness: 3,  label: 'General Checkup' },
      specialist: { cost: 500,  health: 25, happiness: 5,  label: 'Specialist Visit' },
      surgery:   { cost: 5000, health: 40, happiness: -5, label: 'Minor Surgery' },
      therapy:   { cost: 200,  health: 5,  happiness: 20, label: 'Therapy Session' },
    };
    const visit = DOCTOR_VISITS[visitType] ?? DOCTOR_VISITS.checkup;
    if (bank < visit.cost) return;
    const newBank = bank - visit.cost;
    const nextStats = {
      ...stats,
      health:    Math.min(100, stats.health    + visit.health),
      happiness: Math.min(100, Math.max(0, stats.happiness + visit.happiness)),
    };
    const updatedHistory = [...history, { age, text: `Doctor: Paid $${visit.cost.toLocaleString()} for a ${visit.label}. (+${visit.health} Health)` }];
    setBank(newBank);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank, stats: nextStats });
  };

  const addRelationship = (npc) => {
    if (isActionLocked()) return;
    const normalized = normalizeRelationshipNpc(npc, { asDating: true });
    const updatedRels = [...relationships, normalized];
    const updatedHistory = [...history, { age, text: `Relationships: You are now dating ${normalized.name}.` }];
    setRelationships(updatedRels);
    setHistory(updatedHistory);
    setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${normalized.id}`]: 1 }));
    persistLife({ relationships: updatedRels, history: updatedHistory });
  };

  /** Returns false if yearlyLimit already reached; otherwise increments the slot. */
  const consumeYearlyActivity = (categoryId, itemText, yearlyLimit) => {
    if (!canConsumeYearlyActivity(activitiesThisYear, categoryId, itemText, yearlyLimit)) return false;
    if (!yearlyLimit) return true;
    const trackId = yearlyActivityTrackId(categoryId, itemText);
    setActivitiesThisYear(prev => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
    return true;
  };

  // ─── Relationship engine functions ───────────────────────────────────────────

  const markRelInteraction = (id) => {
    setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${id}`]: 1 }));
  };

  const proposeMarriage = (id) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || rel.status !== 'dating' || rel.relation < 80 || age < 18) return 'blocked';
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: 'married', type: 'Spouse' } : r);
      persistLife({ relationships: next });
      return next;
    });
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You proposed to ${rel.name} and got married! 💍` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const breakUp = (id) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || (rel.status !== 'dating' && rel.status !== 'married')) return 'blocked';
    const wasMarried = rel.status === 'married';
    let divorceCostAmount = 0;
    let newBank = bank;
    if (wasMarried) {
      divorceCostAmount = Math.min(50000, Math.max(5000, Math.floor(bank * 0.15)));
      newBank = bank - divorceCostAmount;

      const playerChildren = relationships.filter(r => r.isAlive && r.type === 'Child');
      if (playerChildren.length > 0) {
        const childNamesStr = playerChildren.map(c => c.name).join(', ');
        setCurrentEvent({
          id: 'custody_battle',
          isCustodyBattle: true,
          exId: rel.id,
          childIds: playerChildren.map(c => c.id),
          description: `Your divorce from ${rel.name} has turned contentious. They're fighting for full custody of ${childNamesStr}. How do you respond?`,
          choices: [
            {
              text: 'Fight for full custody (hire lawyer, -$10,000)',
              effects: { bank: -10000 },
              custodyOutcome: 'fight',
            },
            {
              text: 'Negotiate joint custody (-$3,000, $2,400/yr child support)',
              effects: { bank: -3000 },
              custodyOutcome: 'negotiate',
            },
            {
              text: 'Let them have the kids',
              effects: { happiness: -20 },
              custodyOutcome: 'surrender',
            },
          ],
        });
        setBank(newBank);
        setStats(prev => ({ ...prev, happiness: Math.max(0, prev.happiness - 15) }));
        setRelationships(prev => {
          const next = prev.map(r => r.id === rel.id ? markAsEx(r) : r);
          persistLife({ relationships: next, bank: newBank });
          return next;
        });
        setHistory(prev => {
          const updated = [...prev, { age, text: `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.` }];
          persistLife({ history: updated });
          return updated;
        });
        return 'ok';
      }

      setBank(newBank);
    }
    setStats(prev => ({ ...prev, happiness: Math.max(0, prev.happiness - 15) }));
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? markAsEx(r) : r);
      persistLife({ relationships: next, ...(wasMarried ? { bank: newBank } : {}) });
      return next;
    });
    setHistory(prev => {
      const msg = wasMarried
        ? `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.`
        : `Relationships: You broke up with ${rel.name}. -15 Happiness.`;
      const updated = [...prev, { age, text: msg }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const haveChild = (partnerId) => {
    if (isActionLocked()) return 'blocked_busy';
    const partner = relationships.find(r => r.id === partnerId);
    if (!partner || (partner.status !== 'married' && partner.status !== 'dating')) return 'blocked_partner';
    if (age < 18 || age > 55) return 'blocked_age';
    const childNames = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Luna', 'Leo', 'Isla', 'Owen'];
    const childName = childNames[Math.floor(Math.random() * childNames.length)];
    const child = {
      id: `rel_${Date.now()}_child`,
      type: 'Child',
      name: childName,
      age: 0,
      relation: 90 + Math.floor(Math.random() * 10),
      status: 'family',
      isAlive: true,
    };
    setRelationships(prev => {
      const next = [...prev, child];
      persistLife({ relationships: next });
      return next;
    });
    setStats(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 20) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You and ${partner.name} welcomed a child, ${childName}! +20 Happiness. 👶` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const giftRelationship = (id, amount) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || bank < amount) return 'blocked';
    const relationGain = amount >= 1000 ? 20 : amount >= 200 ? 10 : 5;
    const newBank = bank - amount;
    setBank(newBank);
    setRelationships(prev => {
      const next = prev.map(r => r.id === id
        ? { ...r, relation: Math.min(100, r.relation + relationGain) }
        : r
      );
      persistLife({ relationships: next, bank: newBank });
      return next;
    });
    markRelInteraction(id);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You gifted ${rel.name} $${amount.toLocaleString()}. +${relationGain} Relation.` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const meetFriend = () => {
    if (isActionLocked()) return;
    const friendNames = ['Jordan', 'Casey', 'Morgan', 'Alex', 'Riley', 'Taylor', 'Sam', 'Drew', 'Quinn', 'Blake'];
    const friendName = friendNames[Math.floor(Math.random() * friendNames.length)];
    const friend = {
      id: `rel_${Date.now()}_friend`,
      type: 'Friend',
      name: friendName,
      age: age + Math.floor(Math.random() * 10) - 5,
      relation: 40 + Math.floor(Math.random() * 30),
      status: 'friend',
      isAlive: true,
    };
    setRelationships(prev => {
      const next = [...prev, friend];
      persistLife({ relationships: next });
      return next;
    });
    setStats(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 5) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You met a new friend, ${friendName}. +5 Happiness.` }];
      persistLife({ history: updated });
      return updated;
    });
  };

  const surrender = () => {
    if (isAging) return;
    const nextStats = { ...stats, health: 0 };
    const updatedHistory = [...history, { age, text: `You surrendered to the void.` }];
    setStats(nextStats);
    setIsDead(true);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, stats: nextStats, isDead: true });
  };

  /**
   * Draft (or replace) the will. Empty allocations = standard even-split will.
   * DeathScreen settles the estate from this via computeEstateDistribution.
   */
  const draftWill = (allocations) => {
    if (isActionLocked()) return 'locked';
    const draft = prepareWillDraft(allocations, relationships);
    if (!draft.ok) return draft.reason;
    const nextWill = { allocations: draft.allocations, draftedAtAge: age };
    setWill(nextWill);
    persistLife({ will: nextWill });
    return 'ok';
  };

  const triggerActivityEvent = async (context) => {
    if (isDead || currentEvent || isAging) return;
    setIsAging(true);
    try {
      const cityName = getCityById(character?.city)?.name ?? null;
      const snap = lifeSnapshotRef.current;
      const stateDump = {
        character: snap.character, age: snap.age, bank: snap.bank, stats: snap.stats,
        career: snap.career, history: snap.history, narrativeMode, relationships: snap.relationships,
        pets: snap.pets, city: cityName, education: snap.education, economyPhase: snap.economyCycle?.phase,
      };
      const parsed = await generateDynamicEvent(stateDump, context);

      if (parsed && parsed.choices && parsed.description) {
        setCurrentEvent(parsed);
      } else {
        setCurrentEvent({
          description: 'LLM ERROR: Dynamic activity event generation returned no event.',
          choices: [{ text: 'Understood', effects: {} }],
        });
      }
    } catch {
      emitLlmDiagnostic({ type: 'failure', code: 'service' });
      setCurrentEvent({
        description: 'LLM ERROR: Dynamic activity event generation failed. Please try again.',
        choices: [{ text: 'Understood', effects: {} }],
      });
    } finally {
      setIsAging(false);
    }
  };

  const adoptPet = (speciesId) => {
    if (isActionLocked()) return;
    const petDef = PET_CATALOG[speciesId];
    if (!petDef) return;
    if (bank < petDef.adoptCost) {
      setHistory(prev => [...prev, { age, text: `Pets: You can't afford to adopt a ${petDef.species} ($${petDef.adoptCost.toLocaleString()}).` }]);
      return;
    }
    const petName = petDef.namePool[Math.floor(Math.random() * petDef.namePool.length)];
    const newPet = {
      id: Date.now().toString(),
      speciesId,
      name: petName,
      age: 0,
      health: 80,
      isAlive: true,
    };
    const nextPets = [...pets, newPet];
    const newBank = bank - petDef.adoptCost;
    const updatedHistory = [...history, { age, text: `Pets: You adopted a ${petDef.species} named ${petName}! 🐾` }];
    setBank(newBank);
    setPets(nextPets);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, pets: nextPets, bank: newBank });
  };

  const visitVet = (petId) => {
    if (isActionLocked()) return;
    const vetCost = 150;
    if (bank < vetCost) {
      setHistory(prev => [...prev, { age, text: `Pets: You can't afford the vet visit ($${vetCost}).` }]);
      return;
    }
    const newBank = bank - vetCost;
    const nextPets = pets.map(p => p.id === petId ? { ...p, health: Math.min(100, p.health + 20) } : p);
    const updatedHistory = [...history, { age, text: `Pets: Vet visit — +20 health. Cost: $${vetCost}.` }];
    setBank(newBank);
    setPets(nextPets);
    setHistory(updatedHistory);
    persistLife({ pets: nextPets, history: updatedHistory, bank: newBank });
  };

  const buyAsset = (category, item) => {
    if (isActionLocked()) return;
    if (bank < item.cost) return;
    const newBank = bank - item.cost;
    setBank(newBank);

    const newAsset = {
      ...item,
      id: `${category}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      catalogId: item.id,       // retain reference for catalog lookups in ageUp
      currentValue: item.cost,
      purchasePrice: item.cost,
      yearsOwned: 0
    };

    if (category === 'property') {
      setProperties(prev => {
        const next = [...prev, newAsset];
        persistLife({ properties: next, bank: newBank });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Real Estate: Purchased a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    } else {
      setBelongings(prev => {
        const next = [...prev, newAsset];
        persistLife({ belongings: next, bank: newBank });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Shopping: Bought a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    }
  };

  const sellAsset = (category, id) => {
    if (isActionLocked()) return;
    const isProperty = category === 'property';
    const asset = isProperty ? properties.find(p => p.id === id) : belongings.find(b => b.id === id);
    if (!asset) return;

    const tier = getWealthTier(bank);
    const cgt = calculateCapitalGainsTax(asset.purchasePrice ?? asset.cost ?? 0, asset.currentValue, tier.capitalGainsTaxRate ?? 0);
    const proceeds = Math.floor(asset.currentValue) - cgt;
    const gain = Math.floor(asset.currentValue) - (asset.purchasePrice ?? asset.cost ?? 0);

    const newBank = bank + proceeds;
    const gainStr = gain > 0 ? ` (+$${gain.toLocaleString()} gain, $${cgt.toLocaleString()} CGT)` : gain < 0 ? ` (loss of $${Math.abs(gain).toLocaleString()})` : '';
    const msg = `${isProperty ? 'Real Estate' : 'Assets'}: Sold ${asset.name} for $${Math.floor(asset.currentValue).toLocaleString()}${gainStr}. Net proceeds: $${proceeds.toLocaleString()}.`;
    const updatedHistory = [...history, { age, text: msg }];

    setBank(newBank);
    if (isProperty) {
      const next = properties.filter(p => p.id !== id);
      setProperties(next);
      setHistory(updatedHistory);
      persistLife({ properties: next, bank: newBank, history: updatedHistory });
    } else {
      const next = belongings.filter(b => b.id !== id);
      setBelongings(next);
      setHistory(updatedHistory);
      persistLife({ belongings: next, bank: newBank, history: updatedHistory });
    }
  };

  /**
   * Buy a variable-amount investment from the investments hub.
   * subType: 'crypto' | 'stock' | 'penny_stock' | 'bond' | 'fund'
   * instrument: one of the objects from investmentMarket.js
   * amountDollars: how much the player wants to invest
   */
  const buyInvestment = (instrument, amountDollars, subType) => {
    if (isActionLocked()) return 'blocked';
    const purchase = prepareInvestmentPurchase(instrument, amountDollars, subType, bank);
    if (!purchase.ok) return purchase.reason;
    const { subType: normalizedSubType, units, pricePerUnit, actualCost } = purchase;
    const newBank = bank - actualCost;

    const displayName = normalizedSubType === 'bond'
      ? `${instrument.name} (${instrument.maturity}-Yr)`
      : instrument.ticker
        ? `${instrument.name} (${instrument.ticker})`
        : instrument.name;

    const newInv = {
      id: `inv_${normalizedSubType}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      type: 'investment',
      subType: normalizedSubType,
      instrumentId: instrument.id,
      catalogId: instrument.id,
      name: displayName,
      icon: instrument.icon ?? '📊',
      units,
      pricePerUnit,
      currentPricePerUnit: pricePerUnit,
      purchasePrice: actualCost,
      currentValue: actualCost,
      yearsOwned: 0,
      upkeep: 0,
      couponRate: instrument.coupon ?? null,
      maturityYears: instrument.maturity ?? null,
      yearsToMaturity: instrument.maturity ?? null,
      entity: instrument.entity ?? null,
      volatility: instrument.volatility ?? 0,
      trendiness: instrument.trendiness ?? 0,
      baseReturn: instrument.baseReturn ?? 0,
      returnProfile: instrument.returnProfile ?? null,
      sector: instrument.sector ?? null,
    };

    const nextBelongings = [...belongings, newInv];
    const unitsLabel = normalizedSubType === 'bond'
      ? `$${actualCost.toLocaleString()} principal`
      : `${units.toLocaleString()} units @ $${pricePerUnit.toLocaleString()}`;
    const updatedHistory = [...history, { age, text: `Investing: Bought ${displayName} — ${unitsLabel}.` }];
    setBank(newBank);
    setBelongings(nextBelongings);
    setHistory(updatedHistory);
    persistLife({ belongings: nextBelongings, bank: newBank, history: updatedHistory });
    return 'ok';
  };

  const sellInvestment = (belongingId) => {
    if (isActionLocked()) return;
    const item = belongings.find(b => b.id === belongingId);
    if (!item) return;

    const tier = getWealthTier(bank);
    const sale = computeInvestmentSale(item, bank, tier.capitalGainsTaxRate ?? 0);
    let historyNote;

    if (sale.isBond) {
      historyNote = `Sold ${item.name} early — recovered $${sale.proceeds.toLocaleString()} principal.`;
    } else {
      const gainStr = sale.gain > 0 ? ` (+$${sale.gain.toLocaleString()} gain, $${sale.cgt.toLocaleString()} CGT)` : sale.gain < 0 ? ` (loss of $${Math.abs(sale.gain).toLocaleString()})` : '';
      historyNote = `Sold ${item.name} for $${Math.floor(item.currentValue).toLocaleString()}${gainStr}. Net: $${sale.proceeds.toLocaleString()}.`;
    }

    const newBank = sale.newBank;
    const nextBelongings = belongings.filter(b => b.id !== belongingId);
    const updatedHistory = [...history, { age, text: `Investing: ${historyNote}` }];
    setBank(newBank);
    setBelongings(nextBelongings);
    setHistory(updatedHistory);
    persistLife({ belongings: nextBelongings, bank: newBank, history: updatedHistory });
  };

  const attendNetworkingEvent = () => {
    if (isActionLocked()) return;
    if (bank < 200) return;
    const newBank = bank - 200;
    const nextNetworking = Math.min(100, networking + 5);
    const nextStats = { ...stats, happiness: Math.min(100, stats.happiness + 2) };
    const updatedHistory = [...history, { age, text: `Career: Attended a networking event (+5 Networking). Cost $200.` }];
    setBank(newBank);
    setNetworking(nextNetworking);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank, networking: nextNetworking, stats: nextStats });
    triggerActivityEvent('Attended a professional networking mixer to meet industry contacts.');
  };

  const emigrate = (cityId) => {
    if (isActionLocked()) return;
    const city = getCityById(cityId);
    if (!city) return;
    if (bank < city.moveCost) {
      setHistory(prev => [...prev, { age, text: `You can't afford to move to ${city.name} (costs $${city.moveCost.toLocaleString()}).` }]);
      return;
    }
    const newBank = bank - city.moveCost;
    const nextChar = { ...character, city: cityId, country: city.country };
    const updatedHistory = [...history, { age, text: `✈️ You moved to ${city.name}, ${city.country}. New chapter begins.` }];
    setBank(newBank);
    setCharacter(nextChar);
    setHistory(updatedHistory);
    persistLife({ character: nextChar, bank: newBank, history: updatedHistory });
  };

  const debugGrantDegree = (degreeType) => {
    setEducation(prev => {
      const next = { ...prev, [degreeType]: true };
      persistLife({ education: next });
      return next;
    });
  };

  const debugSetEconomy = (phase) => {
    const next = { year: economyCycle.year, phase, yearsInPhase: 0 };
    setEconomyCycle(next);
    persistLife({ economyCycle: next });
  };

  const debugAddNetworking = (amount) => {
    setNetworking(prev => {
      const next = Math.min(100, prev + amount);
      persistLife({ networking: next });
      return next;
    });
  };

  const debugModifyBank = (amount) => {
    setBank(prev => prev + amount);
    persistLife({ bank: bank + amount });
  };

  const debugAddAge = (years) => {
    setAge(prev => prev + years);
    setProperties(prev => prev.map(p => ({ ...p, yearsOwned: p.yearsOwned + years })));
    setBelongings(prev => prev.map(b => ({ ...b, yearsOwned: b.yearsOwned + years })));
    persistLife({ age: age + years });
    setHistory(prev => [...prev, { age: age+years, text: `[DEV] Fast-forwarded time by ${years} years.` }]);
  };

  const debugMaxStats = () => {
    setStats(prev => {
      const max = { ...prev, health: 100, happiness: 100, smarts: 100, looks: 100, grades: 100, athleticism: 100, karma: 100, acting: 100, voice: 100, modeling: 100 };
      persistLife({ stats: max });
      return max;
    });
  };

  return {
    character,
    age,
    stats,
    bank,
    flags,
    isDead,
    career,
    careersData,
    careerMeta,
    networking,
    economyCycle,
    education,
    history,
    currentEvent,
    activitiesThisYear,
    isAging,
    relationships,
    belongings,
    properties,
    pets,
    will,
    draftWill,
    authAccount,
    signInWithGoogle,
    signOutAccount,
    adoptPet,
    visitVet,
    buyAsset,
    sellAsset,
    debugModifyBank,
    debugAddAge,
    debugMaxStats,
    debugGrantDegree,
    debugSetEconomy,
    debugAddNetworking,
    startLife,
    resetLife,
    ageUp,
    handleChoice,
    chooseCareer,
    checkCareerEligibility,
    enrollInDegree,
    attendNetworkingEvent,
    emigrate,
    performActivity,
    modifyRelationship,
    modifyProperty,
    trainHiddenSkill,
    performGig,
    executeTrade,
    startStartup,
    enlistMilitary,
    hireViaHeadhunter,
    playLottery,
    studyHard,
    goGamble,
    visitDoctor,
    surrender,
    addRelationship,
    proposeMarriage,
    breakUp,
    haveChild,
    giftRelationship,
    meetFriend,
    consumeYearlyActivity,
    buyInvestment,
    sellInvestment,
    triggerActivityEvent,
    narrativeMode,
    setNarrativeMode,
  };
}
