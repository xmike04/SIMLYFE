import { emitLlmDiagnostic } from './diagnostics';
import { getFirebaseIdToken } from './firebaseToken';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE
  || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Covers the edge's bounded auth, quota, and provider stages plus network overhead.
const REQUEST_TIMEOUT_MS = 20000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_BANK_EFFECT = 100000;
const MAX_STAT_EFFECT = 100;

const VALID_EFFECT_KEYS = new Set([
  'health', 'happiness', 'smarts', 'looks', 'bank',
  'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades', 'flags',
]);

const EVENT_KEYS = new Set(['description', 'choices']);
const CHOICE_KEYS = new Set(['text', 'effects']);
const RESPONSE_KEYS = new Set(['event', 'meta']);
const META_KEYS = new Set(['requestId', 'model', 'latencyMs', 'usage']);
const USAGE_KEYS = new Set([
  'inputTokens', 'outputTokens', 'cachedInputTokens', 'totalTokens',
]);

const USER_ERROR_MESSAGES = {
  authentication: 'LLM ERROR: Your session could not be verified. Reload and try again.',
  timeout: 'LLM ERROR: Event generation timed out. Please try again.',
  network: 'LLM ERROR: Event generation is temporarily unavailable. Please try again.',
  rate_limited: 'LLM ERROR: Event generation is busy. Please try again shortly.',
  service: 'LLM ERROR: Event generation failed. Please try again.',
  invalid_response: 'LLM ERROR: The event service returned an invalid response. Please try again.',
};

let diagnosticsHandler = null;

/**
 * Registers an optional diagnostics sink. Events contain only whitelisted
 * operational metadata; game state, action text, credentials, and provider
 * response bodies are never emitted.
 */
export function setLlmDiagnosticsHandler(handler) {
  diagnosticsHandler = typeof handler === 'function' ? handler : null;
}

function emitDiagnostic(event) {
  try {
    emitLlmDiagnostic(event);
  } catch {
    // Diagnostics must never interrupt gameplay.
  }

  if (!diagnosticsHandler) return;

  try {
    diagnosticsHandler(Object.freeze({ source: 'llmService', ...event }));
  } catch {
    // Diagnostics must never interrupt gameplay.
  }
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every(key => allowedKeys.has(key));
}

function boundedString(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const normalized = Array.from(value.normalize('NFKC'), character => {
    const code = character.charCodeAt(0);
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
      ? ' '
      : character;
  }).join('')
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function optionalString(value, maxLength) {
  const normalized = boundedString(value, maxLength);
  return normalized || null;
}

function finiteNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberInRange(value, minimum, maximum, fallback = 0) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

function integerInRange(value, minimum, maximum, fallback = 0) {
  return Math.trunc(numberInRange(value, minimum, maximum, fallback));
}

function booleanValue(value) {
  return value === true;
}

function validateFlags(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 4) {
    return 'Flags must be a non-empty array with at most 4 entries';
  }
  if (value.some(flag => (
    typeof flag !== 'string' || flag.length > 48 || !/^[a-z0-9][a-z0-9_-]*$/.test(flag)
  ))) {
    return 'Flags must contain lowercase identifiers no longer than 48 characters';
  }
  if (new Set(value).size !== value.length) {
    return 'Flags must not contain duplicates';
  }
  return null;
}

function validateEventPayload(payload) {
  if (!isRecord(payload) || !hasOnlyKeys(payload, EVENT_KEYS)) {
    return 'Event must be an object containing only description and choices';
  }

  if (typeof payload.description !== 'string' || !payload.description.trim()) {
    return 'Description must be a non-empty string';
  }
  if (payload.description.length > 280 || payload.description.trim().split(/\s+/u).length > 35) {
    return 'Description exceeds the maximum length';
  }

  if (!Array.isArray(payload.choices) || payload.choices.length === 0 || payload.choices.length > 3) {
    return 'Choices must contain between 1 and 3 entries';
  }

  for (const choice of payload.choices) {
    if (!isRecord(choice) || !hasOnlyKeys(choice, CHOICE_KEYS)) {
      return 'Choice must contain only text and effects';
    }
    if (typeof choice.text !== 'string' || !choice.text.trim() || choice.text.length > 80) {
      return 'Choice text must be a non-empty string no longer than 80 characters';
    }
    if (!isRecord(choice.effects)) {
      return 'Choice effects must be an object';
    }

    for (const [key, value] of Object.entries(choice.effects)) {
      if (!VALID_EFFECT_KEYS.has(key)) {
        return `Unknown effect key "${key}"`;
      }

      if (key === 'flags') {
        const flagsError = validateFlags(value);
        if (flagsError) return flagsError;
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return `Effect "${key}" must be a finite number`;
      }

      const limit = key === 'bank' ? MAX_BANK_EFFECT : MAX_STAT_EFFECT;
      if (Math.abs(value) > limit) {
        return `Effect "${key}" exceeds safe range`;
      }
    }
  }

  return null;
}

