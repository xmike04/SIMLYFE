/** Explicit shared action envelope; domain contracts own their allowed changes. */
import { validateCareerActionRecord, projectCareerActionFacts, coherentCareerCommittedResult } from './careerActionContract';
import { validateEducationActionRecord, projectEducationActionFacts, coherentEducationCommittedResult } from './educationActionContract';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const nullableId = value => value === null || boundedId(value);

export function validateActionRecord(record) {
  if (record?.type === 'career.choose') return validateCareerActionRecord(record);
  if (record?.type === 'education.enroll') return validateEducationActionRecord(record);
  return false;
}

/** Malformed and legacy entries are observed, never repaired or removed. */
export function findActionRecord(history, actionId) {
  if (!Array.isArray(history) || !boundedId(actionId)) return null;
  const entry = history.find(item => validateActionRecord(item?.action) && item.action.id === actionId);
  return entry ? { ...entry.action } : null;
}

/** Project only approved domain facts; no IO, prose or gameplay resolution. */
export function projectActionFacts(record, context) {
  if (record?.type === 'career.choose') return projectCareerActionFacts(record, context);
  if (record?.type === 'education.enroll') return projectEducationActionFacts(record, context);
  return null;
}

/** Validate the complete logical commit before any owner installs its patch. */
export function makeActionResult({ actionId = null, actionType = 'career.choose', targetId = null, status, code, patch = {}, record = null, facts = null }, { sourceState } = {}) {
  if (!['committed', 'rejected', 'noop'].includes(status) || !['career.choose', 'education.enroll'].includes(actionType)
    || (actionId !== null && !boundedId(actionId)) || !nullableId(targetId)
    || typeof code !== 'string' || !code) throw new TypeError('Invalid action result envelope');
  const result = { actionId, actionType, targetId, status, code, patch, record, facts };
  if (status === 'committed') {
    // One identity across both recognized domains, including prior history.
    if (!validateActionRecord(record) || !Array.isArray(patch?.history)
      || patch.history.filter(item => validateActionRecord(item?.action) && item.action.id === record.id).length !== 1) {
      throw new TypeError('Incoherent committed action history');
    }
    const coherent = actionType === 'career.choose'
      ? coherentCareerCommittedResult(result)
      : coherentEducationCommittedResult(result, sourceState);
    if (!coherent) throw new TypeError(`Incoherent committed ${actionType === 'career.choose' ? 'career' : 'education'} action`);
  } else if (!exactKeys(patch, []) || record !== null || facts !== null) {
    throw new TypeError('Rejected and no-op actions cannot carry changes or facts');
  }
  return result;
}
