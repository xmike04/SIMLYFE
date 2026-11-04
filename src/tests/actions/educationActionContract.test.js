import { describe, expect, it } from 'vitest';
import { findActionRecord, makeActionResult, projectActionFacts, validateActionRecord } from '../../engine/actions/actionResult';
import { buildLifeSave, INITIAL_EDUCATION, INITIAL_STATS } from '../../engine/lifeSave';
import { DEGREE_CONFIG } from '../../engine/mechanics/education';

const source = fields => buildLifeSave({
  character: { name: 'Private Player', gender: 'Female', country: 'US', city: null },
  age: 18, bank: 100000, stats: { ...INITIAL_STATS },
  education: { ...INITIAL_EDUCATION, highSchool: true },
  history: [{ age: 17, text: 'An existing memory' }, { age: 18, text: 'Kept malformed metadata', action: { id: 'education-test-1', type: 'education.enroll' } }],
  ...fields,
});
const enrollmentRecord = () => ({
  version: 1, id: 'education-test-1', type: 'education.enroll', targetId: 'bachelor',
  beforeBank: 100000, afterBank: 80000, firstYearTuition: 20000,
  annualTuition: 20000, totalYears: 4, yearsInProgram: 1, code: 'education_enrolled',
});
const enrollmentFacts = record => ({
  version: 1, actionId: record.id, actionType: 'education.enroll', age: 18,
  code: 'education_enrolled', degreeType: record.targetId, beforeBank: record.beforeBank,
  afterBank: record.afterBank, firstYearTuition: record.firstYearTuition,
  annualTuition: record.annualTuition, totalYears: record.totalYears, yearsInProgram: 1,
});
const committed = (state = source(), record = enrollmentRecord()) => ({
  actionId: record.id, actionType: record.type, targetId: record.targetId,
  status: 'committed', code: record.code,
  patch: {
    bank: record.afterBank,
    education: { ...state.education, currentDegree: { type: record.targetId, yearsInProgram: 1, totalYears: record.totalYears, annualCost: record.annualTuition } },
    history: [...state.history, { age: 18, text: "Education: You enrolled in a Bachelor's Degree program (Year 1/4).", action: record }],
  },
  record,
  facts: enrollmentFacts(record),
});
const careerRecord = () => ({ version: 1, id: 'education-test-1', type: 'career.choose', targetId: 'teacher', beforeCareerId: null, afterCareerId: 'teacher', beforeSalary: null, afterSalary: 50000, code: 'career_selected' });