function sanitizeUsage(usage) {
  if (!isRecord(usage)) return undefined;

  const sanitized = {};
  for (const [key, value] of Object.entries(usage)) {
    if (USAGE_KEYS.has(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length ? sanitized : undefined;
}

function sanitizeMeta(meta) {
  if (!isRecord(meta) || !hasOnlyKeys(meta, META_KEYS)) return null;

  const requestId = boundedString(meta.requestId, 128);
  const model = boundedString(meta.model, 100);
  const latencyMs = finiteNumber(meta.latencyMs, -1);
  if (!requestId || !model || latencyMs < 0) return null;

  const sanitized = { requestId, model, latencyMs };
  const usage = sanitizeUsage(meta.usage);
  if (usage) sanitized.usage = usage;
  return sanitized;
}

function projectStats(stats) {
  const source = isRecord(stats) ? stats : {};
  return {
    health: numberInRange(source.health, 0, 100),
    happiness: numberInRange(source.happiness, 0, 100),
    smarts: numberInRange(source.smarts, 0, 100),
    looks: numberInRange(source.looks, 0, 100),
    athleticism: numberInRange(source.athleticism, 0, 100),
    karma: numberInRange(source.karma, 0, 100),
    acting: numberInRange(source.acting, 0, 100),
    voice: numberInRange(source.voice, 0, 100),
    modeling: numberInRange(source.modeling, 0, 100),
    grades: numberInRange(source.grades, 0, 100),
  };
}

function projectEducation(education) {
  const source = isRecord(education) ? education : {};
  const currentDegree = isRecord(source.currentDegree)
    ? source.currentDegree.type
    : source.currentDegree;
  return {
    highSchool: booleanValue(source.highSchool),
    associate: booleanValue(source.associate),
    bachelor: booleanValue(source.bachelor),
    master: booleanValue(source.master),
    phd: booleanValue(source.phd),
    currentDegree: optionalString(currentDegree, 40),
  };
}

function projectRelationships(relationships) {
  if (!Array.isArray(relationships)) return [];

  return relationships.slice(0, 5).filter(isRecord).map(relationship => ({
    id: optionalString(relationship.id, 80),
    name: boundedString(relationship.name, 80, 'Unknown'),
    type: boundedString(relationship.type, 40, 'Acquaintance'),
    age: integerInRange(relationship.age, 0, 130),
    relation: numberInRange(relationship.relation, 0, 100),
    status: optionalString(relationship.status, 40),
    isAlive: relationship.isAlive !== false,
  }));
}

function projectPets(pets) {
  if (!Array.isArray(pets)) return [];

  return pets.filter(pet => isRecord(pet) && pet.isAlive !== false).slice(0, 5).map(pet => ({
    id: optionalString(pet.id, 80),
    name: boundedString(pet.name, 80, 'Pet'),
    type: optionalString(pet.type, 40) ?? boundedString(pet.speciesId, 40, 'unknown'),
    age: integerInRange(pet.age, 0, 80),
    isAlive: true,
  }));
}

function projectHistory(history) {
  if (!Array.isArray(history)) return [];

  return history.slice(-5).filter(isRecord).map(entry => ({
    age: integerInRange(entry.age, 0, 130),
    text: boundedString(entry.text, 300),
  })).filter(entry => entry.text);
}

function projectState(state) {
  const source = isRecord(state) ? state : {};
  const character = isRecord(source.character) ? source.character : {};
  const career = isRecord(source.career)
    ? {
        id: optionalString(source.career.id, 80),
        title: boundedString(source.career.title, 120, 'Unknown'),
      }
    : null;

  return {
    character: {
      name: boundedString(character.name, 80, 'Unknown'),
      gender: boundedString(character.gender, 40, 'Unknown'),
      country: boundedString(character.country, 80, 'Unknown'),
    },
    age: integerInRange(source.age, 0, 130),
    stats: projectStats(source.stats),
    bank: numberInRange(source.bank, -1_000_000_000_000, 1_000_000_000_000),
    career,
    recentHistory: projectHistory(source.history),
    relationships: projectRelationships(source.relationships),
    pets: projectPets(source.pets),
    city: optionalString(source.city, 100),
    education: projectEducation(source.education),
    economyPhase: ['normal', 'boom', 'recession'].includes(source.economyPhase)
      ? source.economyPhase
      : 'normal',
  };
}

function errorEvent(code) {
  return {
    description: USER_ERROR_MESSAGES[code] ?? USER_ERROR_MESSAGES.service,
    choices: [{ text: 'Understood', effects: {} }],
  };
}

function requestError(code, status) {
  const error = new Error(code);
  error.code = code;
  if (typeof status === 'number') error.status = status;
  return error;
}

function withAbort(promise, signal) {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });
    Promise.resolve(promise).then(
      value => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

export async function generateDynamicEvent(state, actionContext) {
  if (!supabaseUrl || !supabaseKey) {
    const diagnostic = { type: 'failure', code: 'service' };
    emitDiagnostic(diagnostic);
    return errorEvent('service');
  }

  const requestBody = JSON.stringify({
    state: projectState(state),
    actionContext: optionalString(actionContext, 400),
    narrativeMode: booleanValue(state?.narrativeMode),
  });
  if (new TextEncoder().encode(requestBody).byteLength > MAX_BODY_BYTES) {
    emitDiagnostic({ type: 'failure', code: 'service' });
    return errorEvent('service');
  }

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let firebaseIdToken;
    try {
      firebaseIdToken = await withAbort(getFirebaseIdToken(), controller.signal);
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw requestError('authentication');
    }
    if (!firebaseIdToken) throw requestError('authentication');

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firebaseIdToken}`,
        apikey: supabaseKey,
      },
      body: requestBody,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      if (!response.ok) throw requestError('service', response.status);
      throw requestError('invalid_response', response.status);
    }

    if (!response.ok || isRecord(data?.error)) {
      const edgeErrorCode = typeof data?.error?.code === 'string'
        ? data.error.code.toLowerCase()
        : '';
      const code = response.status === 429 || edgeErrorCode === 'rate_limited'
        ? 'rate_limited'
        : 'service';
      throw requestError(code, response.status);
    }

    if (!isRecord(data) || !hasOnlyKeys(data, RESPONSE_KEYS)) {
      throw requestError('invalid_response', response.status);
    }

    const validationError = validateEventPayload(data.event);
    const meta = sanitizeMeta(data.meta);
    if (validationError || !meta) {
      throw requestError('invalid_response', response.status);
    }

    emitDiagnostic({
      type: 'success',
      requestId: meta.requestId,
      model: meta.model,
      latencyMs: meta.latencyMs,
      ...(meta.usage ? { usage: meta.usage } : {}),
    });

    return { ...data.event, meta };
  } catch (error) {
    const code = controller.signal.aborted || error?.name === 'AbortError'
      ? 'timeout'
      : error?.code === 'authentication' || error?.status === 401 || error?.status === 403
        ? 'authentication'
        : error?.code === 'rate_limited'
          ? 'rate_limited'
          : error?.code === 'invalid_response'
            ? 'invalid_response'
            : error?.code === 'service'
              ? 'service'
              : 'network';

    const diagnostic = {
      type: 'failure',
      code,
      latencyMs: Date.now() - startedAt,
      ...(typeof error?.status === 'number' ? { status: error.status } : {}),
    };
    emitDiagnostic(diagnostic);
    return errorEvent(code);
  } finally {
    clearTimeout(timeoutId);
  }
}
