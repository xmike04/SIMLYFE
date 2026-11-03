import { describe, expect, it } from 'vitest';
import { makeActionResult, findActionRecord, projectActionFacts, validateActionRecord } from '../../engine/actions/actionResult';
import { INITIAL_CAREER_META } from '../../engine/lifeSave';

const record = () => ({ version: 1, id: 'career-test-1', type: 'career.choose', targetId: 'teacher', beforeCareerId: null, afterCareerId: 'teacher', beforeSalary: null, afterSalary: 50000, code: 'career_selected' });
const fields = () => {
  const action = record();
  return {
    actionId: action.id, actionType: action.type, targetId: action.targetId, status: 'committed', code: action.code,
    patch: { career: { id: 'teacher', title: 'Teacher', salary: 50000, type: 'full_time' }, careerMeta: { ...INITIAL_CAREER_META }, history: [{ age: 20, text: 'An existing memory' }, { age: 30, text: 'Career: Selected Teacher.', action }] },
    record: action,
    facts: { version: 1, actionId: action.id, actionType: action.type, age: 30, code: action.code, beforeCareerId: null, afterCareerId: 'teacher', beforeTitle: null, afterTitle: 'Teacher', beforeSalary: null, afterSalary: 50000 },
  };
};

describe('shared action results and strict durable action records', () => {
  it('returns the exact committed contract while preserving factual nulls and prior history', () => {
    const input = fields();
    const result = makeActionResult(input);
    expect(Object.keys(result)).toEqual(['actionId', 'actionType', 'targetId', 'status', 'code', 'patch', 'record', 'facts']);
    expect(result).toEqual(input);
    expect(result.patch.history[0]).toEqual({ age: 20, text: 'An existing memory' });
    expect(result.record.beforeSalary).toBeNull();
    expect(findActionRecord(result.patch.history, result.actionId)).toEqual(record());
  });

  it.each(['rejected', 'noop'])('returns %s without a state patch, record or facts', status => {
    expect(makeActionResult({ actionId: 'attempt', actionType: 'career.choose', targetId: null, status, code: 'already_unemployed' })).toEqual({ actionId: 'attempt', actionType: 'career.choose', targetId: null, status, code: 'already_unemployed', patch: {}, record: null, facts: null });
    for (const forbidden of [{ patch: { career: null } }, { record: record() }, { facts: {} }]) {
      expect(() => makeActionResult({ actionId: 'attempt', actionType: 'career.choose', targetId: null, status, code: 'already_unemployed', ...forbidden })).toThrow();
    }
  });

  it.each([
    value => ({ ...value, version: 2 }),
    value => ({ ...value, id: '' }),
    value => ({ ...value, id: 'x'.repeat(129) }),
    value => ({ ...value, type: 'other.action' }),
    value => ({ ...value, afterCareerId: 42 }),
    value => ({ ...value, targetId: 'different' }),
    value => ({ ...value, beforeSalary: 0 }),
    value => ({ ...value, afterSalary: Infinity }),
    value => ({ ...value, afterSalary: NaN }),
    value => ({ ...value, afterSalary: -1 }),
    value => ({ ...value, extraEffect: { bank: 1000000 } }),
  ])('ignores malformed metadata without changing legacy or invalid entries', alter => {
    const invalid = alter(record());
    const history = [{ age: 20, text: 'An existing memory' }, { age: 30, text: 'Kept', action: invalid }];
    const before = structuredClone(history);
    expect(validateActionRecord(invalid)).toBe(false);
    expect(findActionRecord(history, 'career-test-1')).toBeNull();
    expect(projectActionFacts(invalid, { age: 30, beforeTitle: null, afterTitle: 'Teacher' })).toBeNull();
    expect(history).toEqual(before);
  });

  it('accepts quitting with explicit missing target/salary nulls', () => {
    const quit = { ...record(), targetId: null, beforeCareerId: 'teacher', afterCareerId: null, beforeSalary: 55000, afterSalary: null, code: 'career_quit' };
    expect(validateActionRecord(quit)).toBe(true);
    expect(projectActionFacts(quit, { age: 32, beforeTitle: 'Teacher', afterTitle: null })).toMatchObject({ beforeSalary: 55000, afterSalary: null, afterTitle: null });
  });

  it('projects only allowlisted record/context facts and bounds titles', () => {
    const projected = projectActionFacts(record(), { age: 30, beforeTitle: null, afterTitle: 'T'.repeat(200), bank: 9000, credentials: 'private', relationships: [], effects: { health: 99 } });
    expect(projected).toEqual({ ...fields().facts, afterTitle: 'T'.repeat(120) });
    expect(Object.keys(projected)).toEqual(['version', 'actionId', 'actionType', 'age', 'code', 'beforeCareerId', 'afterCareerId', 'beforeTitle', 'afterTitle', 'beforeSalary', 'afterSalary']);
    expect(JSON.stringify(projected)).not.toMatch(/bank|credentials|relationships|effects|private/);
  });

  it.each([
    input => ({ ...input, actionId: 'another-command' }),
    input => ({ ...input, targetId: 'another-role' }),
    input => ({ ...input, code: 'career_quit' }),
    input => ({ ...input, patch: { ...input.patch, bank: 999 } }),
    input => ({ ...input, patch: { ...input.patch, career: null } }),
    input => ({ ...input, patch: { ...input.patch, career: { ...input.patch.career, salary: 999 } } }),
    input => ({ ...input, patch: { ...input.patch, careerMeta: { ...INITIAL_CAREER_META, yearsInRole: 3 } } }),
    input => ({ ...input, patch: { ...input.patch, history: input.patch.history.slice(0, 1) } }),
    input => ({ ...input, patch: { ...input.patch, history: [...input.patch.history, input.patch.history.at(-1)] } }),
    input => ({ ...input, facts: { ...input.facts, afterSalary: 999 } }),
    input => ({ ...input, facts: { ...input.facts, afterTitle: 'Not Teacher' } }),
    input => ({ ...input, facts: { ...input.facts, effects: { bank: 999 } } }),
    input => ({ ...input, facts: null }),
    input => ({ ...input, status: 'maybe' }),
  ])('rejects incoherent result, patch, history or approved facts', alter => {
    expect(() => makeActionResult(alter(fields()))).toThrow();
  });
});
