import { EFFECT_STAT_KEYS } from './mechanics/life';

const EVENT_KEYS = new Set(['version', 'id', 'age', 'source', 'description', 'choices', 'meta', 'isCustodyBattle', 'exId', 'childIds']);
const RAW_EVENT_KEYS = new Set(['id', 'description', 'choices', 'meta', 'isCustodyBattle', 'exId', 'childIds']);
const SOURCES = new Set(['annual', 'activity', 'custody', 'legacy', 'recovery']);
const EFFECT_KEYS = new Set([...EFFECT_STAT_KEYS, 'bank', 'flags']);
const CHOICE_KEYS = new Set(['text', 'effects']);
const CUSTODY_CHOICE_KEYS = new Set([...CHOICE_KEYS, 'custodyOutcome']);
const CUSTODY_EFFECTS = { fight: { bank: -10000 }, negotiate: { bank: -3000 }, surrender: { happiness: -20 } };
const RESERVED_COUNTER_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const META_KEYS = new Set(['requestId', 'model', 'latencyMs', 'usage']);
const USAGE_KEYS = new Set(['inputTokens', 'outputTokens', 'cachedInputTokens', 'totalTokens']);
const RECOVERY_DESCRIPTION = 'This saved choice is unavailable. Clearing it applies no outcome and keeps your loaded life.';
const RECOVERY_CHOICE = 'Clear unavailable choice';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, keys) => Object.keys(value).every(key => keys.has(key));
const nonblank = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const validAge = value => Number.isSafeInteger(value) && value >= 0;
const validFlag = flag => typeof flag === 'string' && flag.length <= 48 && /^[a-z0-9][a-z0-9_-]*$/.test(flag);
const nonnegativeFinite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function recoveryEvent(id, age) {
  return { version: 1, id, age, source: 'recovery', description: RECOVERY_DESCRIPTION, choices: [{ text: RECOVERY_CHOICE, effects: {} }] };
}

function validEffects(effects) {
  if (!isRecord(effects)) return false;
  return Object.entries(effects).every(([key, value]) => {
    if (!EFFECT_KEYS.has(key)) return false;
    if (key === 'flags') {
      return Array.isArray(value) && value.length >= 1 && value.length <= 4
        && Array.from(value).every(validFlag) && new Set(value).size === value.length;
    }
    return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= (key === 'bank' ? 100000 : 100);
  });
}

function validCustody(event, relationships) {
  if (event.isCustodyBattle !== true || !['custody', 'legacy'].includes(event.source)) return false;
  if (!Array.isArray(relationships) || typeof event.exId !== 'string' || !event.exId) return false;
  const exMatches = relationships.filter(rel => isRecord(rel) && rel.id === event.exId);
  if (exMatches.length !== 1 || exMatches[0].status !== 'ex') return false;
  if (!Array.isArray(event.childIds) || !event.childIds.length || new Set(event.childIds).size !== event.childIds.length) return false;
  for (const id of event.childIds) {
    if (typeof id !== 'string' || !id) return false;
    const matches = relationships.filter(rel => isRecord(rel) && rel.id === id);
    if (matches.length !== 1 || matches[0].type !== 'Child' || matches[0].isAlive !== true) return false;
  }
  if (event.choices.length !== 3) return false;
  const outcomes = new Set();
  for (const choice of event.choices) {
    if (typeof choice.custodyOutcome !== 'string') return false;
    const expected = Object.hasOwn(CUSTODY_EFFECTS, choice.custodyOutcome) ? CUSTODY_EFFECTS[choice.custodyOutcome] : null;
    if (!expected || outcomes.has(choice.custodyOutcome)) return false;
    outcomes.add(choice.custodyOutcome);
    const entries = Object.entries(expected);
    if (Object.keys(choice.effects).length !== entries.length
      || !entries.every(([key, value]) => Object.hasOwn(choice.effects, key) && choice.effects[key] === value)) return false;
  }
  return true;
}

/** Validate semantics only. Optional metadata is separately projected, never executed. */
export function validatePendingEvent(event, { age, relationships = [] } = {}) {
  const invalid = reason => ({ valid: false, reason });
  if (!isRecord(event) || !hasOnlyKeys(event, EVENT_KEYS)) return invalid('invalid_event');
  if (event.version !== 1 || !validId(event.id) || !validAge(event.age) || event.age !== age || !SOURCES.has(event.source)) return invalid('invalid_envelope');
  if (!nonblank(event.description, 4096) || !Array.isArray(event.choices) || event.choices.length < 1 || event.choices.length > 3) return invalid('invalid_content');
  const custody = event.isCustodyBattle === true;
  for (const choice of event.choices) {
    if (!isRecord(choice) || !hasOnlyKeys(choice, custody ? CUSTODY_CHOICE_KEYS : CHOICE_KEYS)
      || !nonblank(choice.text, 160) || !validEffects(choice.effects)) return invalid('invalid_choice');
  }
  if (event.source === 'recovery') {
    if (event.description !== RECOVERY_DESCRIPTION || event.choices.length !== 1
      || event.choices[0].text !== RECOVERY_CHOICE || Object.keys(event.choices[0].effects).length
      || ['meta', 'isCustodyBattle', 'exId', 'childIds'].some(key => Object.hasOwn(event, key))) return invalid('invalid_recovery');
  } else if (custody) {
    if (!validCustody(event, relationships)) return invalid('invalid_custody');
  } else if (event.source === 'custody' || ['isCustodyBattle', 'exId', 'childIds'].some(key => Object.hasOwn(event, key))) {
    return invalid('invalid_custody');
  }
  return { valid: true, reason: null };
}