// These tests catch widened dispatch, missing source eligibility, patch rewrites,
// cross-domain replay and unapproved narration facts at the real result boundary.
describe('strict education action contract', () => {
  it('accepts the exact bachelor commit only with its original eligible snapshot', () => {
    const state = source();
    const record = enrollmentRecord();
    const fields = committed(state, record);
    expect(validateActionRecord(record)).toBe(true);
    expect(findActionRecord(fields.patch.history, record.id)).toEqual(record);
    expect(makeActionResult(fields, { sourceState: state })).toEqual(fields);
    expect(() => makeActionResult(fields)).toThrow();
    expect(projectActionFacts(record, { age: 18, account: 'private', effects: { bank: 99 } }))
      .toEqual({ version: 1, actionId: record.id, actionType: 'education.enroll', age: 18,
        code: 'education_enrolled', degreeType: 'bachelor', beforeBank: 100000, afterBank: 80000,
        firstYearTuition: 20000, annualTuition: 20000, totalYears: 4, yearsInProgram: 1 });
  });

  it.each([
    ['associate', 10000, 2, { highSchool: true }],
    ['master', 30000, 2, { bachelor: true }],
    ['phd', 0, 4, { master: true }],
  ])('accepts the current %s terms and preserves completed flags', (targetId, annualTuition, totalYears, degrees) => {
    const state = source({ education: { ...INITIAL_EDUCATION, ...degrees, [targetId]: true } });
    const record = { ...enrollmentRecord(), targetId, annualTuition, firstYearTuition: annualTuition, totalYears, afterBank: 100000 - annualTuition };
    const fields = committed(state, record);
    expect(makeActionResult(fields, { sourceState: state })).toEqual(fields);
  });

  it.each([
    ['version', 2], ['id', ''], ['id', 'x'.repeat(129)], ['type', 'other.action'],
    ['targetId', 'highSchool'], ['targetId', 'unknown'], ['targetId', ['bachelor']],
    ['targetId', 'constructor'], ['beforeBank', NaN], ['beforeBank', Infinity],
    ['afterBank', NaN], ['afterBank', -Infinity], ['afterBank', 80001],
    ['firstYearTuition', -1], ['firstYearTuition', Infinity], ['firstYearTuition', 19999],
    ['annualTuition', -1], ['annualTuition', NaN], ['totalYears', 0], ['totalYears', 1.5],
    ['totalYears', Infinity], ['yearsInProgram', 0], ['yearsInProgram', 2],
    ['code', 'eligible'], ['effects', { bank: 99 }],
  ])('ignores invalid historical record field %s = %j without rewriting history', (key, value) => {
    const record = { ...enrollmentRecord(), [key]: value };
    const history = [{ age: 18, text: 'Legacy' }, { age: 18, text: 'Malformed action is retained', action: record }];
    const before = structuredClone(history);
    expect(validateActionRecord(record)).toBe(false);
    expect(findActionRecord(history, record.id)).toBeNull();
    expect(projectActionFacts(record, { age: 18 })).toBeNull();
    expect(history).toEqual(before);
  });

  it.each([undefined, -1, 1.5, NaN, Infinity, '18'])('rejects invalid projection age %j', age => {
    expect(projectActionFacts(enrollmentRecord(), { age })).toBeNull();
  });

  it.each([
    ['extra stats', fields => { fields.patch.stats = { smarts: 99 }; }],
    ['extra career', fields => { fields.patch.career = null; }],
    ['bank arithmetic', fields => { fields.patch.bank += 1; }],
    ['tuition', fields => { fields.patch.education.currentDegree.annualCost = 1; }],
    ['counter', fields => { fields.patch.education.currentDegree.yearsInProgram = 0; }],
    ['duration', fields => { fields.patch.education.currentDegree.totalYears = 5; }],
    ['target', fields => { fields.patch.education.currentDegree.type = 'master'; }],
    ['earned flags', fields => { fields.patch.education.phd = true; }],
    ['prior history text', fields => { fields.patch.history[0] = { age: 17, text: 'Rewritten memory' }; }],
    ['prior metadata', fields => { fields.patch.history[1] = { age: 18, text: 'Kept malformed metadata' }; }],
    ['prior history order', fields => { fields.patch.history.reverse(); }],
    ['missing prior history', fields => { fields.patch.history.splice(0, 1); }],
    ['extra history', fields => { fields.patch.history.splice(0, 0, { age: 18, text: 'Extra' }); }],
    ['duplicate final action', fields => { fields.patch.history.push(fields.patch.history.at(-1)); }],
    ['same ID in career domain', fields => { fields.patch.history.splice(0, 0, { age: 18, text: 'Career', action: careerRecord() }); }],
    ['missing facts', fields => { fields.facts = null; }],
    ['missing fact key', fields => { delete fields.facts.beforeBank; }],
    ['extra facts', fields => { fields.facts.account = 'private'; }],
    ['forged facts', fields => { fields.facts.afterBank = 90000; }],
    ['wrong fact age', fields => { fields.facts.age = 19; }],
    ['extra final entry field', fields => { fields.patch.history.at(-1).effects = {}; }],
    ['wrong final age', fields => { fields.patch.history.at(-1).age = 19; fields.facts.age = 19; }],
    ['missing history action', fields => { delete fields.patch.history.at(-1).action; }],
    ['blank history text', fields => { fields.patch.history.at(-1).text = ' '; }],
    ['envelope ID', fields => { fields.actionId = 'other'; }],
    ['envelope target', fields => { fields.targetId = 'master'; }],
    ['envelope code', fields => { fields.code = 'eligible'; }],
    ['unknown action type', fields => { fields.actionType = 'other.action'; }],
  ])('rejects an incoherent committed %s', (_name, alter) => {
    const state = source();
    const fields = committed(state);
    alter(fields);
    expect(() => makeActionResult(fields, { sourceState: state })).toThrow();
  });

  it.each([
    ['dead', state => ({ ...state, isDead: true })],
    ['characterless', state => ({ ...state, character: null })],
    ['invalid character', state => ({ ...state, character: [] })],
    ['fractional age', state => ({ ...state, age: 18.5 })],
    ['negative age', state => ({ ...state, age: -1 })],
    ['invalid death flag', state => ({ ...state, isDead: 'false' })],
    ['missing stats', state => ({ ...state, stats: {} })],
    ['nonfinite stats', state => ({ ...state, stats: { ...state.stats, smarts: NaN } })],
    ['nonfinite extra stat', state => ({ ...state, stats: { ...state.stats, extra: Infinity } })],
    ['invalid education shape', state => ({ ...state, education: { ...state.education, associate: 1 } })],
    ['already enrolled', state => ({ ...state, education: { ...state.education, currentDegree: { type: 'associate', yearsInProgram: 1, totalYears: 2, annualCost: 10000 } } })],
    ['missing exact prerequisite', state => ({ ...state, education: { ...state.education, highSchool: false, phd: true } })],
    ['underfunded', state => ({ ...state, bank: 19999 })],
  ])('rejects an internally consistent forged commit from a %s source', (_name, alter) => {
    const state = alter(source());
    const record = { ...enrollmentRecord(), beforeBank: state.bank, afterBank: state.bank - 20000 };
    const fields = committed(state, record);
    expect(validateActionRecord(record)).toBe(true);
    expect(() => makeActionResult(fields, { sourceState: state })).toThrow();
  });

  it('rejects a negative-bank zero-tuition PhD source even when all output terms agree', () => {
    const state = source({ bank: -1, education: { ...INITIAL_EDUCATION, master: true } });
    const record = { ...enrollmentRecord(), targetId: 'phd', beforeBank: -1, afterBank: -1, firstYearTuition: 0, annualTuition: 0 };
    expect(validateActionRecord(record)).toBe(true);
    expect(() => makeActionResult(committed(state, record), { sourceState: state })).toThrow();
  });

  it('checks the original history for a same-ID action in either recognized domain', () => {
    for (const record of [enrollmentRecord(), careerRecord()]) {
      const state = source({ history: [{ age: 17, text: 'Prior decision', action: record }] });
      expect(() => makeActionResult(committed(state), { sourceState: state })).toThrow();
    }
  });

  it('preserves legacy and malformed metadata without mutating even frozen inputs', () => {
    const state = source();
    const fields = committed(state);
    const before = structuredClone({ state, fields });
    const freeze = value => {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
      return value;
    };
    freeze(state);
    freeze(fields);
    expect(makeActionResult(fields, { sourceState: state })).toEqual(fields);
    expect({ state, fields }).toEqual(before);
  });

  it.each(['annualCost', 'years'])('keeps historical stored terms valid after current %s changes but rejects an old-terms new commit', key => {
    const record = enrollmentRecord();
    const fields = committed();
    const oldValue = DEGREE_CONFIG.bachelor[key];
    try {
      DEGREE_CONFIG.bachelor[key] = oldValue + 1;
      expect(validateActionRecord(record)).toBe(true);
      expect(findActionRecord(fields.patch.history, record.id)).toEqual(record);
      expect(projectActionFacts(record, { age: 18 })).toEqual(enrollmentFacts(record));
      expect(() => makeActionResult(fields, { sourceState: source() })).toThrow();
    } finally {
      DEGREE_CONFIG.bachelor[key] = oldValue;
    }
  });

  it.each(['rejected', 'noop'])('accepts %s education results only without patch, record or facts', status => {
    const fields = { actionId: 'attempt', actionType: 'education.enroll', targetId: 'bachelor', status, code: 'already_enrolled' };
    expect(makeActionResult(fields)).toEqual({ ...fields, patch: {}, record: null, facts: null });
    for (const extra of [{ patch: { bank: 80000 } }, { record: enrollmentRecord() }, { facts: enrollmentFacts(enrollmentRecord()) }]) {
      expect(() => makeActionResult({ ...fields, ...extra })).toThrow();
    }
  });
});
