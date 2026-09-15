/** Game rules extracted from the state owner; keep runtime behavior here testable. */

export const MATERNAL_NAMES = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"];

export const PATERNAL_NAMES = ["James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles"];

export const NAMES = [...MATERNAL_NAMES, ...PATERNAL_NAMES];

export const NPC_JOB_LABELS = ['teacher', 'nurse', 'accountant', 'engineer', 'chef',
                        'electrician', 'journalist', 'manager', 'therapist', 'designer'];

export const NPC_STARTER_JOBS = ['barista', 'intern', 'junior developer', 'sales rep', 'assistant'];

/** Keep gendered parent labels aligned with the generated first-name pool. */
export function pickParentName(parentType, randomValue = Math.random()) {
  const pool = parentType === 'Mother' ? MATERNAL_NAMES : PATERNAL_NAMES;
  const safeRandom = Number.isFinite(randomValue) ? Math.min(0.999999, Math.max(0, randomValue)) : 0;
  return pool[Math.floor(safeRandom * pool.length)];
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