function projectMeta(meta) {
  if (!isRecord(meta) || !hasOnlyKeys(meta, META_KEYS)
    || !nonblank(meta.requestId, 128) || !nonblank(meta.model, 100) || !nonnegativeFinite(meta.latencyMs)) {
    return { meta: undefined, malformed: true };
  }
  const projected = { requestId: meta.requestId, model: meta.model, latencyMs: meta.latencyMs };
  let malformed = false;
  if (Object.hasOwn(meta, 'usage')) {
    if (!isRecord(meta.usage)) malformed = true;
    else {
      const usage = {};
      for (const [key, value] of Object.entries(meta.usage)) {
        if (!USAGE_KEYS.has(key) || !nonnegativeFinite(value)) {
          malformed = true;
          continue;
        }
        usage[key] = value;
      }
      if (Object.keys(usage).length) projected.usage = usage;
    }
  }
  return { meta: projected, malformed };
}

function copyEvent(event) {
  const copy = {
    version: 1, id: event.id, age: event.age, source: event.source, description: event.description,
    choices: event.choices.map(choice => {
      const effects = { ...choice.effects };
      if (effects.flags) effects.flags = [...effects.flags];
      const projected = { text: choice.text, effects };
      if (event.isCustodyBattle) projected.custodyOutcome = choice.custodyOutcome;
      return projected;
    }),
  };
  if (event.isCustodyBattle) Object.assign(copy, { isCustodyBattle: true, exId: event.exId, childIds: [...event.childIds] });
  let malformedMeta = false;
  if (Object.hasOwn(event, 'meta')) {
    const result = projectMeta(event.meta);
    if (result.meta) copy.meta = result.meta;
    malformedMeta = result.malformed;
  }
  return { event: copy, malformedMeta };
}

function prepare(raw, { id, age, source, relationships = [] }) {
  if (raw === null || raw === undefined) return { event: null, malformed: false, malformedMeta: false };
  let candidate = raw;
  if (isRecord(raw) && !Object.hasOwn(raw, 'version') && hasOnlyKeys(raw, RAW_EVENT_KEYS)) {
    candidate = { ...raw, version: 1, id, age, source };
  }
  if (!validatePendingEvent(candidate, { age, relationships }).valid) {
    return { event: recoveryEvent(id, age), malformed: true, malformedMeta: false };
  }
  return { ...copyEvent(candidate), malformed: false };
}

/** Wrap a raw offer, preserve a versioned offer, or return an explicit safe recovery. */
export function preparePendingEvent(raw, options) {
  return prepare(raw, options).event;
}

/** Normalize only continuity fields; no mutation, generated identity, RNG, or I/O. */
export function restoreLifeContinuity(save, { newEventId } = {}) {
  const issues = [];
  const issue = (code, field) => issues.push({ code, field });
  const flags = [];
  const seen = new Set();
  if (save.flags != null) {
    if (!Array.isArray(save.flags)) issue('invalid_type', 'flags');
    else {
      let malformed = false;
      for (const flag of save.flags) {
        if (!validFlag(flag) || seen.has(flag)) { malformed = true; continue; }
        seen.add(flag);
        flags.push(flag);
      }
      if (malformed) issue('invalid_value', 'flags');
    }
  }
  const activitiesThisYear = {};
  const inactive = save.isDead === true || !save.character;
  if (save.activitiesThisYear != null) {
    if (!isRecord(save.activitiesThisYear)) issue('invalid_type', 'activitiesThisYear');
    else {
      let malformed = false;
      for (const [key, count] of Object.entries(save.activitiesThisYear)) {
        if (inactive || key.length < 1 || key.length > 512 || RESERVED_COUNTER_KEYS.has(key) || !Number.isSafeInteger(count) || count < 0) {
          malformed = true;
          continue;
        }
        activitiesThisYear[key] = count;
      }
      if (malformed) issue('invalid_value', 'activitiesThisYear');
    }
  }
  let currentEvent = null;
  if (inactive) {
    if (save.currentEvent != null) issue('invalid_value', 'currentEvent');
  } else {
    const prepared = prepare(save.currentEvent, { id: newEventId, age: save.age, source: 'legacy', relationships: save.relationships });
    currentEvent = prepared.event;
    if (prepared.malformed) issue('invalid_value', 'currentEvent');
    else if (prepared.malformedMeta) issue('invalid_metadata', 'currentEvent');
  }
  return { flags, activitiesThisYear, currentEvent, issues };
}
