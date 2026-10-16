import { checkCareerEligibility, normalizeCareerEffect } from '../mechanics/careers';
import { INITIAL_CAREER_META } from '../lifeSave';
import { getCityById } from '../../config/cityData';
import { findActionRecord, makeActionResult, projectActionFacts } from './actionResult';

const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const validCareer = job => validId(job?.id) && typeof job.title === 'string' && job.title.trim()
  && Number.isFinite(job.salary) && job.salary >= 0 && ['full_time', 'part_time'].includes(job.type);

/** Read-only decision quote. The basis detects changed terms, not malicious clients. */
export function quoteCareerChange(state, targetId, careersData) {
  const selected = (Array.isArray(careersData) ? careersData : []).find(job => job.id === targetId);
  const basis = JSON.stringify([state.age, state.career ?? null, state.careerMeta ?? null, state.education ?? null,
    state.stats ?? null, state.networking ?? null, state.character?.city ?? null, selected ?? null]);
  let check;
  if (targetId !== null && !validId(targetId)) check = { eligible: false, code: 'invalid_command', reason: 'Choose a valid career.' };
  else if (state.isDead) check = { eligible: false, code: 'dead', reason: 'This life has ended.' };
  else if (targetId === null) check = { eligible: !!state.career, code: state.career ? 'eligible' : 'already_unemployed', reason: state.career ? '' : 'You are already unemployed.' };
  else if (!selected) check = { eligible: false, code: 'unknown_career', reason: 'This career is no longer available.' };
  else if (!validCareer(selected)) check = { eligible: false, code: 'invalid_career', reason: 'This career has invalid terms.' };
  else if (state.career?.id === targetId) check = { eligible: false, code: 'already_employed_here', reason: 'This is your current role.' };
  else check = checkCareerEligibility(selected, state.education, state.stats, state.networking, state.age);
  return { targetId, ...check, basis, preview: {
    title: selected?.title ?? null, salary: selected?.salary ?? 0,
    grossSalary: Math.round((selected?.salary ?? 0) * (getCityById(state.character?.city)?.salaryMultiplier ?? 1)),
    healthDelta: normalizeCareerEffect(selected?.healthEffect), happinessDelta: normalizeCareerEffect(selected?.happinessEffect),
    immediateCost: 0, previousTitle: state.career?.title ?? null,
    requirements: selected ? { minAge: selected.minAge ?? 0, degree: selected.requiresDegree ?? null, networking: selected.requiresNetworking ?? 0, stats: { ...selected.statRequirements } } : null,
  } };
}

/** Resolve against current canonical state. No selection-time wage or AI effects. */
export function resolveCareerChange(state, command, careersData) {
  const { actionId, targetId, expectedBasis = null } = command ?? {};
  const result = (status, code, fields = {}) => makeActionResult({ actionId: validId(actionId) ? actionId : 'invalid-command', targetId: targetId === null || validId(targetId) ? targetId : null, status, code, ...fields });
  if (!validId(actionId) || (targetId !== null && !validId(targetId)) || (expectedBasis !== null && typeof expectedBasis !== 'string')) return result('rejected', 'invalid_command');
  const existing = findActionRecord(state.history, actionId);
  if (existing) return existing.targetId === targetId ? result('noop', 'duplicate_action') : result('rejected', 'action_id_conflict');
  const quote = quoteCareerChange(state, targetId, careersData);
  if (state.isDead) return result('rejected', 'dead');
  if (expectedBasis !== null && expectedBasis !== quote.basis) return result('rejected', 'stale_quote');
  if (['already_employed_here', 'already_unemployed'].includes(quote.code)) return result('noop', quote.code);
  if (!quote.eligible) return result('rejected', quote.code);
  const career = targetId === null ? null : { ...careersData.find(job => job.id === targetId) };
  const code = career ? 'career_selected' : 'career_quit';
  const record = { version: 1, id: actionId, type: 'career.choose', targetId,
    beforeCareerId: state.career?.id ?? null, afterCareerId: career?.id ?? null,
    beforeSalary: state.career?.salary ?? null, afterSalary: career?.salary ?? null, code };
  const text = career ? `Career: You got a job as a ${career.title} ($${career.salary.toLocaleString()}/yr).` : 'You quit your current occupation.';
  const careerMeta = { ...INITIAL_CAREER_META, financialStressFlag: career ? false : (state.careerMeta?.financialStressFlag ?? false) };
  const patch = { career, careerMeta, history: [...state.history, { age: state.age, text, action: record }] };
  const facts = projectActionFacts(record, { age: state.age, beforeTitle: state.career?.title, afterTitle: career?.title });
  return result('committed', code, { patch, record, facts });
}
