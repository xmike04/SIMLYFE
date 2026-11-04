/** Stored education facts are historical; a new commit must match today's mechanics. */
import { INITIAL_EDUCATION, INITIAL_STATS } from '../lifeSave';
import { DEGREE_CONFIG, enrollDegree, summarizeDegreeProgress } from '../mechanics/education';

const SELECTABLE_DEGREES = ['associate', 'bachelor', 'master', 'phd'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const RECORD_KEYS = ['version', 'id', 'type', 'targetId', 'beforeBank', 'afterBank', 'firstYearTuition', 'annualTuition', 'totalYears', 'yearsInProgram', 'code'];

// Compare saved values without depending on key insertion order or dropping malformed metadata.
function equalValues(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
    || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && equalValues(left[key], right[key]));
}

export function validateEducationActionRecord(record) {
  return exactKeys(record, RECORD_KEYS) && record.version === 1 && boundedId(record.id)
    && record.type === 'education.enroll' && SELECTABLE_DEGREES.includes(record.targetId)
    && Number.isFinite(record.beforeBank) && Number.isFinite(record.afterBank)
    && Number.isFinite(record.firstYearTuition) && record.firstYearTuition >= 0
    && Number.isFinite(record.annualTuition) && record.annualTuition >= 0
    && record.firstYearTuition === record.annualTuition
    && record.afterBank === record.beforeBank - record.firstYearTuition
    && Number.isInteger(record.totalYears) && record.totalYears > 0
    && record.yearsInProgram === 1 && record.code === 'education_enrolled';
}

/** Only enrollment facts and the event age are approved for future narration. */
export function projectEducationActionFacts(record, { age } = {}) {
  if (!validateEducationActionRecord(record) || !Number.isInteger(age) || age < 0) return null;
  return {
    version: record.version,
    actionId: record.id,
    actionType: record.type,
    age,
    code: record.code,
    degreeType: record.targetId,
    beforeBank: record.beforeBank,
    afterBank: record.afterBank,
    firstYearTuition: record.firstYearTuition,
    annualTuition: record.annualTuition,
    totalYears: record.totalYears,
    yearsInProgram: record.yearsInProgram,
  };
}

function validSource(state) {
  return isRecord(state) && isRecord(state.character) && state.isDead === false
    && Number.isInteger(state.age) && state.age >= 0 && Number.isFinite(state.bank)
    && isRecord(state.stats) && Object.keys(INITIAL_STATS).every(key => Number.isFinite(state.stats[key]))
    && Object.values(state.stats).every(Number.isFinite)
    && isRecord(state.education)
    && Object.keys(INITIAL_EDUCATION).every(key => key === 'currentDegree'
      ? state.education.currentDegree === null || summarizeDegreeProgress(state.education.currentDegree) !== null
      : typeof state.education[key] === 'boolean')
    && Array.isArray(state.history);
}

/** Recompute enrollment against the original source, never a resolver or patched snapshot. */
export function coherentEducationCommittedResult(result, sourceState) {
  const { record, patch, facts } = result;
  if (!validateEducationActionRecord(record) || !validSource(sourceState)
    || result.actionId !== record.id || result.actionType !== record.type
    || result.targetId !== record.targetId || result.code !== record.code
    || !exactKeys(patch, ['bank', 'education', 'history'])) return false;

  const config = DEGREE_CONFIG[record.targetId];
  const enrollment = enrollDegree(record.targetId, sourceState.education, sourceState.bank);
  if (enrollment.error || record.beforeBank !== sourceState.bank || record.afterBank !== enrollment.newBank
    || record.firstYearTuition !== config.annualCost || record.annualTuition !== config.annualCost
    || record.totalYears !== config.years || patch.bank !== enrollment.newBank
    || !equalValues(patch.education, enrollment.newEducation)) return false;

  if (!Array.isArray(patch.history) || patch.history.length !== sourceState.history.length + 1
    || !equalValues(patch.history.slice(0, -1), sourceState.history)) return false;
  const entry = patch.history.at(-1);
  if (!exactKeys(entry, ['age', 'text', 'action']) || entry.age !== sourceState.age
    || typeof entry.text !== 'string' || !entry.text.trim() || !equalValues(entry.action, record)) return false;
  const approvedFacts = projectEducationActionFacts(record, { age: sourceState.age });
  return approvedFacts !== null && equalValues(facts, approvedFacts);
}
