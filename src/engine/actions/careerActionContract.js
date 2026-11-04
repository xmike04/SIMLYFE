/** Version-1 career action contract. Cloud acknowledgements remain separate. */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
const salary = value => Number.isFinite(value) && value >= 0;
const nullableId = value => value === null || boundedId(value);
const equalFields = (left, right) => isRecord(left) && isRecord(right)
  && Object.keys(left).length === Object.keys(right).length
  && Object.keys(left).every(key => Object.hasOwn(right, key) && left[key] === right[key]);
const RECORD_KEYS = ['version', 'id', 'type', 'targetId', 'beforeCareerId', 'afterCareerId', 'beforeSalary', 'afterSalary', 'code'];

/** Historical facts at decision time; current employment remains authoritative. */
export function validateCareerActionRecord(record) {
  if (!exactKeys(record, RECORD_KEYS) || record.version !== 1
    || !boundedId(record.id) || record.type !== 'career.choose'
    || !nullableId(record.targetId) || !nullableId(record.beforeCareerId) || !nullableId(record.afterCareerId)) return false;
  if (record.beforeCareerId === null ? record.beforeSalary !== null : !salary(record.beforeSalary)) return false;
  if (record.afterCareerId === null ? record.afterSalary !== null : !salary(record.afterSalary)) return false;
  if (record.code === 'career_selected') {
    return record.targetId !== null && record.targetId === record.afterCareerId
      && record.beforeCareerId !== record.afterCareerId;
  }
  return record.code === 'career_quit' && record.targetId === null
    && record.beforeCareerId !== null && record.afterCareerId === null;
}

/**
 * Future narration receives only this bounded projection, never a save, effects,
 * account data, or prose. The adapter must consume the committed record rather
 * than rerun the action. This function performs no IO or gameplay resolution.
 */
export function projectCareerActionFacts(record, { age, beforeTitle = null, afterTitle = null } = {}) {
  if (!validateCareerActionRecord(record) || !Number.isInteger(age) || age < 0) return null;
  const title = (id, value) => id === null ? null : (typeof value === 'string' && value.trim() ? value.slice(0, 120) : undefined);
  const before = title(record.beforeCareerId, beforeTitle);
  const after = title(record.afterCareerId, afterTitle);
  if (before === undefined || after === undefined) return null;
  return {
    version: record.version,
    actionId: record.id,
    actionType: record.type,
    age,
    code: record.code,
    beforeCareerId: record.beforeCareerId,
    afterCareerId: record.afterCareerId,
    beforeTitle: before,
    afterTitle: after,
    beforeSalary: record.beforeSalary,
    afterSalary: record.afterSalary,
  };
}

export function coherentCareerCommittedResult(result) {
  const { record, patch, facts } = result;
  if (!validateCareerActionRecord(record) || result.actionId !== record.id
    || result.actionType !== record.type || result.targetId !== record.targetId || result.code !== record.code
    || !exactKeys(patch, ['career', 'careerMeta', 'history'])) return false;
  if (record.afterCareerId === null) {
    if (patch.career !== null) return false;
  } else if (!isRecord(patch.career) || patch.career.id !== record.afterCareerId
    || patch.career.salary !== record.afterSalary || typeof patch.career.title !== 'string' || !patch.career.title.trim()
    || !['full_time', 'part_time'].includes(patch.career.type)) return false;
  const meta = patch.careerMeta;
  if (!exactKeys(meta, ['yearsInRole', 'isOnPIP', 'financialStressFlag', 'unemploymentYearsLeft'])
    || meta.yearsInRole !== 0 || meta.isOnPIP !== false || meta.unemploymentYearsLeft !== 0
    || typeof meta.financialStressFlag !== 'boolean' || (patch.career !== null && meta.financialStressFlag !== false)) return false;
  if (!Array.isArray(patch.history) || !patch.history.length) return false;
  const entry = patch.history.at(-1);
  if (!isRecord(entry) || typeof entry.text !== 'string' || !entry.text.trim()
    || !equalFields(entry.action, record)
    || patch.history.filter(item => validateCareerActionRecord(item?.action) && item.action.id === record.id).length !== 1) return false;
  const approvedFacts = projectCareerActionFacts(record, { age: entry.age, beforeTitle: facts?.beforeTitle, afterTitle: patch.career?.title ?? null });
  return approvedFacts !== null && equalFields(facts, approvedFacts);
}
