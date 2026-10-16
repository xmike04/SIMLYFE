/** Versioned facts inside existing history; these records never replace live state. */
const RECORD_KEYS = ['version', 'id', 'type', 'targetId', 'beforeCareerId', 'afterCareerId', 'beforeSalary', 'afterSalary', 'code'];
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const nullableId = value => value === null || id(value);
const salary = value => value === null || (Number.isFinite(value) && value >= 0);

export function isActionRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).length !== RECORD_KEYS.length || RECORD_KEYS.some(key => !Object.hasOwn(value, key))) return false;
  if (value.version !== 1 || !id(value.id) || value.type !== 'career.choose') return false;
  if (![value.targetId, value.beforeCareerId, value.afterCareerId].every(nullableId)) return false;
  if (![value.beforeSalary, value.afterSalary].every(salary)) return false;
  if ((value.beforeCareerId === null) !== (value.beforeSalary === null)) return false;
  if ((value.afterCareerId === null) !== (value.afterSalary === null)) return false;
  return value.code === 'career_selected'
    ? value.targetId !== null && value.targetId === value.afterCareerId
    : value.code === 'career_quit' && value.targetId === null && value.afterCareerId === null && value.beforeCareerId !== null;
}

export function findActionRecord(history, actionId) {
  return (Array.isArray(history) ? history : []).find(entry => isActionRecord(entry?.action) && entry.action.id === actionId)?.action ?? null;
}

/** Allowlisted facts for a future narration adapter; never forward arbitrary input. */
export function projectActionFacts(record, { age, beforeTitle = null, afterTitle = null } = {}) {
  if (!isActionRecord(record) || !Number.isInteger(age) || age < 0) return null;
  const title = value => typeof value === 'string' ? value.slice(0, 120) : null;
  return {
    version: 1, actionId: record.id, actionType: record.type, age, code: record.code,
    beforeCareerId: record.beforeCareerId, afterCareerId: record.afterCareerId,
    beforeTitle: title(beforeTitle), afterTitle: title(afterTitle),
    beforeSalary: record.beforeSalary, afterSalary: record.afterSalary,
  };
}

/** Construct one domain result, without React state, IO, clocks, or randomness. */
export function makeActionResult({ actionId, targetId, status, code, patch = {}, record = null, facts = null }) {
  if (!id(actionId) || !nullableId(targetId) || !['committed', 'rejected', 'noop'].includes(status) || !id(code)) throw new Error('Invalid action result');
  if (status === 'committed') {
    if (!isActionRecord(record) || record.id !== actionId || record.targetId !== targetId || record.code !== code
      || !patch || Object.keys(patch).sort().join(',') !== 'career,careerMeta,history'
      || !Array.isArray(patch.history) || patch.history.at(-1)?.action !== record
      || patch.career?.id !== (record.afterCareerId ?? undefined) || !facts) throw new Error('Invalid committed result');
  } else if (Object.keys(patch).length || record !== null || facts !== null) throw new Error('Noncommitted action has effects');
  return Object.freeze({ actionId, actionType: 'career.choose', targetId, status, code, patch, record, facts });
}
