const SAFE_STATE_FIELDS = new Set([
  'character',
  'age',
  'stats',
  'flags',
  'isDead',
  'career',
  'bank',
  'history',
  'currentEvent',
  'activitiesThisYear',
  'relationships',
  'belongings',
  'properties',
  'education',
  'careerMeta',
  'networking',
  'economyCycle',
  'narrativeMode',
  'pets',
  'schemaVersion',
]);

const SAFE_VALIDATION_FIELDS = new Set([
  ...SAFE_STATE_FIELDS,
  'save',
  'unknown',
  'character.name',
  'character.gender',
  'character.country',
  'character.city',
  'stats.health',
  'stats.happiness',
  'stats.smarts',
  'stats.looks',
  'stats.grades',
  'stats.athleticism',
  'stats.karma',
  'stats.acting',
  'stats.voice',
  'stats.modeling',
  'stats.unknown',
  'career.id',
  'career.salary',
  'history[]',
  'history[].age',
  'history[].text',
  'relationships[]',
  'relationships[].id',
  'relationships[].type',
  'relationships[].name',
  'relationships[].age',
  'relationships[].relation',
  'relationships[].status',
  'relationships[].isAlive',
  'belongings[]',
  'properties[]',
  'pets[]',
  'pets[].id',
  'pets[].speciesId',
  'pets[].name',
  'pets[].age',
  'pets[].isAlive',
  'education.highSchool',
  'education.associate',
  'education.bachelor',
  'education.master',
  'education.phd',
  'education.currentDegree',
  'careerMeta.yearsInRole',
  'careerMeta.unemploymentYearsLeft',
  'careerMeta.isOnPIP',
  'careerMeta.financialStressFlag',
  'economyCycle.year',
  'economyCycle.phase',
  'economyCycle.yearsInPhase',
]);

const SAVE_STATUSES = new Set([
  'started',
  'loaded',
  'loaded_with_warnings',
  'not_found',
  'saved',
  'skipped',
  'failed',
]);

const AGE_STATUSES = new Set(['started', 'completed', 'death', 'failed']);
const LLM_STATUSES = new Set(['success', 'failure']);
const LLM_ERROR_CODES = new Set([
  'authentication',
  'timeout',
  'network',
  'service',
  'invalid_response',
  'rate_limited',
  'unknown',
]);
const SAFE_ERROR_CLASSES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'AbortError',
  'FirebaseError',
  'DOMException',
]);
const DIAGNOSTIC_SCOPES = new Set(['operation', 'save-load', 'save-sync', 'age-transition']);

let diagnosticSequence = 0;

function finiteNonNegativeNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function finiteAge(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

function safeIdentifier(value, fallback, maxLength = 128) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
    return fallback;
  }
  return normalized;
}

function safeOperationId(value) {
  if (typeof value !== 'string') return 'unknown';
  return /^(?:operation|save-load|save-sync|age-transition)-[a-z0-9]+-[a-z0-9]+$/.test(value)
    ? value
    : 'unknown';
}

function safeModel(value) {
  const model = safeIdentifier(value, 'unknown', 80);
  return /^(gpt-|o[0-9]|text-embedding-|omni-moderation-)[a-zA-Z0-9_.:-]+$/.test(model)
    ? model
    : 'unknown';
}

function safeRequestId(value) {
  if (typeof value !== 'string') return 'unknown';
  const requestId = value.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
  const isProviderId = /^req_[a-zA-Z0-9_-]{1,120}$/.test(requestId);
  return isUuid || isProviderId ? requestId : 'unknown';
}

function safeTokenCount(value) {
  const normalized = finiteNonNegativeNumber(value);
  return normalized === undefined ? undefined : normalized;
}

function chooseConsoleMethod(status) {
  if (status === 'failed' || status === 'failure') return 'error';
  if (status === 'loaded_with_warnings') return 'warn';
  return 'info';
}

function writeDiagnostic(record) {
  const method = chooseConsoleMethod(record.status);
  try {
    console[method]('[SIMLYFE diagnostic]', Object.freeze(record));
  } catch {
    // Observability must never interrupt gameplay.
  }
  return record;
}

function normalizeDiagnosticFields(fields) {
  if (!Array.isArray(fields)) return [];
  const normalized = [];
  let hasUnknownField = false;
  for (const field of fields) {
    if (SAFE_VALIDATION_FIELDS.has(field)) normalized.push(field);
    else hasUnknownField = true;
  }
  if (hasUnknownField) normalized.push('unknown');
  return [...new Set(normalized)].sort();
}

