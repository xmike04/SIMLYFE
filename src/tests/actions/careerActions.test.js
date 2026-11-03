import { describe, expect, it } from 'vitest';
import { quoteCareerChange, resolveCareerChange } from '../../engine/actions/careerActions';
import { buildLifeSave, INITIAL_CAREER_META } from '../../engine/lifeSave';
import { findActionRecord, projectActionFacts } from '../../engine/actions/actionResult';

const teacher = { id: 'teacher', title: 'Teacher', type: 'full_time', salary: 50000, healthEffect: -16, happinessEffect: -8, minAge: 22, requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 } };
const analyst = { ...teacher, id: 'analyst', title: 'Analyst', salary: 70000 };
const catalog = [teacher, analyst];
const life = fields => buildLifeSave({ character: { name: 'Private Player', gender: 'Female', country: 'US', city: null }, age: 30, bank: 12000, stats: { health: 80, happiness: 80, smarts: 70, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 }, education: { bachelor: true }, networking: 30, history: [{ age: 20, text: 'An existing memory' }], ...fields });
const command = (actionId = 'career-test-1', targetId = 'teacher', expectedBasis = null) => ({ actionId, targetId, expectedBasis });
const commit = (state, result) => ({ ...state, ...result.patch });
const freezeTree = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value); }
  return value;
};

describe('read-only career planning quote', () => {
  it('quotes catalog and city-adjusted annual salary, requirements, stress and zero immediate fee', () => {
    const state = freezeTree(life({ character: { city: 'nyc' }, career: { ...analyst, salary: 75000 } }));
    const quote = quoteCareerChange(state, 'teacher', freezeTree(structuredClone(catalog)));
    expect(quote).toMatchObject({ targetId: 'teacher', eligible: true, code: 'eligible', reason: '', preview: { title: 'Teacher', baseSalary: 50000, grossSalary: 65000, annualEffects: { health: -2, happiness: -1 }, immediateCost: 0, previousId: 'analyst', previousTitle: 'Analyst', previousSalary: 75000, requirements: { minAge: 22, degree: 'bachelor', networking: 20, stats: { smarts: 60 } }, losesIncome: false } });
    expect(typeof quote.basis).toBe('string');
    expect(JSON.parse(quote.basis)).toHaveLength(8);
    expect(state.career.salary).toBe(75000);
  });

  it('quotes quitting as the end of future job income without any benefit entitlement', () => {
    expect(quoteCareerChange(life({ career: teacher }), null, catalog)).toMatchObject({ eligible: true, preview: { title: null, baseSalary: 0, grossSalary: 0, annualEffects: { health: 0, happiness: 0 }, immediateCost: 0, previousTitle: 'Teacher', previousSalary: 50000, losesIncome: true } });
  });
});

