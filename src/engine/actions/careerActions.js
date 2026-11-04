import { INITIAL_CAREER_META } from '../lifeSave';
import { checkCareerEligibility, normalizeCareerEffect } from '../mechanics/careers';
import { getCityById } from '../../config/cityData';
import { makeActionResult, findActionRecord, projectActionFacts } from './actionResult';

const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const validTarget = value => value === null || validId(value);
const validCareer = career => career && validId(career.id)
  && typeof career.title === 'string' && career.title.trim().length > 0
  && Number.isFinite(career.salary) && career.salary >= 0
  && ['full_time', 'part_time'].includes(career.type);
const selectedCareer = (careersData, targetId) => Array.isArray(careersData) ? careersData.find(career => career?.id === targetId) ?? null : null;

// Sort object keys as well as ordering tuple members: insertion order is not a change.
function canonical(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function quoteBasis(state, selected) {
  return JSON.stringify([
    state?.age ?? null, state?.career ?? null, state?.careerMeta ?? null,
    state?.education ?? null, state?.stats ?? null, state?.networking ?? null,
    state?.character?.city ?? null, selected,
  ].map(canonical));
}

/** Read-only planning quote, revalidated at confirmation against the current life. */
export function quoteCareerChange(state, targetId, careersData) {
  const current = state?.career ?? null;
  const selected = targetId === null ? null : selectedCareer(careersData, targetId);
  const multiplier = getCityById(state?.character?.city)?.salaryMultiplier ?? 1;
  const baseSalary = selected?.salary ?? 0;
  const quote = {
    targetId: validTarget(targetId) ? targetId : null,
    eligible: true,
    code: 'eligible',
    reason: '',
    basis: quoteBasis(state, selected),
    preview: {
      title: selected?.title ?? null,
      baseSalary,
      grossSalary: Math.round(baseSalary * multiplier),
      annualEffects: { health: normalizeCareerEffect(selected?.healthEffect), happiness: normalizeCareerEffect(selected?.happinessEffect) },
      immediateCost: 0,
      previousId: current?.id ?? null,
      previousTitle: current?.title ?? null,
      previousSalary: current?.salary ?? null,
      requirements: { minAge: selected?.minAge ?? 0, degree: selected?.requiresDegree ?? null, networking: selected?.requiresNetworking ?? 0, stats: { ...selected?.statRequirements } },
      losesIncome: targetId === null && current !== null,
    },
  };
  const reject = (code, reason) => ({ ...quote, eligible: false, code, reason });
  if (!validTarget(targetId)) return reject('invalid_command', 'Choose a valid career decision.');
  if (state?.isDead) return reject('dead', 'This life has ended.');
  if (!state?.character || !Number.isInteger(state.age) || state.age < 0) return reject('invalid_command', 'Start a valid life before changing careers.');
  if (targetId === null) return current ? quote : { ...quote, code: 'already_unemployed', reason: 'You are already unemployed.' };
  if (current?.id === targetId) return { ...quote, code: 'already_employed_here', reason: 'You already have this role. Your earned salary and progress are preserved.' };
  if (!selected) return reject('unknown_career', 'That career is no longer available.');
  if (!validCareer(selected)) return reject('invalid_career', 'That career has invalid details.');
  const eligibility = checkCareerEligibility(selected, state.education ?? {}, state.stats ?? {}, state.networking ?? 0, state.age);
  return { ...quote, ...eligibility };
}

/** Pure deterministic resolver: no setters, clocks, randomness, storage or inference. */
export function resolveCareerChange(state, command, careersData) {
  const actionId = validId(command?.actionId) ? command.actionId : null;
  const targetId = validTarget(command?.targetId) ? command.targetId : null;
  const result = (status, code, details = {}) => makeActionResult({ actionId, actionType: 'career.choose', targetId, status, code, ...details });
  if (!actionId || !validTarget(command?.targetId)
    || (command.expectedBasis != null && typeof command.expectedBasis !== 'string')) return result('rejected', 'invalid_command');
  if (state?.isDead) return result('rejected', 'dead');
  const previous = findActionRecord(state?.history, actionId);
  if (previous) return previous.type === 'career.choose' && previous.targetId === targetId ? result('noop', 'duplicate_action') : result('rejected', 'action_id_conflict');
  const quote = quoteCareerChange(state, targetId, careersData);
  if (command.expectedBasis != null && command.expectedBasis !== quote.basis) return result('rejected', 'stale_quote');
  if (!quote.eligible) return result('rejected', quote.code);
  if (quote.code === 'already_employed_here' || quote.code === 'already_unemployed') return result('noop', quote.code);

  const current = state.career ?? null;
  const selected = targetId === null ? null : selectedCareer(careersData, targetId);
  const career = selected ? structuredClone(selected) : null;
  const careerMeta = { ...INITIAL_CAREER_META, financialStressFlag: career ? false : state.careerMeta?.financialStressFlag ?? false };
  const code = career ? 'career_selected' : 'career_quit';
  const record = {
    version: 1, id: actionId, type: 'career.choose', targetId,
    beforeCareerId: current?.id ?? null, afterCareerId: career?.id ?? null,
    beforeSalary: current?.salary ?? null, afterSalary: career?.salary ?? null, code,
  };
  const text = career
    ? (current ? `Career: You switched from ${current.title} to ${career.title} ($${career.salary.toLocaleString()}/yr).` : `Career: You got a job as a ${career.title} ($${career.salary.toLocaleString()}/yr).`)
    : `Career: You quit your role as ${current.title}. Future job income has ended; quitting grants no unemployment benefits.`;
  const history = [...(state.history ?? []), { age: state.age, text, action: record }];
  const facts = projectActionFacts(record, { age: state.age, beforeTitle: current?.title ?? null, afterTitle: career?.title ?? null });
  return result('committed', code, { patch: { career, careerMeta, history }, record, facts });
}
