export const KNOWN_SAVE_FIELDS = new Set([
  'character', 'age', 'stats', 'flags', 'isDead', 'career', 'bank', 'history',
  'currentEvent', 'activitiesThisYear', 'relationships', 'belongings',
  'properties', 'education', 'careerMeta', 'networking', 'economyCycle',
  'narrativeMode', 'pets', 'will', 'schemaVersion',
]);

const CORE_SAVE_FIELDS = ['character', 'age', 'stats', 'bank', 'history', 'isDead'];
const CORE_STAT_FIELDS = ['health', 'happiness', 'smarts', 'looks'];
const KNOWN_STAT_FIELDS = new Set([
  ...CORE_STAT_FIELDS,
  'grades', 'athleticism', 'karma', 'acting', 'voice', 'modeling',
]);
const EDUCATION_BOOLEAN_FIELDS = ['highSchool', 'associate', 'bachelor', 'master', 'phd'];
const CAREER_META_NUMBER_FIELDS = ['yearsInRole', 'unemploymentYearsLeft'];
const CAREER_META_BOOLEAN_FIELDS = ['isOnPIP', 'financialStressFlag'];
const ECONOMY_PHASES = new Set(['normal', 'boom', 'recession']);
const MAX_WARNINGS = 100;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateRecordArray(value, field, addWarning, validateItem) {
  if (!Array.isArray(value)) {
    addWarning('invalid_type', field);
    return;
  }

  for (const item of value) {
    if (!isRecord(item)) {
      addWarning('invalid_item_type', `${field}[]`);
      continue;
    }
    if (validateItem) validateItem(item);
  }
}

/**
 * Observes the current save shape without coercing, rejecting, or migrating it.
 * Warnings intentionally contain field paths and codes only, never field values.
 */