describe('pure career action resolution', () => {
  it('commits exactly career/meta/history and one record without paying salary or mutating its inputs', () => {
    const state = freezeTree(life());
    const before = structuredClone(state);
    const result = resolveCareerChange(state, command(), freezeTree(structuredClone(catalog)));
    expect(result).toMatchObject({ status: 'committed', actionId: 'career-test-1', actionType: 'career.choose', targetId: 'teacher', code: 'career_selected' });
    expect(Object.keys(result.patch).sort()).toEqual(['career', 'careerMeta', 'history']);
    expect(result.patch.career).toEqual(teacher);
    expect(result.patch.career).not.toBe(teacher);
    expect(result.patch.careerMeta).toEqual(INITIAL_CAREER_META);
    expect(result.patch.history).toHaveLength(2);
    expect(result.patch.history[0]).toEqual(state.history[0]);
    expect(result.patch.history.at(-1)).toMatchObject({ age: 30, text: expect.stringContaining('Teacher'), action: { version: 1, id: 'career-test-1', type: 'career.choose', targetId: 'teacher', beforeCareerId: null, afterCareerId: 'teacher', beforeSalary: null, afterSalary: 50000, code: 'career_selected' } });
    expect(state).toEqual(before);
    expect(result.patch).not.toHaveProperty('bank');
    expect(result.patch).not.toHaveProperty('stats');
  });

  it('switches one role, recording earned salary and resetting tenure and PIP', () => {
    const state = life({ career: { ...analyst, salary: 77000 }, careerMeta: { yearsInRole: 3, isOnPIP: true, financialStressFlag: true, unemploymentYearsLeft: 2 } });
    const result = resolveCareerChange(state, command(), catalog);
    expect(result.patch.careerMeta).toEqual(INITIAL_CAREER_META);
    expect(result.record).toMatchObject({ beforeCareerId: 'analyst', afterCareerId: 'teacher', beforeSalary: 77000, afterSalary: 50000 });
    expect(result.patch.history[0]).toEqual(state.history[0]);
  });

  it('quits without grants or immediate effects, preserving financial stress', () => {
    const result = resolveCareerChange(life({ career: teacher, careerMeta: { yearsInRole: 4, isOnPIP: true, financialStressFlag: true, unemploymentYearsLeft: 2 } }), command('quit', null), catalog);
    expect(result).toMatchObject({ status: 'committed', actionType: 'career.choose', targetId: null, code: 'career_quit', patch: { career: null, careerMeta: { yearsInRole: 0, isOnPIP: false, financialStressFlag: true, unemploymentYearsLeft: 0 } }, record: { targetId: null, beforeCareerId: 'teacher', afterCareerId: null, beforeSalary: 50000, afterSalary: null } });
  });

  it('same role preserves earned pay, tenure and PIP even if eligibility or catalog changed', () => {
    const state = freezeTree(life({ career: { ...teacher, salary: 55000 }, careerMeta: { ...INITIAL_CAREER_META, yearsInRole: 3, isOnPIP: true }, education: {}, networking: 0 }));
    const result = resolveCareerChange(state, command(), []);
    expect(result).toMatchObject({ status: 'noop', code: 'already_employed_here', patch: {}, record: null, facts: null });
    expect(state.career.salary).toBe(55000);
    expect(state.careerMeta).toMatchObject({ yearsInRole: 3, isOnPIP: true });
  });

  it('unemployed quit is a no-op preserving existing benefits', () => {
    const state = life({ careerMeta: { ...INITIAL_CAREER_META, unemploymentYearsLeft: 2 } });
    expect(resolveCareerChange(state, command('quit', null), catalog)).toMatchObject({ status: 'noop', code: 'already_unemployed', patch: {}, record: null });
    expect(state.careerMeta.unemploymentYearsLeft).toBe(2);
  });

  it.each([
    [{ age: 21 }, 'age_required'],
    [{ education: {} }, 'degree_required'],
    [{ networking: 10 }, 'networking_required'],
    [{ stats: { smarts: 40 } }, 'stat_required'],
    [{ isDead: true }, 'dead'],
  ])('rejects current eligibility or life state without history effects', (fields, code) => {
    expect(resolveCareerChange(life(fields), command(), catalog)).toMatchObject({ status: 'rejected', code, patch: {}, record: null, facts: null });
  });

  it.each([
    [{ actionId: '', targetId: 'teacher' }, 'invalid_command'],
    [{ actionId: 'attempt', targetId: undefined }, 'invalid_command'],
    [{ actionId: 'attempt', targetId: 42 }, 'invalid_command'],
    [{ actionId: 'attempt', targetId: 'missing' }, 'unknown_career'],
    [{ actionId: 'attempt', targetId: 'teacher', expectedBasis: {} }, 'invalid_command'],
  ])('rejects invalid commands and unknown targets', (input, code) => {
    expect(resolveCareerChange(life(), input, catalog)).toMatchObject({ status: 'rejected', code, patch: {}, record: null });
  });

  it.each([
    { salary: NaN }, { salary: Infinity }, { salary: -1 }, { salary: '50000' },
    { title: '' }, { title: 42 }, { type: 'business' },
  ])('rejects malformed catalog data without repair', change => {
    const data = [{ ...teacher, ...change }];
    expect(resolveCareerChange(life(), command(), data)).toMatchObject({ status: 'rejected', code: 'invalid_career', patch: {}, record: null });
  });

  it('replays the same identity as noop after a later switch, stale quote and JSON reload', () => {
    const first = resolveCareerChange(life(), command(), catalog);
    const employed = commit(life(), first);
    const switched = commit(employed, resolveCareerChange(employed, command('second', 'analyst'), catalog));
    const restored = JSON.parse(JSON.stringify(buildLifeSave(switched)));
    expect(resolveCareerChange(restored, command('career-test-1', 'teacher', 'now stale'), [])).toMatchObject({ status: 'noop', code: 'duplicate_action', patch: {}, record: null });
    expect(resolveCareerChange(restored, command('career-test-1', null, 'now stale'), catalog)).toMatchObject({ status: 'rejected', code: 'action_id_conflict', patch: {}, record: null });
    expect(restored.career.id).toBe('analyst');
    expect(findActionRecord(restored.history, 'career-test-1')).toEqual(first.record);
  });

  it.each([
    state => ({ ...state, age: state.age + 1 }),
    state => ({ ...state, stats: { ...state.stats, smarts: 75 } }),
    state => ({ ...state, career: analyst }),
    state => ({ ...state, careerMeta: { ...state.careerMeta, yearsInRole: 1 } }),
    state => ({ ...state, education: { ...state.education, master: true } }),
    state => ({ ...state, networking: 35 }),
    state => ({ ...state, character: { ...state.character, city: 'nyc' } }),
  ])('requires a fresh confirmation when any ordered basis component changes', alter => {
    const state = life();
    const quote = quoteCareerChange(state, 'teacher', catalog);
    expect(resolveCareerChange(alter(state), command('decision', 'teacher', quote.basis), catalog)).toMatchObject({ status: 'rejected', code: 'stale_quote', patch: {}, record: null });
  });

  it('rejects a stale catalog estimate and accepts an explicitly refreshed eligible quote', () => {
    const state = life();
    const original = quoteCareerChange(state, 'teacher', catalog);
    const changedCatalog = [{ ...teacher, salary: 60000 }];
    expect(resolveCareerChange(state, command('decision', 'teacher', original.basis), changedCatalog).code).toBe('stale_quote');
    const refreshed = quoteCareerChange(state, 'teacher', changedCatalog);
    expect(resolveCareerChange(state, command('new-decision', 'teacher', refreshed.basis), changedCatalog)).toMatchObject({ status: 'committed', record: { afterSalary: 60000 } });
  });

  it('omitting a basis permits legacy callers while still rechecking current eligibility', () => {
    expect(resolveCareerChange(life(), { actionId: 'legacy', targetId: 'teacher' }, catalog).status).toBe('committed');
    expect(resolveCareerChange(life({ networking: 0 }), { actionId: 'legacy', targetId: 'teacher' }, catalog).code).toBe('networking_required');
  });

  it('ignores malformed nested metadata and projects no arbitrary save or account data', () => {
    const state = life({ history: [{ age: 29, text: 'Keep invalid metadata.', action: { version: 999, id: 'career-test-1' } }] });
    const result = resolveCareerChange(state, command(), catalog);
    expect(result.status).toBe('committed');
    expect(result.patch.history[0]).toEqual(state.history[0]);
    expect(projectActionFacts(result.record, { age: 30, beforeTitle: null, afterTitle: 'Teacher', effects: { bank: 999 }, account: { uid: 'private' }, save: state })).toEqual(result.facts);
    expect(JSON.stringify(result.facts)).not.toMatch(/Private Player|private|effects|account|save/);
  });
});
