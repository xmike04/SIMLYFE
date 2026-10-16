import { describe, it, expect } from 'vitest';
import { makeActionResult, findActionRecord, projectActionFacts } from '../../engine/actions/actionResult';
import { validateHydratedSave } from '../../engine/stateValidation';
import { buildLifeSave } from '../../engine/lifeSave';

export const record = { version: 1, id: 'choose-1', type: 'career.choose', targetId: 'teacher', beforeCareerId: null, afterCareerId: 'teacher', beforeSalary: null, afterSalary: 50000, code: 'career_selected' };

describe('action consequence boundary', () => {
  it('reads a committed record after serialization while ignoring legacy history', () => {
    const history = JSON.parse(JSON.stringify([{ age: 20, text: 'Old memory' }, { age: 30, text: 'New role', action: record }]));
    expect(findActionRecord(history, 'choose-1')).toEqual(record);
    expect(findActionRecord(history, 'unknown')).toBeNull();
  });
  it.each([{ version: 2 }, { type: 'anything' }, { id: '' }, { afterSalary: Infinity }, { beforeCareerId: 7 }, { secret: 'hidden' }, { targetId: 'different' }])('ignores malformed records %j and emits value-free warnings', change => {
    const entry = { age: 30, text: 'Keep this memory', action: { ...record, ...change } };
    expect(findActionRecord([entry], 'choose-1')).toBeNull();
    const result = validateHydratedSave(buildLifeSave({ history: [entry] }));
    expect(result.warningFields).toContain('history[].action');
    expect(JSON.stringify(result)).not.toContain('hidden');
    expect(entry.text).toBe('Keep this memory');
  });
  it('preserves legacy history without metadata warnings', () => {
    const result = validateHydratedSave(buildLifeSave({ history: [{ age: 20, text: 'Old memory' }] }));
    expect(result.warningFields).not.toContain('history[].action');
  });
  it('projects only bounded outcome facts, never arbitrary state or effects', () => {
    const facts = projectActionFacts(record, { age: 30, beforeTitle: null, afterTitle: 'T'.repeat(150), bank: 999, credentials: 'secret', effects: { bank: 1 } });
    expect(facts).toEqual({ version: 1, actionId: 'choose-1', actionType: 'career.choose', age: 30, code: 'career_selected', beforeCareerId: null, afterCareerId: 'teacher', beforeTitle: null, afterTitle: 'T'.repeat(120), beforeSalary: null, afterSalary: 50000 });
    expect(projectActionFacts({ ...record, id: 'x'.repeat(129) }, { age: 30 })).toBeNull();
  });
  it('refuses a committed envelope without a coherent patch and record', () => {
    expect(() => makeActionResult({ actionId: 'choose-1', targetId: 'teacher', status: 'committed', code: 'career_selected' })).toThrow();
    expect(() => makeActionResult({ actionId: 'choose-1', targetId: 'teacher', status: 'rejected', code: 'unknown_career', patch: { bank: 5 } })).toThrow();
    expect(makeActionResult({ actionId: 'choose-1', targetId: null, status: 'noop', code: 'already_unemployed' })).toMatchObject({ patch: {}, record: null, facts: null });
  });
});

describe('committed envelope coherence', () => {
  const valid = () => ({ actionId: record.id, targetId: record.targetId, status: 'committed', code: record.code, record,
    patch: { career: { id: 'teacher', title: 'Teacher', salary: 50000 }, careerMeta: { yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 }, history: [{ age: 30, text: 'Selected Teacher', action: record }] },
    facts: projectActionFacts(record, { age: 30, beforeTitle: null, afterTitle: 'Teacher' }) });
  it('accepts the actual coherent committed state and its bounded facts', () => {
    expect(makeActionResult(valid()).status).toBe('committed');
  });
  it.each(['salary', 'metadata', 'extraFact', 'wrongFact', 'historyAge'])('rejects inconsistent %s instead of allowing mismatched canonical and narrative facts', kind => {
    const envelope = valid();
    if (kind === 'salary') envelope.patch.career.salary = -999;
    if (kind === 'metadata') envelope.patch.careerMeta = null;
    if (kind === 'extraFact') envelope.facts.credential = 'must-not-pass';
    if (kind === 'wrongFact') envelope.facts.afterSalary = 7;
    if (kind === 'historyAge') envelope.patch.history[0].age = 31;
    expect(() => makeActionResult(envelope)).toThrow();
  });
});