export function validateHydratedSave(saveData) {
  const warnings = [];
  const warningKeys = new Set();
  let truncated = false;

  const addWarning = (code, field) => {
    const key = `${code}:${field}`;
    if (warningKeys.has(key)) return;
    if (warnings.length >= MAX_WARNINGS) {
      truncated = true;
      return;
    }
    warningKeys.add(key);
    warnings.push(Object.freeze({ code, field }));
  };

  if (!isRecord(saveData)) {
    addWarning('invalid_type', 'save');
    return Object.freeze({
      hasWarnings: true,
      warnings: Object.freeze(warnings),
      warningFields: Object.freeze(['save']),
      truncated,
    });
  }

  for (const field of CORE_SAVE_FIELDS) {
    if (!Object.hasOwn(saveData, field)) addWarning('missing_field', field);
  }
  if (Object.keys(saveData).some(field => !KNOWN_SAVE_FIELDS.has(field))) {
    addWarning('unknown_field', 'unknown');
  }

  if (Object.hasOwn(saveData, 'character')) {
    if (!isRecord(saveData.character)) {
      addWarning('invalid_type', 'character');
    } else {
      for (const field of ['name', 'gender', 'country']) {
        if (typeof saveData.character[field] !== 'string' || !saveData.character[field]) {
          addWarning('invalid_type', `character.${field}`);
        }
      }
      if (saveData.character.city !== undefined
        && saveData.character.city !== null
        && typeof saveData.character.city !== 'string') {
        addWarning('invalid_type', 'character.city');
      }
    }
  }

  if (Object.hasOwn(saveData, 'age')) {
    if (!isFiniteNumber(saveData.age)) addWarning('invalid_type', 'age');
    else if (!Number.isInteger(saveData.age) || saveData.age < 0) addWarning('invalid_value', 'age');
  }

  if (Object.hasOwn(saveData, 'stats')) {
    if (!isRecord(saveData.stats)) {
      addWarning('invalid_type', 'stats');
    } else {
      for (const field of CORE_STAT_FIELDS) {
        if (!Object.hasOwn(saveData.stats, field)) addWarning('missing_field', `stats.${field}`);
      }
      if (Object.keys(saveData.stats).some(field => !KNOWN_STAT_FIELDS.has(field))) {
        addWarning('unknown_field', 'stats.unknown');
      }
      for (const field of KNOWN_STAT_FIELDS) {
        if (!Object.hasOwn(saveData.stats, field)) continue;
        const value = saveData.stats[field];
        if (!isFiniteNumber(value)) addWarning('invalid_type', `stats.${field}`);
        else if (value < 0 || value > 100) addWarning('out_of_range', `stats.${field}`);
      }
    }
  }

  if (Object.hasOwn(saveData, 'bank') && !isFiniteNumber(saveData.bank)) {
    addWarning('invalid_type', 'bank');
  }
  if (Object.hasOwn(saveData, 'isDead') && typeof saveData.isDead !== 'boolean') {
    addWarning('invalid_type', 'isDead');
  }
  if (Object.hasOwn(saveData, 'flags') && !Array.isArray(saveData.flags)) {
    addWarning('invalid_type', 'flags');
  }
  if (Object.hasOwn(saveData, 'narrativeMode') && typeof saveData.narrativeMode !== 'boolean') {
    addWarning('invalid_type', 'narrativeMode');
  }
  if (Object.hasOwn(saveData, 'networking')) {
    if (!isFiniteNumber(saveData.networking)) addWarning('invalid_type', 'networking');
    else if (saveData.networking < 0 || saveData.networking > 100) addWarning('out_of_range', 'networking');
  }

  if (Object.hasOwn(saveData, 'career') && saveData.career !== null) {
    if (!isRecord(saveData.career)) {
      addWarning('invalid_type', 'career');
    } else {
      if (typeof saveData.career.id !== 'string' || !saveData.career.id) addWarning('invalid_type', 'career.id');
      if (!isFiniteNumber(saveData.career.salary)) addWarning('invalid_type', 'career.salary');
    }
  }

  if (Object.hasOwn(saveData, 'history')) {
    validateRecordArray(saveData.history, 'history', addWarning, entry => {
      if (!isFiniteNumber(entry.age)) addWarning('invalid_type', 'history[].age');
      if (typeof entry.text !== 'string') addWarning('invalid_type', 'history[].text');
    });
  }

  if (Object.hasOwn(saveData, 'relationships')) {
    validateRecordArray(saveData.relationships, 'relationships', addWarning, relationship => {
      if (typeof relationship.id !== 'string' || !relationship.id) addWarning('invalid_type', 'relationships[].id');
      if (typeof relationship.type !== 'string' || !relationship.type) addWarning('invalid_type', 'relationships[].type');
      if (typeof relationship.name !== 'string' || !relationship.name) addWarning('invalid_type', 'relationships[].name');
      if (!isFiniteNumber(relationship.age)) addWarning('invalid_type', 'relationships[].age');
      if (!isFiniteNumber(relationship.relation)) addWarning('invalid_type', 'relationships[].relation');
      if (typeof relationship.status !== 'string' || !relationship.status) addWarning('invalid_type', 'relationships[].status');
      if (typeof relationship.isAlive !== 'boolean') addWarning('invalid_type', 'relationships[].isAlive');
    });
  }

  for (const field of ['belongings', 'properties']) {
    if (Object.hasOwn(saveData, field)) validateRecordArray(saveData[field], field, addWarning);
  }

  if (Object.hasOwn(saveData, 'pets')) {
    validateRecordArray(saveData.pets, 'pets', addWarning, pet => {
      if (typeof pet.id !== 'string' || !pet.id) addWarning('invalid_type', 'pets[].id');
      if (typeof pet.speciesId !== 'string' || !pet.speciesId) addWarning('invalid_type', 'pets[].speciesId');
      if (typeof pet.name !== 'string' || !pet.name) addWarning('invalid_type', 'pets[].name');
      if (!isFiniteNumber(pet.age)) addWarning('invalid_type', 'pets[].age');
      if (typeof pet.isAlive !== 'boolean') addWarning('invalid_type', 'pets[].isAlive');
    });
  }

  if (Object.hasOwn(saveData, 'education')) {
    if (!isRecord(saveData.education)) {
      addWarning('invalid_type', 'education');
    } else {
      for (const field of EDUCATION_BOOLEAN_FIELDS) {
        if (saveData.education[field] !== undefined && typeof saveData.education[field] !== 'boolean') {
          addWarning('invalid_type', `education.${field}`);
        }
      }
      if (saveData.education.currentDegree !== undefined
        && saveData.education.currentDegree !== null
        && !isRecord(saveData.education.currentDegree)) {
        addWarning('invalid_type', 'education.currentDegree');
      }
    }
  }

  if (Object.hasOwn(saveData, 'careerMeta')) {
    if (!isRecord(saveData.careerMeta)) {
      addWarning('invalid_type', 'careerMeta');
    } else {
      for (const field of CAREER_META_NUMBER_FIELDS) {
        if (saveData.careerMeta[field] !== undefined && !isFiniteNumber(saveData.careerMeta[field])) {
          addWarning('invalid_type', `careerMeta.${field}`);
        }
      }
      for (const field of CAREER_META_BOOLEAN_FIELDS) {
        if (saveData.careerMeta[field] !== undefined && typeof saveData.careerMeta[field] !== 'boolean') {
          addWarning('invalid_type', `careerMeta.${field}`);
        }
      }
    }
  }

  if (Object.hasOwn(saveData, 'will') && saveData.will !== null) {
    if (!isRecord(saveData.will)) {
      addWarning('invalid_type', 'will');
    } else {
      validateRecordArray(saveData.will.allocations, 'will.allocations', addWarning, allocation => {
        if (typeof allocation.id !== 'string' || !allocation.id) addWarning('invalid_type', 'will.allocations[].id');
        if (!isFiniteNumber(allocation.pct)) addWarning('invalid_type', 'will.allocations[].pct');
        else if (allocation.pct < 0 || allocation.pct > 100) addWarning('out_of_range', 'will.allocations[].pct');
      });
      if (saveData.will.draftedAtAge !== undefined && !isFiniteNumber(saveData.will.draftedAtAge)) {
        addWarning('invalid_type', 'will.draftedAtAge');
      }
    }
  }

  if (Object.hasOwn(saveData, 'economyCycle')) {
    if (!isRecord(saveData.economyCycle)) {
      addWarning('invalid_type', 'economyCycle');
    } else {
      if (!isFiniteNumber(saveData.economyCycle.year)) addWarning('invalid_type', 'economyCycle.year');
      if (!ECONOMY_PHASES.has(saveData.economyCycle.phase)) addWarning('invalid_value', 'economyCycle.phase');
      if (!isFiniteNumber(saveData.economyCycle.yearsInPhase)) addWarning('invalid_type', 'economyCycle.yearsInPhase');
    }
  }

  const warningFields = [...new Set(warnings.map(warning => warning.field))].sort();
  return Object.freeze({
    hasWarnings: warnings.length > 0,
    warnings: Object.freeze(warnings),
    warningFields: Object.freeze(warningFields),
    truncated,
  });
}
