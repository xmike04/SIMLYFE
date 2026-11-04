import { describe, expect, it, vi } from 'vitest';
import { quoteEducationEnrollment } from '../../engine/actions/educationActions';
import { buildLifeSave, INITIAL_EDUCATION, INITIAL_STATS } from '../../engine/lifeSave';
import { DEGREE_CONFIG, DEGREE_LABELS, DEGREE_SMARTS_BONUS } from '../../engine/mechanics/education';

const life = fields => buildLifeSave({
  character: { name: 'Private Player', gender: 'Female', country: 'US', city: null },
  age: 18,
  bank: 100000,
  stats: { ...INITIAL_STATS },
  education: { ...INITIAL_EDUCATION, highSchool: true },
  ...fields,
});
const freezeTree = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
};
const reverseKeys = value => {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
  }
  return value;
};

describe('read-only education enrollment quote', () => {
  it('quotes the first payment, remaining commitment and completion without mutation or IO', () => {
    const state = freezeTree(life());
    const before = structuredClone(state);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const quote = quoteEducationEnrollment(state, 'bachelor');
      expect(quote).toEqual({
        targetId: 'bachelor', eligible: true, code: 'eligible', reason: '', basis: expect.any(String),
        preview: {
          degreeType: 'bachelor', label: "Bachelor's Degree", prerequisiteDegree: 'highSchool',
          prerequisiteMet: true, programYears: 4, annualTuition: 20000,
          firstYearTuition: 20000, remainingTuition: 60000, totalTuition: 80000,
          bankBefore: 100000, bankAfterEnrollment: 80000,
          ageUpsToCompletion: 3, completionAge: 21,
          annualHappinessEffect: 0, completionSmartsBonus: 10, completionHappinessBonus: 3,
        },
      });
      expect(quoteEducationEnrollment(state, 'bachelor')).toEqual(quote);
      expect(state).toEqual(before);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(storageSpy).not.toHaveBeenCalled();
      expect(() => JSON.parse(quote.basis)).not.toThrow();
    } finally {
      fetchSpy.mockRestore();
      storageSpy.mockRestore();
    }
  });

  it.each([
    ['associate', { highSchool: true }, "Associate's Degree", 'highSchool', 2, 10000, 10000, 20000, 90000, 1, 19, 0, 3],
    ['bachelor', { highSchool: true }, "Bachelor's Degree", 'highSchool', 4, 20000, 60000, 80000, 80000, 3, 21, 0, 10],
    ['master', { bachelor: true }, "Master's Degree", 'bachelor', 2, 30000, 30000, 60000, 70000, 1, 19, 0, 5],
    ['phd', { master: true }, 'PhD', 'master', 4, 0, 0, 0, 100000, 3, 21, -20, 3],
  ])('quotes the existing %s catalog terms', (target, degrees, label, prerequisiteDegree, programYears, annualTuition, remainingTuition, totalTuition, bankAfterEnrollment, ageUpsToCompletion, completionAge, annualHappinessEffect, completionSmartsBonus) => {
    const state = freezeTree(life({ education: { ...INITIAL_EDUCATION, ...degrees } }));
    expect(quoteEducationEnrollment(state, target)).toMatchObject({
      targetId: target, eligible: true, code: 'eligible', reason: '',
      preview: {
        degreeType: target, label, prerequisiteDegree, prerequisiteMet: true,
        programYears, annualTuition, firstYearTuition: annualTuition,
        remainingTuition, totalTuition, bankBefore: 100000, bankAfterEnrollment,
        ageUpsToCompletion, completionAge, annualHappinessEffect, completionSmartsBonus, completionHappinessBonus: 3,
      },
    });
  });

  it.each([
    ['master', { phd: true }, 'bachelor', 'Requires Bachelor\'s Degree first'],
    ['phd', { phd: true, bachelor: true }, 'master', 'Requires Master\'s Degree first'],
    ['bachelor', { master: true }, 'highSchool', 'Requires HS Diploma first'],
  ])('requires the exact prerequisite flag for %s even with higher degrees', (target, degrees, prerequisiteDegree, reason) => {
    expect(quoteEducationEnrollment(life({ education: { ...INITIAL_EDUCATION, ...degrees } }), target)).toMatchObject({
      eligible: false, code: 'prerequisite_required', reason,
      preview: { degreeType: target, prerequisiteDegree, prerequisiteMet: false },
    });
  });

  it('keeps bachelor independent of associate and preserves completed-degree enrollment compatibility', () => {
    expect(quoteEducationEnrollment(life(), 'bachelor').eligible).toBe(true);
    expect(quoteEducationEnrollment(life({ education: { ...INITIAL_EDUCATION, highSchool: true, bachelor: true } }), 'bachelor').eligible).toBe(true);
  });

  it.each([[0, true, 'eligible', ''], [-1, false, 'insufficient_funds', 'Insufficient funds for first year']])('applies the existing zero-cost PhD funds check at bank %s', (bank, eligible, code, reason) => {
    expect(quoteEducationEnrollment(life({ bank, education: { ...INITIAL_EDUCATION, master: true } }), 'phd')).toMatchObject({
      eligible, code, reason, preview: { firstYearTuition: 0, bankBefore: bank, bankAfterEnrollment: bank, annualHappinessEffect: -20 },
    });
  });

  it('rejects unaffordable first-year tuition but keeps useful nominal costs', () => {
    expect(quoteEducationEnrollment(life({ bank: 19999 }), 'bachelor')).toMatchObject({
      eligible: false, code: 'insufficient_funds', reason: 'Insufficient funds for first year',
      preview: { firstYearTuition: 20000, remainingTuition: 60000, totalTuition: 80000, bankAfterEnrollment: -1 },
    });
    expect(quoteEducationEnrollment(life({ bank: 20000 }), 'bachelor').eligible).toBe(true);
  });

  it('rejects an existing saved program before prerequisite and funds checks', () => {
    const state = freezeTree(life({ bank: -1, education: {
      ...INITIAL_EDUCATION,
      currentDegree: { type: 'bachelor', yearsInProgram: 0, totalYears: 4, annualCost: 12345 },
    } }));
    expect(quoteEducationEnrollment(state, 'master')).toMatchObject({
      eligible: false, code: 'already_enrolled', reason: 'Already enrolled in a program', preview: { degreeType: 'master' },
    });
  });

  it.each([undefined, null, 1, {}, [], '', ' ', 'x'.repeat(129)])('rejects malformed target %j without a preview', target => {
    expect(quoteEducationEnrollment(life(), target)).toMatchObject({ eligible: false, code: 'invalid_command', preview: null });
  });

  it.each(['unknown', 'highSchool', 'constructor', '__proto__', 'toString'])('allows only the four selectable degrees, not %s', target => {
    expect(quoteEducationEnrollment(life(), target)).toMatchObject({ targetId: target, eligible: false, code: 'unknown_degree', preview: null });
  });

  it('rejects a dead life and retains the known program preview', () => {
    expect(quoteEducationEnrollment(life({ isDead: true }), 'bachelor')).toMatchObject({
      eligible: false, code: 'dead', preview: { degreeType: 'bachelor', firstYearTuition: 20000 },
    });
  });

  it.each([
    null, {}, { character: null }, { character: 'not a character' }, { character: [] },
    { age: -1 }, { age: 18.5 }, { age: NaN }, { age: Infinity }, { age: '18' },
    { isDead: 'false' }, { bank: NaN }, { bank: Infinity }, { bank: -Infinity }, { bank: '100000' },
    { stats: null }, { stats: {} }, { stats: { ...INITIAL_STATS, smarts: NaN } },
    { stats: { ...INITIAL_STATS, happiness: Infinity } }, { stats: { ...INITIAL_STATS, grades: '70' } },
    { education: null }, { education: {} }, { education: { ...INITIAL_EDUCATION, highSchool: 1 } },
    { education: { ...INITIAL_EDUCATION, currentDegree: undefined } },
    { education: { ...INITIAL_EDUCATION, currentDegree: {} } },
    { education: { ...INITIAL_EDUCATION, currentDegree: { type: 'bachelor', yearsInProgram: 1, totalYears: 4, annualCost: NaN } } },
  ])('rejects malformed life state %j without changing it', fields => {
    const state = fields === null ? null : fields && Object.keys(fields).length === 0 ? {} : { ...life(), ...fields };
    const before = structuredClone(state);
    freezeTree(state);
    expect(quoteEducationEnrollment(state, 'bachelor')).toMatchObject({ eligible: false, code: 'invalid_state' });
    expect(state).toEqual(before);
  });

  it('does not introduce an age, grade, or future-affordability admission gate', () => {
    expect(quoteEducationEnrollment(life({ age: 0, bank: 20000, stats: { ...INITIAL_STATS, grades: 0 } }), 'bachelor')).toMatchObject({
      eligible: true, preview: { bankAfterEnrollment: 0, remainingTuition: 60000, completionAge: 3 },
    });
  });

  it('rejects non-JSON numeric life fields rather than throwing while building a basis', () => {
    expect(quoteEducationEnrollment(life({ bank: 100000n }), 'bachelor')).toMatchObject({ eligible: false, code: 'invalid_state' });
    expect(quoteEducationEnrollment(life({ stats: { ...INITIAL_STATS, smarts: 50n } }), 'bachelor')).toMatchObject({ eligible: false, code: 'invalid_state' });
  });

  it('canonicalizes reordered nested input keys in the quote basis', () => {
    const state = life({ education: { ...INITIAL_EDUCATION, currentDegree: { type: 'bachelor', yearsInProgram: 1, totalYears: 4, annualCost: 20000 } } });
    expect(quoteEducationEnrollment(reverseKeys(state), 'bachelor').basis).toBe(quoteEducationEnrollment(state, 'bachelor').basis);
  });

  it.each([
    ['bank', state => ({ ...state, bank: 99999 })],
    ['education', state => ({ ...state, education: { ...state.education, associate: true } })],
    ['age', state => ({ ...state, age: 19 })],
    ['stats', state => ({ ...state, stats: { ...state.stats, smarts: 51 } })],
    ['identity', state => ({ ...state, character: { ...state.character, name: 'Another Life' } })],
    ['death', state => ({ ...state, isDead: true })],
  ])('changes the quote basis when %s changes', (_field, alter) => {
    const state = life();
    expect(quoteEducationEnrollment(alter(state), 'bachelor').basis).not.toBe(quoteEducationEnrollment(state, 'bachelor').basis);
  });

  it('changes basis for the selected target but excludes history, career feedback and networking', () => {
    const state = life();
    const basis = quoteEducationEnrollment(state, 'bachelor').basis;
    expect(quoteEducationEnrollment(state, 'associate').basis).not.toBe(basis);
    expect(quoteEducationEnrollment({ ...state, history: [{ age: 18, text: 'A career decision', action: { id: 'career-1' } }], career: { id: 'teacher' }, careerMeta: { yearsInRole: 1 }, lastCareerAction: { saveStatus: 'saved' }, networking: 99 }, 'bachelor').basis).toBe(basis);
  });

  it('ignores catalog changes for a different degree', () => {
    const state = life();
    const basis = quoteEducationEnrollment(state, 'bachelor').basis;
    const original = DEGREE_CONFIG.master.annualCost;
    try {
      DEGREE_CONFIG.master.annualCost = 31000;
      expect(quoteEducationEnrollment(state, 'bachelor').basis).toBe(basis);
    } finally {
      DEGREE_CONFIG.master.annualCost = original;
    }
  });

  it.each([
    [DEGREE_CONFIG.bachelor, 'annualCost', 21000],
    [DEGREE_CONFIG.bachelor, 'years', 5],
    [DEGREE_CONFIG.bachelor, 'requires', 'associate'],
    [DEGREE_CONFIG.bachelor, 'happinessEffect', -1],
    [DEGREE_LABELS, 'bachelor', 'Updated bachelor label'],
    [DEGREE_SMARTS_BONUS, 'bachelor', 11],
  ])('changes basis when a selected catalog term changes: %j / %s', (catalog, key, value) => {
    const state = life();
    const basis = quoteEducationEnrollment(state, 'bachelor').basis;
    const original = catalog[key];
    try {
      catalog[key] = value;
      expect(quoteEducationEnrollment(state, 'bachelor').basis).not.toBe(basis);
    } finally {
      catalog[key] = original;
    }
  });
});
