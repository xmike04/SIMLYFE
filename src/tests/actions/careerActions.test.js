import { describe, it, expect } from 'vitest';
import { quoteCareerChange, resolveCareerChange } from '../../engine/actions/careerActions';
import { buildLifeSave, INITIAL_STATS } from '../../engine/lifeSave';
import { advanceLifeYear } from '../../engine/annual/advanceLifeYear';
import { computeCareerYearIncome } from '../../engine/mechanics/careers';

const teacher = { id: 'teacher', title: 'Teacher', type: 'full_time', salary: 50000, minAge: 22, requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 }, healthEffect: -16, happinessEffect: -8 };
const life = extra => buildLifeSave({ character: { name: 'Player', gender: 'Female', country: 'US', city: null }, age: 30, bank: 12000, stats: { ...INITIAL_STATS, smarts: 70 }, education: { highSchool: true, bachelor: true }, networking: 30, history: [{ age: 20, text: 'Legacy memory' }], ...extra });
const command = extra => ({ actionId: 'career-1', targetId: 'teacher', ...extra });

describe('career decisions', () => {
  it('quotes real costs and effects without mutation, then commits one durable consequence', () => {
    const input = life();
    const before = JSON.stringify(input);
    const quote = quoteCareerChange(input, 'teacher', [teacher]);
    expect(quote.preview).toMatchObject({ salary: 50000, grossSalary: 50000, immediateCost: 0, healthDelta: -2, happinessDelta: -1 });
    const result = resolveCareerChange(input, command({ expectedBasis: quote.basis }), [teacher]);
    expect(result.status).toBe('committed');
    expect(result.patch.career.salary).toBe(50000);
    expect(result.patch.careerMeta).toEqual({ yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 });
    expect(result.patch.history).toHaveLength(2);
    expect(result.record).toMatchObject({ beforeCareerId: null, afterCareerId: 'teacher', afterSalary: 50000 });
    expect(result.patch).not.toHaveProperty('bank');
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([
    [{ age: 20 }, 'age_required'], [{ education: {} }, 'degree_required'], [{ networking: 0 }, 'networking_required'],
    [{ stats: { ...INITIAL_STATS, smarts: 40 } }, 'stat_required'], [{ isDead: true }, 'dead'],
  ])('rejects prerequisites without state/history changes: %j', (fields, code) => {
    expect(resolveCareerChange(life(fields), command(), [teacher])).toMatchObject({ status: 'rejected', code, patch: {}, record: null });
  });
  it('rejects invalid commands, missing jobs and invalid catalog values', () => {
    expect(resolveCareerChange(life(), command({ targetId: 2 }), [teacher]).code).toBe('invalid_command');
    expect(resolveCareerChange(life(), command({ targetId: 'missing' }), [teacher]).code).toBe('unknown_career');
    for (const salary of [NaN, Infinity, -1]) expect(resolveCareerChange(life(), command(), [{ ...teacher, salary }]).code).toBe('invalid_career');
  });
  it('preserves tenure, PIP and raises when selecting the active role', () => {
    const input = life({ career: { ...teacher, salary: 55000 }, careerMeta: { yearsInRole: 3, isOnPIP: true } });
    expect(resolveCareerChange(input, command(), [teacher])).toMatchObject({ status: 'noop', code: 'already_employed_here', patch: {} });
    expect(input.career.salary).toBe(55000);
  });
  it('quits once, preserving financial stress without awarding new benefits', () => {
    const input = life({ career: teacher, careerMeta: { yearsInRole: 3, isOnPIP: true, financialStressFlag: true, unemploymentYearsLeft: 0 } });
    const result = resolveCareerChange(input, command({ targetId: null }), [teacher]);
    expect(result.patch.career).toBeNull();
    expect(result.patch.careerMeta).toEqual({ yearsInRole: 0, isOnPIP: false, financialStressFlag: true, unemploymentYearsLeft: 0 });
    expect(result.record.beforeSalary).toBe(50000);
    expect(resolveCareerChange(life(), command({ targetId: null }), []).code).toBe('already_unemployed');
  });
  it('deduplicates a saved action before stale preview checks and rejects ID reuse', () => {
    const input = life();
    const quote = quoteCareerChange(input, 'teacher', [teacher]);
    const first = resolveCareerChange(input, command(), [teacher]);
    const restored = JSON.parse(JSON.stringify({ ...input, ...first.patch }));
    expect(resolveCareerChange(restored, command({ expectedBasis: quote.basis }), [teacher]).code).toBe('duplicate_action');
    expect(resolveCareerChange(restored, command({ targetId: null }), [teacher]).code).toBe('action_id_conflict');
  });
  it.each([{ age: 31 }, { networking: 31 }, { stats: { ...INITIAL_STATS, smarts: 71 } }, { careerMeta: { yearsInRole: 2 } }, { character: { city: 'nyc' } }, { education: { phd: true } }])('rejects stale quotes after relevant state changes %j', fields => {
    const input = life();
    const quote = quoteCareerChange(input, 'teacher', [teacher]);
    expect(resolveCareerChange({ ...input, ...fields }, command({ expectedBasis: quote.basis }), [teacher]).code).toBe('stale_quote');
  });
  it('rejects stale catalog terms and preserves a switch from the actual raised salary', () => {
    const input = life({ career: { ...teacher, id: 'old', salary: 55000 } });
    const quote = quoteCareerChange(input, 'teacher', [teacher]);
    expect(resolveCareerChange(input, command({ expectedBasis: quote.basis }), [{ ...teacher, salary: 60000 }]).code).toBe('stale_quote');
    expect(resolveCareerChange(input, command(), [teacher]).record.beforeSalary).toBe(55000);
  });
});
