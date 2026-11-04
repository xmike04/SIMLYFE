import { describe, expect, it } from 'vitest';
import { preparePendingEvent, restoreLifeContinuity, validatePendingEvent } from '../engine/lifeContinuity';
import { buildLifeSave } from '../engine/lifeSave';

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const annual = freeze({
  version: 1, id: 'annual-30', age: 30, source: 'annual',
  description: 'A new opportunity appeared.',
  choices: [{ text: 'Consider the opportunity', effects: { bank: 250, flags: ['opportunity_seen'] } }],
});
const life = freeze({
  character: { name: 'Ada', gender: 'Female', country: 'USA' }, age: 30,
  stats: { health: 50, happiness: 50, smarts: 50, looks: 50, grades: 50, athleticism: 50, karma: 50, acting: 50, voice: 50, modeling: 50 },
  bank: 20000, history: [{ age: 29, text: 'An existing memory.' }], isDead: false,
  relationships: [], flags: ['opportunity_seen'], activitiesThisYear: { 'vacation__Staycation': 1 }, currentEvent: annual,
});
const context = { id: 'fresh-event', age: 30, source: 'activity', relationships: [] };
const restore = save => restoreLifeContinuity(save, { newEventId: 'fresh-event' });
const recovery = {
  version: 1, id: 'fresh-event', age: 30, source: 'recovery',
  description: 'This saved choice is unavailable. Clearing it applies no outcome and keeps your loaded life.',
  choices: [{ text: 'Clear unavailable choice', effects: {} }],
};
function expectRecovery(event, relationships = []) {
  const save = freeze({ ...life, relationships, currentEvent: event });
  const before = structuredClone(save);
  const result = restore(save);
  expect(result.currentEvent).toEqual(recovery);
  expect(result.issues).toContainEqual({ code: 'invalid_value', field: 'currentEvent' });
  expect(save).toEqual(before);
  expect(save.bank).toBe(20000);
}
const relationships = freeze([
  { id: 'ex-1', type: 'Ex', status: 'ex', name: 'Alex', age: 31, relation: 40, isAlive: true },
  { id: 'child-1', type: 'Child', status: 'family', name: 'Sam', age: 8, relation: 70, isAlive: true },
  { id: 'child-2', type: 'Child', status: 'family', name: 'Jo', age: 21, relation: 70, isAlive: true },
]);
const custody = freeze({
  ...annual, id: 'custody-30', source: 'custody', isCustodyBattle: true, exId: 'ex-1', childIds: ['child-1', 'child-2'],
  description: 'Your divorce has turned contentious. How do you respond?',
  choices: [
    { text: 'Fight for full custody', effects: { bank: -10000 }, custodyOutcome: 'fight' },
    { text: 'Negotiate joint custody', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
    { text: 'Let them have the kids', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
  ],
});

describe('restoreLifeContinuity', () => {
  it('restores independent copies of a valid offered event, flags, and counters without changing the frozen save', () => {
    const before = structuredClone(life);
    const restored = restoreLifeContinuity(life, { newEventId: 'unused' });
    expect(restored.currentEvent).toEqual(life.currentEvent);
    expect(restored.currentEvent).not.toBe(life.currentEvent);
    expect(restored.currentEvent.choices[0].effects.flags).not.toBe(life.currentEvent.choices[0].effects.flags);
    expect(restored.flags).toEqual(['opportunity_seen']);
    expect(restored.flags).not.toBe(life.flags);
    expect(restored.activitiesThisYear).toEqual({ 'vacation__Staycation': 1 });
    expect(restored.activitiesThisYear).not.toBe(life.activitiesThisYear);
    expect(restored.issues).toEqual([]);
    expect(life).toEqual(before);
    expect(buildLifeSave()).toMatchObject({ currentEvent: null, activitiesThisYear: {}, flags: [] });
  });

  it.each([undefined, null])('uses compatible defaults for missing/null optional continuity fields (%s)', value => {
    const result = restore({ ...life, flags: value, activitiesThisYear: value, currentEvent: value });
    expect(result).toEqual({ flags: [], activitiesThisYear: {}, currentEvent: null, issues: [] });
  });

  it('defaults absent optional keys without warning', () => {
    const { flags: _flags, activitiesThisYear: _counts, currentEvent: _event, ...legacy } = life;
    expect(restore(legacy)).toEqual({ flags: [], activitiesThisYear: {}, currentEvent: null, issues: [] });
  });

  it('retains more than four lifetime flags and deduplicates/filters invalid entries in first-occurrence order', () => {
    const flags = freeze(['one', 'two', 'three', 'four', 'five', 'one', 'Bad', '', 42, {}, 'x'.repeat(49), 'under_score', 'dash-name', '0']);
    const result = restore({ ...life, flags });
    expect(result.flags).toEqual(['one', 'two', 'three', 'four', 'five', 'under_score', 'dash-name', '0']);
    expect(result.issues).toEqual([{ code: 'invalid_value', field: 'flags' }]);
    expect(restore({ ...life, flags: ['a', 'b', 'c', 'd', 'e'] }).issues).toEqual([]);
  });

  it.each([false, 'private-flags', {}, 12])('rejects a non-array flag field (%s)', flags => {
    expect(restore({ ...life, flags })).toMatchObject({ flags: [], issues: [{ code: 'invalid_type', field: 'flags' }] });
  });

  it('keeps exact own enumerable tracker keys and zero/positive/safe-integer counts', () => {
    const counters = Object.create({ inherited: 3 });
    Object.assign(counters, { 'vacation__Staycation': 1, 'rel_interact__child-1': 0, 'gym__Train': Number.MAX_SAFE_INTEGER, ['x'.repeat(512)]: 2 });
    Object.defineProperty(counters, 'hidden', { value: 3 });
    freeze(counters);
    const restored = restore({ ...life, activitiesThisYear: counters });
    expect(restored.activitiesThisYear).toEqual({ 'vacation__Staycation': 1, 'rel_interact__child-1': 0, 'gym__Train': Number.MAX_SAFE_INTEGER, ['x'.repeat(512)]: 2 });
    expect(restored.issues).toEqual([]);
  });

  it.each(['1', 1.5, -1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, null, false])('drops invalid counts without coercion (%s)', value => {
    const result = restore({ ...life, activitiesThisYear: freeze({ bad: value, good: 1 }) });
    expect(result.activitiesThisYear).toEqual({ good: 1 });
    expect(result.issues).toEqual([{ code: 'invalid_value', field: 'activitiesThisYear' }]);
  });

  it('rejects empty/long/reserved counter keys and never changes prototypes through JSON __proto__', () => {
    const counters = JSON.parse('{"__proto__":{"polluted":true},"prototype":1,"constructor":1,"good":2,"":1}');
    counters['x'.repeat(513)] = 1;
    freeze(counters);
    const result = restore({ ...life, activitiesThisYear: counters });
    expect(result.activitiesThisYear).toEqual({ good: 2 });
    expect(Object.getPrototypeOf(result.activitiesThisYear)).toBe(Object.prototype);
    expect({}.polluted).toBeUndefined();
    expect(result.issues).toEqual([{ code: 'invalid_value', field: 'activitiesThisYear' }]);
  });

  it.each([[], 'private-counters', 1, false])('rejects a non-map counter field (%s)', activitiesThisYear => {
    expect(restore({ ...life, activitiesThisYear })).toMatchObject({ activitiesThisYear: {}, issues: [{ code: 'invalid_type', field: 'activitiesThisYear' }] });
  });

  it.each([{ isDead: true }, { character: null }])('clears event and counters for inactive lives (%j)', patch => {
    const result = restore({ ...life, ...patch });
    expect(result).toMatchObject({ currentEvent: null, activitiesThisYear: {}, flags: ['opportunity_seen'] });
    expect(result.issues).toEqual([
      { code: 'invalid_value', field: 'activitiesThisYear' },
      { code: 'invalid_value', field: 'currentEvent' },
    ]);
    expect(restore({ ...life, ...patch, currentEvent: null, activitiesThisYear: {} }).issues).toEqual([]);
  });
});

describe('pending event boundaries', () => {
  it('prepares ordinary offers with supplied identity/provenance and never reuses a catalog ID', () => {
    const raw = freeze({ id: 'catalog-id', description: annual.description, choices: annual.choices });
    expect(preparePendingEvent(raw, context)).toEqual({ ...annual, id: 'fresh-event', source: 'activity' });
    expect(preparePendingEvent(null, context)).toBeNull();
    expect(preparePendingEvent(undefined, context)).toBeNull();
  });

  it('wraps valid unversioned events with legacy provenance once while retaining versioned identity', () => {
    const raw = freeze({ id: 'catalog-id', description: annual.description, choices: annual.choices });
    const restored = restore({ ...life, currentEvent: raw });
    expect(restored.currentEvent).toEqual({ ...annual, id: 'fresh-event', source: 'legacy' });
    expect(restored.issues).toEqual([]);
    expect(restore({ ...life, currentEvent: restored.currentEvent }).currentEvent.id).toBe('fresh-event');
  });

  it.each(['annual', 'activity', 'legacy'])('accepts ordinary provenance %s', source => {
    expect(validatePendingEvent({ ...annual, source }, { age: 30, relationships: [] })).toEqual({ valid: true, reason: null });
  });

  it('accepts exact saved envelope limits without loosening provider validation', () => {
    const event = { ...annual, id: 'i'.repeat(128), description: 'd'.repeat(4096), choices: [
      { text: 't'.repeat(160), effects: { health: -100, happiness: 100, bank: 100000, flags: ['a', 'b', 'c', 'd'.repeat(48)] } },
      { text: 'b', effects: { bank: -100000 } }, { text: 'c', effects: {} },
    ] };
    expect(validatePendingEvent(event, { age: 30 })).toEqual({ valid: true, reason: null });
    expect(validatePendingEvent({ ...annual, age: 0 }, { age: 0 }).valid).toBe(true);
    expect(validatePendingEvent({ ...annual, age: Number.MAX_SAFE_INTEGER }, { age: Number.MAX_SAFE_INTEGER }).valid).toBe(true);
  });

  const invalidEvents = [
    ['empty ID', { id: '' }], ['nonstring ID', { id: 42 }], ['long ID', { id: 'i'.repeat(129) }],
    ['missing ID', { id: undefined }], ['unsupported version', { version: 2 }], ['null version', { version: null }],
    ['unknown source', { source: 'network' }], ['missing source', { source: undefined }], ['custody source without payload', { source: 'custody' }],
    ['age mismatch', { age: 29 }], ['fractional age', { age: 30.5 }], ['negative age', { age: -1 }], ['string age', { age: '30' }],
    ['infinite age', { age: Infinity }], ['unsafe age', { age: Number.MAX_SAFE_INTEGER + 1 }],
    ['blank description', { description: ' \n ' }], ['nonstring description', { description: {} }], ['long description', { description: 'd'.repeat(4097) }],
    ['zero choices', { choices: [] }], ['four choices', { choices: Array(4).fill(annual.choices[0]) }], ['non-array choices', { choices: {} }],
    ['unknown semantic key', { secretlyApply: true }], ['forged ex ID', { exId: 'ex-1' }], ['forged child IDs', { childIds: ['child-1'] }], ['false custody marker', { isCustodyBattle: false }],
  ];
  it.each(invalidEvents)('replaces %s with exact no-effect recovery', (_label, patch) => {
    const event = { ...annual, ...patch };
    const validation = validatePendingEvent(event, { age: 30, relationships: [] });
    expect(validation.valid).toBe(false);
    expect(typeof validation.reason).toBe('string');
    expectRecovery(event);
  });

  const invalidChoices = [null, {}, { text: ' ', effects: {} }, { text: 4, effects: {} }, { text: 't'.repeat(161), effects: {} },
    { text: 'ok', effects: null }, { text: 'ok', effects: [] }, { text: 'ok', effects: {}, custodyOutcome: 'fight' }, { text: 'ok', effects: {}, secret: 1 }];
  it.each(invalidChoices)('recovers malformed choice %#', choice => expectRecovery({ ...annual, choices: [choice] }));

  const invalidEffects = [
    { bank: '250' }, { bank: Infinity }, { bank: NaN }, { bank: 100001 }, { bank: -100001 },
    { health: 101 }, { health: -101 }, { health: false }, { health: null }, { smarts: {} }, { unknown: 1 },
    { flags: [] }, { flags: ['a', 'a'] }, { flags: ['a', 'b', 'c', 'd', 'e'] }, { flags: ['UPPER'] }, { flags: [''] },
    { flags: ['a'.repeat(49)] }, { flags: [4] }, { flags: 'a' }, JSON.parse('{"__proto__":{"health":100}}'),
  ];
  it.each(invalidEffects)('recovers malformed effects %# without applying them', effects => expectRecovery({ ...annual, choices: [{ text: 'Choose safely', effects }] }));

  it.each([
    ['only a hole', Array(1)],
    ['a hole and a valid identifier', Object.assign(Array(2), { 1: 'seen' })],
  ])('recovers effect flags containing %s without retaining undefined flags', (_label, flags) => {
    const event = { ...annual, choices: [{ text: 'Choose safely', effects: { flags } }] };
    expectRecovery(event);
    expect(validatePendingEvent(event, { age: 30, relationships: [] })).toEqual({ valid: false, reason: 'invalid_choice' });
  });

  it.each([false, 42, 'private-event', [], {}])('recovers a malformed supplied event %#', event => expectRecovery(event));

  it('keeps only canonical recovery copy and never accepts forged effects, metadata or custody', () => {
    expect(restore({ ...life, currentEvent: recovery })).toMatchObject({ currentEvent: recovery, issues: [] });
    expectRecovery({ ...recovery, choices: [{ text: 'Clear unavailable choice', effects: { bank: -10000 } }] });
    expectRecovery({ ...recovery, description: 'Forged copy', meta: { requestId: 'secret' }, exId: 'ex-1' });
  });
});

describe('custody preservation and optional metadata', () => {
  it('retains canonical custody semantics and identities including adult living children', () => {
    const save = freeze({ ...life, relationships, currentEvent: custody });
    const before = structuredClone(save);
    const result = restore(save);
    expect(result.currentEvent).toEqual(custody);
    expect(result.currentEvent).not.toBe(custody);
    expect(result.currentEvent.childIds).not.toBe(custody.childIds);
    expect(result.issues).toEqual([]);
    expect(save).toEqual(before);
    expect(save.relationships).toBe(relationships);
    expect(save.relationships[0]).toBe(relationships[0]);
  });

  it('wraps an unversioned custody event without reusing its constant ID', () => {
    const { version: _version, age: _age, source: _source, ...raw } = custody;
    expect(restore({ ...life, relationships, currentEvent: { ...raw, id: 'custody_battle' } })).toMatchObject({
      currentEvent: { ...custody, id: 'fresh-event', source: 'legacy' }, issues: [],
    });
  });

  const invalidCustody = [
    { exId: undefined }, { exId: 'missing' }, { childIds: [] }, { childIds: ['missing'] },
    { childIds: ['child-1', 'child-1'] }, { childIds: undefined }, { isCustodyBattle: undefined }, { source: 'annual' },
    { choices: custody.choices.slice(0, 2) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, effects: { bank: -9999 } } : choice) },
    { choices: custody.choices.map((choice, i) => i === 1 ? { ...choice, effects: { bank: -3001 } } : choice) },
    { choices: custody.choices.map((choice, i) => i === 2 ? { ...choice, effects: { happiness: -19 } } : choice) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, custodyOutcome: 'bad' } : choice) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, custodyOutcome: ['fight'] } : choice) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, custodyOutcome: 'negotiate' } : choice) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, effects: { bank: -10000, health: 1 } } : choice) },
    { choices: custody.choices.map((choice, i) => i === 0 ? { ...choice, effects: Object.assign(Object.create({ bank: -10000 }), { health: 1 }) } : choice) },
  ];
  it.each(invalidCustody)('recovers incomplete or forged custody payload %# without fees', patch => expectRecovery({ ...custody, ...patch }, relationships));

  it.each([
    relationships.slice(0, 2), [...relationships, relationships[1]], [...relationships, relationships[0]],
    relationships.map(r => r.id === 'child-1' ? { ...r, isAlive: false } : r),
    relationships.map(r => r.id === 'child-1' ? { ...r, type: 'Friend' } : r),
    relationships.map(r => r.id === 'ex-1' ? { ...r, status: 'married', type: 'Spouse' } : r),
  ])('requires unique complete living-child and ex relationship references %#', rels => expectRecovery(custody, rels));

  it('projects safe metadata and usage without keeping unknown/provider fields', () => {
    const meta = freeze({ requestId: 'r'.repeat(128), model: 'm'.repeat(100), latencyMs: 0,
      usage: { inputTokens: 12, outputTokens: 2, cachedInputTokens: 0, totalTokens: 14, providerSecret: 'private' } });
    const result = restore({ ...life, currentEvent: { ...annual, meta } });
    expect(result.currentEvent.meta).toEqual({ requestId: 'r'.repeat(128), model: 'm'.repeat(100), latencyMs: 0,
      usage: { inputTokens: 12, outputTokens: 2, cachedInputTokens: 0, totalTokens: 14 } });
    expect(result.currentEvent.meta).not.toBe(meta);
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it.each([
    null, 'private', {}, { requestId: 'r', model: 'm', latencyMs: -1 },
    { requestId: 'r', model: 'm', latencyMs: Infinity }, { requestId: 'r', model: 'm', latencyMs: '1' },
    { requestId: '', model: 'm', latencyMs: 0 }, { requestId: 'r', model: '', latencyMs: 0 },
    { requestId: 'r'.repeat(129), model: 'm', latencyMs: 0 }, { requestId: 'r', model: 'm'.repeat(101), latencyMs: 0 },
    { requestId: 'r', model: 'm', latencyMs: 0, prompt: 'private' },
  ])('omits malformed optional meta while retaining valid event semantics %#', meta => {
    const result = restore({ ...life, currentEvent: { ...annual, meta } });
    expect(result.currentEvent).toEqual(annual);
    expect(result.issues).toEqual([{ code: 'invalid_metadata', field: 'currentEvent' }]);
  });

  it('omits malformed optional usage while retaining valid metadata and semantics', () => {
    const meta = { requestId: 'r', model: 'm', latencyMs: 2, usage: { inputTokens: -1, outputTokens: Infinity, cachedInputTokens: '2', totalTokens: NaN } };
    expect(restore({ ...life, currentEvent: { ...annual, meta } })).toMatchObject({
      currentEvent: { ...annual, meta: { requestId: 'r', model: 'm', latencyMs: 2 } },
      issues: [{ code: 'invalid_metadata', field: 'currentEvent' }],
    });
  });
});
