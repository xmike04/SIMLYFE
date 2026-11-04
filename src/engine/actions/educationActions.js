import { findActionRecord, makeActionResult, projectActionFacts } from './actionResult';
import { INITIAL_EDUCATION, INITIAL_STATS } from '../lifeSave';
import { DEGREE_CONFIG, DEGREE_LABELS, DEGREE_SMARTS_BONUS, enrollDegree, summarizeDegreeProgress } from '../mechanics/education';

const SELECTABLE_DEGREES = ['associate', 'bachelor', 'master', 'phd'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validTarget = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;

function validLife(state) {
  return isRecord(state) && isRecord(state.character)
    && Number.isInteger(state.age) && state.age >= 0 && typeof state.isDead === 'boolean'
    && Number.isFinite(state.bank) && isRecord(state.stats)
    && Object.keys(INITIAL_STATS).every(key => Number.isFinite(state.stats[key]))
    && Object.values(state.stats).every(Number.isFinite)
    && isRecord(state.education)
    && Object.keys(INITIAL_EDUCATION).every(key => key === 'currentDegree'
      ? state.education.currentDegree === null || summarizeDegreeProgress(state.education.currentDegree) !== null
      : typeof state.education[key] === 'boolean');
}

// Object insertion order does not change the terms a player reviewed.
function canonical(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function quoteBasis(state, targetId, config) {
  return JSON.stringify([
    targetId, config, config ? DEGREE_LABELS[targetId] : null, config ? DEGREE_SMARTS_BONUS[targetId] : null,
    state?.character ?? null, state?.age ?? null, state?.isDead ?? null,
    state?.education ?? null, state?.bank ?? null, state?.stats ?? null,
  ].map(canonical));
}

/** Read-only tuition and timing quote; enrollment and annual calculations remain mechanics-owned. */
export function quoteEducationEnrollment(state, degreeType) {
  const targetId = validTarget(degreeType) ? degreeType : null;
  const config = SELECTABLE_DEGREES.includes(targetId) ? DEGREE_CONFIG[targetId] : null;
  const stateIsValid = validLife(state);
  const bank = Number.isFinite(state?.bank) ? state.bank : null;
  const age = Number.isInteger(state?.age) && state.age >= 0 ? state.age : null;
  const quote = {
    targetId,
    eligible: true,
    code: 'eligible',
    reason: '',
    basis: quoteBasis(stateIsValid ? state : null, targetId, config),
    preview: config ? {
      degreeType: targetId,
      label: DEGREE_LABELS[targetId],
      prerequisiteDegree: config.requires,
      prerequisiteMet: state?.education?.[config.requires] === true,
      programYears: config.years,
      annualTuition: config.annualCost,
      firstYearTuition: config.annualCost,
      remainingTuition: (config.years - 1) * config.annualCost,
      totalTuition: config.years * config.annualCost,
      bankBefore: bank,
      bankAfterEnrollment: bank === null ? null : bank - config.annualCost,
      ageUpsToCompletion: config.years - 1,
      completionAge: age === null ? null : age + config.years - 1,
      annualHappinessEffect: config.happinessEffect,
      completionSmartsBonus: DEGREE_SMARTS_BONUS[targetId],
      completionHappinessBonus: 3,
    } : null,
  };
  const reject = (code, reason) => ({ ...quote, eligible: false, code, reason });
  if (!targetId) return reject('invalid_command', 'Choose a valid education program.');
  if (state?.isDead === true) return reject('dead', 'This life has ended.');
  if (!stateIsValid) return reject('invalid_state', 'Start a valid life before enrolling in education.');
  if (!config) return reject('unknown_degree', 'Unknown degree type');

  const enrollment = enrollDegree(targetId, state.education, state.bank);
  if (!enrollment.error) return quote;
  const code = state.education.currentDegree !== null ? 'already_enrolled'
    : !state.education[config.requires] ? 'prerequisite_required' : 'insufficient_funds';
  return reject(code, enrollment.error);
}


/** Pure enrollment resolution; history supplies one identity across both action domains. */
export function resolveEducationEnrollment(state, command) {
  const actionId = validTarget(command?.actionId) ? command.actionId : null;
  const targetId = validTarget(command?.targetId) ? command.targetId : null;
  const result = (status, code, details = {}) => makeActionResult({
    actionId, actionType: 'education.enroll', targetId, status, code, ...details,
  }, { sourceState: state });
  if (!actionId || !targetId || (command.expectedBasis != null && typeof command.expectedBasis !== 'string')) {
    return result('rejected', 'invalid_command');
  }
  if (state?.isDead === true) return result('rejected', 'dead');
  const previous = findActionRecord(state?.history, actionId);
  if (previous) return previous.type === 'education.enroll' && previous.targetId === targetId
    ? result('noop', 'duplicate_action') : result('rejected', 'action_id_conflict');
  if (!Array.isArray(state?.history)) return result('rejected', 'invalid_state');
  const quote = quoteEducationEnrollment(state, targetId);
  if (command.expectedBasis != null && command.expectedBasis !== quote.basis) return result('rejected', 'stale_quote');
  if (!quote.eligible) return result('rejected', quote.code);

  const { newEducation, newBank } = enrollDegree(targetId, state.education, state.bank);
  const config = DEGREE_CONFIG[targetId];
  const record = {
    version: 1, id: actionId, type: 'education.enroll', targetId,
    beforeBank: state.bank, afterBank: newBank,
    firstYearTuition: config.annualCost, annualTuition: config.annualCost,
    totalYears: config.years, yearsInProgram: 1, code: 'education_enrolled',
  };
  const text = `Education: You enrolled in a ${DEGREE_LABELS[targetId]} program (Year 1/${config.years}).`;
  const history = [...state.history, { age: state.age, text, action: record }];
  const facts = projectActionFacts(record, { age: state.age });
  return result('committed', 'education_enrolled', {
    patch: { bank: newBank, education: newEducation, history }, record, facts,
  });
}