export function diagnosticNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createDiagnosticId(scope = 'operation') {
  diagnosticSequence += 1;
  const safeScope = DIAGNOSTIC_SCOPES.has(scope) ? scope : 'operation';
  return `${safeScope}-${Date.now().toString(36)}-${diagnosticSequence.toString(36)}`;
}

export function getErrorClass(error) {
  const candidate = error && typeof error === 'object'
    ? (error.name || error.constructor?.name)
    : null;
  return SAFE_ERROR_CLASSES.has(candidate) ? candidate : 'UnknownError';
}

/**
 * Converts state keys to a privacy-safe field list. Unknown keys are represented
 * by a single sentinel so user-controlled property names never enter diagnostics.
 */
export function getDiagnosticStateFields(stateData) {
  if (!stateData || typeof stateData !== 'object' || Array.isArray(stateData)) return [];

  const fields = [];
  let hasUnknownField = false;
  for (const field of Object.keys(stateData)) {
    if (SAFE_STATE_FIELDS.has(field)) fields.push(field);
    else hasUnknownField = true;
  }
  if (hasUnknownField) fields.push('unknown');
  return [...new Set(fields)].sort();
}

/**
 * Emits save and age-transition diagnostics using an event-specific allowlist.
 * Extra properties are deliberately ignored instead of being copied to logs.
 */
export function emitDiagnostic(event, details = {}) {
  if (event === 'save_load' || event === 'save_sync') {
    const status = SAVE_STATUSES.has(details.status) ? details.status : 'failed';
    const record = {
      event,
      operationId: safeOperationId(details.operationId),
      status,
      durationMs: finiteNonNegativeNumber(details.durationMs) ?? 0,
      fields: normalizeDiagnosticFields(details.fields),
    };
    if (details.errorClass) {
      record.errorClass = SAFE_ERROR_CLASSES.has(details.errorClass)
        ? details.errorClass
        : 'UnknownError';
    }
    return writeDiagnostic(record);
  }

  if (event === 'age_transition') {
    const status = AGE_STATUSES.has(details.status) ? details.status : 'failed';
    const record = {
      event,
      operationId: safeOperationId(details.operationId),
      status,
      durationMs: finiteNonNegativeNumber(details.durationMs) ?? 0,
    };
    const fromAge = finiteAge(details.fromAge);
    const toAge = finiteAge(details.toAge);
    if (fromAge !== undefined) record.fromAge = fromAge;
    if (toAge !== undefined) record.toAge = toAge;
    if (details.errorClass) {
      record.errorClass = SAFE_ERROR_CLASSES.has(details.errorClass)
        ? details.errorClass
        : 'UnknownError';
    }
    return writeDiagnostic(record);
  }

  return undefined;
}

/**
 * Adapter for llmService's optional diagnostics sink. Only operational metadata
 * is retained; prompts, state, action context, credentials, and response bodies
 * have no representation in the emitted record.
 */
export function emitLlmDiagnostic(details = {}) {
  const status = LLM_STATUSES.has(details.type) ? details.type : 'failure';
  const record = {
    event: 'llm_request',
    status,
    durationMs: finiteNonNegativeNumber(details.latencyMs) ?? 0,
  };

  if (details.requestId !== undefined) {
    record.requestId = safeRequestId(details.requestId);
  }
  if (details.model !== undefined) record.model = safeModel(details.model);
  if (details.code !== undefined) {
    record.errorCode = LLM_ERROR_CODES.has(details.code) ? details.code : 'unknown';
  }
  if (typeof details.status === 'number' && Number.isInteger(details.status)) {
    record.httpStatus = Math.min(599, Math.max(100, details.status));
  }

  const usage = details.usage && typeof details.usage === 'object' ? details.usage : {};
  const inputTokens = safeTokenCount(usage.inputTokens);
  const cachedInputTokens = safeTokenCount(usage.cachedInputTokens);
  const outputTokens = safeTokenCount(usage.outputTokens);
  const totalTokens = safeTokenCount(usage.totalTokens);
  if (inputTokens !== undefined) record.inputTokens = inputTokens;
  if (cachedInputTokens !== undefined) record.cachedInputTokens = cachedInputTokens;
  if (outputTokens !== undefined) record.outputTokens = outputTokens;
  if (totalTokens !== undefined) record.totalTokens = totalTokens;

  return writeDiagnostic(record);
}
