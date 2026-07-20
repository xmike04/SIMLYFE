/**
 * llmService.test.js
 *
 * Tests the authenticated, typed browser-to-edge LLM boundary as well as the
 * static event and career data contracts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import staticEvents from '../engine/events.json';
import staticCareers from '../engine/careers.json';

vi.unmock('../engine/llmService');

const originalFetch = globalThis.fetch;

const makeState = (overrides = {}) => ({
  character: { name: 'Test User', gender: 'Male', country: 'USA' },
  age: 25,
  stats: {
    health: 80,
    happiness: 70,
    smarts: 60,
    looks: 55,
    athleticism: 50,
    karma: 50,
    acting: 4,
    voice: 3,
    modeling: 2,
    grades: 75,
  },
  bank: 5000,
  career: { id: 'software-engineer', title: 'Software Engineer' },
  history: [
    { age: 23, text: 'You went on vacation.' },
    { age: 24, text: 'You worked hard.' },
  ],
  relationships: [
    {
      id: 'relationship-1',
      name: 'Alex',
      type: 'Friend',
      age: 26,
      relation: 80,
      status: 'active',
      isAlive: true,
    },
  ],
  pets: [
    {
      id: 'pet-1',
      name: 'Pixel',
      speciesId: 'cat',
      age: 3,
      isAlive: true,
    },
  ],
  city: 'Chicago',
  education: {
    highSchool: true,
    associate: false,
    bachelor: true,
    master: false,
    phd: false,
    currentDegree: { type: 'master', yearsInProgram: 1 },
  },
  economyPhase: 'normal',
  narrativeMode: false,
  ...overrides,
});

const makeMaximumProjectionState = unit => {
  const fill = length => unit.repeat(length);
  return makeState({
    character: { name: fill(80), gender: fill(40), country: fill(80) },
    bank: 1_000_000_000_000,
    career: { id: fill(80), title: fill(120) },
    history: Array.from({ length: 5 }, (_, index) => ({ age: index, text: fill(300) })),
    relationships: Array.from({ length: 5 }, (_, index) => ({
      id: fill(80),
      name: fill(80),
      type: fill(40),
      age: index,
      relation: 100,
      status: fill(40),
      isAlive: true,
    })),
    pets: Array.from({ length: 5 }, (_, index) => ({
      id: fill(80),
      name: fill(80),
      speciesId: fill(40),
      age: index,
      isAlive: true,
    })),
    city: fill(100),
    education: {
      highSchool: true,
      associate: true,
      bachelor: true,
      master: true,
      phd: true,
      currentDegree: { type: fill(40) },
    },
    economyPhase: 'recession',
  });
};

const validEvent = {
  description: 'You stumble across a hidden opportunity.',
  choices: [
    { text: 'Take it', effects: { bank: 200 } },
    { text: 'Ignore it', effects: {} },
  ],
};

const validMeta = {
  requestId: 'request-123',
  model: 'gpt-5-nano',
  latencyMs: 125,
  usage: {
    inputTokens: 800,
    outputTokens: 80,
    totalTokens: 880,
  },
};

const successEnvelope = (event = validEvent, meta = validMeta) => ({ event, meta });

const responseWith = (data, options = {}) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: vi.fn().mockResolvedValue(data),
});

const makeUser = (token = 'firebase-id-token') => ({
  getIdToken: vi.fn().mockResolvedValue(token),
});

async function loadService({
  supabaseUrl = 'https://test.supabase.co',
  publishableKey = '',
  anonKey = 'supabase-anon-key',
  currentUser,
  authConfigured = true,
  directKey = 'browser-direct-key-must-never-be-used',
} = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', supabaseUrl);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE', publishableKey);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey);
  vi.stubEnv('VITE_OPENAI_API_KEY', directKey);

  const resolvedUser = currentUser === undefined ? makeUser() : currentUser;
  const { setFirebaseIdTokenProvider } = await import('../engine/firebaseToken');
  setFirebaseIdTokenProvider(
    authConfigured && resolvedUser
      ? () => resolvedUser.getIdToken()
      : null,
  );

  const service = await import('../engine/llmService');
  return { ...service, currentUser: resolvedUser };
}

function expectErrorEvent(event, expectedText, leakedText) {
  expect(event.description).toMatch(/^LLM ERROR:/);
  expect(event.description).toContain(expectedText);
  expect(event.choices).toEqual([{ text: 'Understood', effects: {} }]);
  if (leakedText) expect(JSON.stringify(event)).not.toContain(leakedText);
}

describe('generateDynamicEvent', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('surfaces a sanitized error event when the proxy is not configured', async () => {
    globalThis.fetch = vi.fn();
    const { generateDynamicEvent } = await loadService({
      supabaseUrl: '',
      anonKey: '',
      directKey: 'browser-direct-secret',
    });

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'Event generation failed');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('surfaces a sanitized authentication error when Firebase Auth is unavailable', async () => {
    globalThis.fetch = vi.fn();
    const { generateDynamicEvent } = await loadService({ authConfigured: false });

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'session could not be verified');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('surfaces a sanitized authentication error when there is no current user', async () => {
    globalThis.fetch = vi.fn();
    const { generateDynamicEvent } = await loadService({ currentUser: null });

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'session could not be verified');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not leak Firebase token retrieval errors to the player', async () => {
    const user = {
      getIdToken: vi.fn().mockRejectedValue(new Error('refresh token secret leaked')),
    };
    const { generateDynamicEvent } = await loadService({ currentUser: user });

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'session could not be verified', 'refresh token secret leaked');
  });

  it('requires a non-empty Firebase ID token', async () => {
    globalThis.fetch = vi.fn();
    const { generateDynamicEvent } = await loadService({ currentUser: makeUser('') });

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'session could not be verified');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('calls only the configured Supabase edge endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService({
      supabaseUrl: 'https://project.supabase.co',
      directKey: 'browser-direct-secret',
    });

    await generateDynamicEvent(makeState());

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch.mock.calls[0][0]).toBe(
      'https://project.supabase.co/functions/v1/generate-event',
    );
    expect(globalThis.fetch.mock.calls[0][0]).not.toContain('openai.com');
  });

  it('uses the Firebase ID token as bearer and the Supabase key only as apikey', async () => {
    const user = makeUser('firebase-user-token');
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService({
      anonKey: 'public-anon-key',
      currentUser: user,
    });

    await generateDynamicEvent(makeState());

    expect(user.getIdToken).toHaveBeenCalledTimes(1);
    const options = globalThis.fetch.mock.calls[0][1];
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer firebase-user-token',
      apikey: 'public-anon-key',
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('prefers the current Supabase publishable key over the legacy anon key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService({
      publishableKey: 'current-publishable-key',
      anonKey: 'legacy-anon-key',
    });

    await generateDynamicEvent(makeState());

    expect(globalThis.fetch.mock.calls[0][1].headers.apikey).toBe('current-publishable-key');
  });

  it('sends only the typed state projection, action context, and narrative mode', async () => {
    const history = Array.from(
      { length: 8 },
      (_, index) => ({ age: 18 + index, text: 'History entry ' + index }),
    );
    const relationships = Array.from(
      { length: 7 },
      (_, index) => ({
        id: 'r-' + index,
        name: 'Person ' + index,
        type: 'Friend',
        age: 30 + index,
        relation: 50 + index,
        status: 'active',
        isAlive: true,
      }),
    );
    const pets = [
      { id: 'dead-pet', name: 'Ghost', speciesId: 'dog', age: 12, isAlive: false },
      ...Array.from(
        { length: 6 },
        (_, index) => ({
          id: 'pet-' + index,
          name: 'Pet ' + index,
          speciesId: index === 0 ? 'cat' : 'dog',
          age: index,
          isAlive: true,
        }),
      ),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService();
    await generateDynamicEvent(
      makeState({ history, relationships, pets, narrativeMode: true }),
      '  Went to the gym  ',
    );

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(Object.keys(body)).toEqual(['state', 'actionContext', 'narrativeMode']);
    expect(Object.keys(body.state)).toEqual([
      'character',
      'age',
      'stats',
      'bank',
      'career',
      'recentHistory',
      'relationships',
      'pets',
      'city',
      'education',
      'economyPhase',
    ]);
    expect(body.actionContext).toBe('Went to the gym');
    expect(body.narrativeMode).toBe(true);
    expect(body.state.character).toEqual({
      name: 'Test User',
      gender: 'Male',
      country: 'USA',
    });
    expect(body.state.recentHistory.map(entry => entry.text)).toEqual([
      'History entry 3',
      'History entry 4',
      'History entry 5',
      'History entry 6',
      'History entry 7',
    ]);
    expect(body.state.relationships).toHaveLength(5);
    expect(body.state.pets).toHaveLength(5);
    expect(body.state.pets[0]).toMatchObject({ name: 'Pet 0', type: 'cat', isAlive: true });
    expect(body.state.pets.find(pet => pet.name === 'Ghost')).toBeUndefined();
    expect(body.state.education.currentDegree).toBe('master');

    for (const forbidden of ['messages', 'model', 'temperature', 'max_tokens', 'maxTokens']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    expect(globalThis.fetch.mock.calls[0][1].body).not.toContain('browser-direct-secret');
  });

  it('bounds projected identifiers, labels, and bank balance to the edge contract', async () => {
    const longText = 'x'.repeat(200);
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService();

    await generateDynamicEvent(makeState({
      character: { name: longText, gender: 'Female', country: longText },
      bank: Number.MAX_SAFE_INTEGER,
      career: { id: longText, title: longText },
      relationships: [{
        id: longText,
        name: longText,
        type: longText,
        age: 200,
        relation: 200,
        status: longText,
        isAlive: true,
      }],
      pets: [{
        id: longText,
        name: longText,
        speciesId: longText,
        age: 200,
        isAlive: true,
      }],
    }));

    const projection = JSON.parse(globalThis.fetch.mock.calls[0][1].body).state;
    expect(projection.character.name).toHaveLength(80);
    expect(projection.character.country).toHaveLength(80);
    expect(projection.career.id).toHaveLength(80);
    expect(projection.career.title).toHaveLength(120);
    expect(projection.relationships[0]).toMatchObject({ age: 130, relation: 100 });
    expect(projection.relationships[0].id).toHaveLength(80);
    expect(projection.relationships[0].name).toHaveLength(80);
    expect(projection.relationships[0].type).toHaveLength(40);
    expect(projection.relationships[0].status).toHaveLength(40);
    expect(projection.pets[0]).toMatchObject({ age: 80 });
    expect(projection.pets[0].id).toHaveLength(80);
    expect(projection.pets[0].name).toHaveLength(80);
    expect(projection.pets[0].type).toHaveLength(40);
    expect(projection.bank).toBe(1_000_000_000_000);
  });

  it('keeps a maximum three-byte Unicode projection within the 16 KiB edge budget', async () => {
    const unit = '界';
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(
      makeMaximumProjectionState(unit),
      unit.repeat(400),
    );

    expect(result.description).toBe(validEvent.description);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const body = globalThis.fetch.mock.calls[0][1].body;
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(16 * 1024);
    const parsed = JSON.parse(body);
    expect(parsed.actionContext).toHaveLength(400);
    expect(parsed.state.recentHistory[0].text).toHaveLength(300);
  });

  it('rejects an oversized serialized projection before fetch without leaking content', async () => {
    const malformedUnit = String.fromCharCode(0xD800);
    globalThis.fetch = vi.fn();
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const result = await generateDynamicEvent(
      makeMaximumProjectionState(malformedUnit),
      malformedUnit.repeat(400),
    );

    expectErrorEvent(result, 'Event generation failed');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(diagnostics.at(-1)).toMatchObject({ type: 'failure', code: 'service' });
    expect(JSON.stringify(diagnostics)).not.toContain('\\ud800');
  });

  it('uses null for an absent action context', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent } = await loadService();

    await generateDynamicEvent(makeState());

    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.actionContext).toBeNull();
  });

  it('returns the direct validated event and sanitized metadata', async () => {
    const meta = {
      ...validMeta,
      usage: {
        ...validMeta.usage,
        providerInternalCounter: 999,
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope(validEvent, meta)));
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(makeState());

    expect(result).toEqual({
      ...validEvent,
      meta: validMeta,
    });
  });

  it.each([
    [
      'a raw OpenAI response',
      { choices: [{ message: { content: JSON.stringify(validEvent) } }] },
    ],
    [
      'a missing metadata envelope',
      { event: validEvent },
    ],
    [
      'an extra event property',
      successEnvelope({ ...validEvent, privilegedAction: 'custody_change' }),
    ],
    [
      'an extra choice property',
      successEnvelope({
        ...validEvent,
        choices: [{ text: 'Continue', effects: {}, custodyChange: true }],
      }),
    ],
    [
      'an empty description',
      successEnvelope({ description: '', choices: validEvent.choices }),
    ],
    [
      'empty choices',
      successEnvelope({ description: 'No options.', choices: [] }),
    ],
    [
      'an unknown effect',
      successEnvelope({
        description: 'An invalid effect.',
        choices: [{ text: 'Continue', effects: { hacking: 5 } }],
      }),
    ],
    [
      'a non-numeric effect',
      successEnvelope({
        description: 'An invalid amount.',
        choices: [{ text: 'Continue', effects: { bank: 'NaN' } }],
      }),
    ],
    [
      'invalid flags',
      successEnvelope({
        description: 'An invalid flag.',
        choices: [{ text: 'Continue', effects: { flags: 'secret' } }],
      }),
    ],
    [
      'a description beyond the 35-word edge boundary',
      successEnvelope({
        description: Array.from({ length: 36 }, () => 'word').join(' '),
        choices: [{ text: 'Continue', effects: {} }],
      }),
    ],
    [
      'more than three choices',
      successEnvelope({
        description: 'Too many choices.',
        choices: Array.from({ length: 4 }, (_, index) => ({
          text: 'Choice ' + index,
          effects: {},
        })),
      }),
    ],
    [
      'a flag outside the edge identifier contract',
      successEnvelope({
        description: 'An invalid flag format.',
        choices: [{ text: 'Continue', effects: { flags: ['Not-Lowercase'] } }],
      }),
    ],
  ])('rejects %s with a sanitized schema error', async (_label, payload) => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(payload));
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'invalid response');
    expect(JSON.stringify(result)).not.toContain('custody_change');
  });

  it('sanitizes API errors without exposing provider response details', async () => {
    const providerSecret = 'provider org secret and quota detail';
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(
      { error: { code: 'provider_error', message: providerSecret } },
      { ok: false, status: 500 },
    ));
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'Event generation failed', providerSecret);
    expect(JSON.stringify(diagnostics)).not.toContain(providerSecret);
    expect(diagnostics.at(-1)).toMatchObject({
      source: 'llmService',
      type: 'failure',
      code: 'service',
      status: 500,
    });
  });

  it.each([401, 403])('maps HTTP %s to a sanitized authentication error', async status => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(
      { error: { code: 'unauthorized', message: 'sensitive auth detail' } },
      { ok: false, status },
    ));
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'session could not be verified', 'sensitive auth detail');
  });

  it('maps HTTP 429 to a sanitized rate-limit error and diagnostic', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(
      { error: { code: 'provider_error', message: 'raw rate limit text' } },
      { ok: false, status: 429 },
    ));
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'try again shortly', 'raw rate limit text');
    expect(diagnostics.at(-1)).toMatchObject({ type: 'failure', code: 'rate_limited' });
  });

  it('honors the sanitized edge RATE_LIMITED error code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(
      { error: { code: 'RATE_LIMITED', message: 'do not surface me' } },
      { ok: false, status: 400 },
    ));
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'try again shortly', 'do not surface me');
  });

  it('sanitizes network failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error('DNS failure included a private hostname'),
    );
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'temporarily unavailable', 'private hostname');
    expect(JSON.stringify(diagnostics)).not.toContain('private hostname');
    expect(diagnostics.at(-1)).toMatchObject({ type: 'failure', code: 'network' });
  });

  it('sanitizes malformed JSON responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('raw response body secret')),
    });
    const { generateDynamicEvent } = await loadService();

    const result = await generateDynamicEvent(makeState());

    expectErrorEvent(result, 'invalid response', 'raw response body secret');
  });

  it('times out a hung Firebase token refresh within the same client budget', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
    const user = {
      getIdToken: vi.fn(() => new Promise(() => {})),
    };
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService({ currentUser: user });
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const pendingResult = generateDynamicEvent(makeState());
    await vi.advanceTimersByTimeAsync(20000);
    const result = await pendingResult;

    expectErrorEvent(result, 'timed out');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(diagnostics.at(-1)).toMatchObject({
      type: 'failure',
      code: 'timeout',
      latencyMs: 20000,
    });
  });

  it('aborts requests after the client timeout', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('provider timeout internals');
        error.name = 'AbortError';
        reject(error);
      });
    }));
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const pendingResult = generateDynamicEvent(makeState());
    await vi.advanceTimersByTimeAsync(20000);
    const result = await pendingResult;

    expectErrorEvent(result, 'timed out', 'provider timeout internals');
    expect(globalThis.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(diagnostics.at(-1)).toMatchObject({
      type: 'failure',
      code: 'timeout',
      latencyMs: 20000,
    });
  });

  it('emits redacted success diagnostics and ignores diagnostics handler failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(responseWith(successEnvelope()));
    const { generateDynamicEvent, setLlmDiagnosticsHandler } = await loadService();
    const diagnostics = [];
    setLlmDiagnosticsHandler(event => diagnostics.push(event));

    const firstResult = await generateDynamicEvent(makeState(), 'private action context');

    expect(firstResult.description).toBe(validEvent.description);
    expect(diagnostics).toEqual([{
      source: 'llmService',
      type: 'success',
      requestId: validMeta.requestId,
      model: validMeta.model,
      latencyMs: validMeta.latencyMs,
      usage: validMeta.usage,
    }]);
    expect(JSON.stringify(diagnostics)).not.toContain('private action context');
    expect(JSON.stringify(diagnostics)).not.toContain('firebase-id-token');

    setLlmDiagnosticsHandler(() => {
      throw new Error('telemetry unavailable');
    });
    const secondResult = await generateDynamicEvent(makeState());
    expect(secondResult.description).toBe(validEvent.description);
  });
});

// ─── 2. events.json schema validation ────────────────────────────────────────

describe('events.json', () => {
  const REQUIRED_FIELDS = ['id', 'minAge', 'maxAge', 'description', 'choices'];
  const CHOICE_FIELDS = ['text', 'effects'];
  const VALID_EFFECT_KEYS = new Set([
    'health', 'happiness', 'smarts', 'looks', 'bank',
    'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades', 'flags'
  ]);

  it('is a non-empty array', () => {
    expect(Array.isArray(staticEvents)).toBe(true);
    expect(staticEvents.length).toBeGreaterThan(0);
  });

  it('every event has all required fields', () => {
    for (const event of staticEvents) {
      for (const field of REQUIRED_FIELDS) {
        expect(event, `Event "${event.id}" missing field: ${field}`).toHaveProperty(field);
      }
    }
  });

  it('no duplicate event IDs', () => {
    const ids = staticEvents.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all minAge < maxAge', () => {
    for (const event of staticEvents) {
      expect(event.minAge, `${event.id}: minAge must be < maxAge`).toBeLessThan(event.maxAge);
    }
  });

  it('all age values are non-negative integers', () => {
    for (const event of staticEvents) {
      expect(Number.isInteger(event.minAge)).toBe(true);
      expect(Number.isInteger(event.maxAge)).toBe(true);
      expect(event.minAge).toBeGreaterThanOrEqual(0);
      expect(event.maxAge).toBeGreaterThanOrEqual(0);
    }
  });

  it('every event has at least 1 choice', () => {
    for (const event of staticEvents) {
      expect(event.choices.length, `Event "${event.id}" has no choices`).toBeGreaterThan(0);
    }
  });

  it('every choice has text and effects fields', () => {
    for (const event of staticEvents) {
      for (const choice of event.choices) {
        for (const field of CHOICE_FIELDS) {
          expect(choice, `Choice in "${event.id}" missing: ${field}`).toHaveProperty(field);
        }
      }
    }
  });

  it('effect values are numbers (not strings)', () => {
    for (const event of staticEvents) {
      for (const choice of event.choices) {
        for (const [key, val] of Object.entries(choice.effects)) {
          if (key === 'flags') continue;
          expect(typeof val, `${event.id} → choice "${choice.text}" → effect "${key}" is not a number`).toBe('number');
        }
      }
    }
  });

  it('all effect keys are recognized stat/flag keys', () => {
    for (const event of staticEvents) {
      for (const choice of event.choices) {
        for (const key of Object.keys(choice.effects)) {
          expect(VALID_EFFECT_KEYS.has(key), `Unknown effect key "${key}" in event "${event.id}"`).toBe(true);
        }
      }
    }
  });

  it('numeric effect values are within reasonable game range', () => {
    for (const event of staticEvents) {
      for (const choice of event.choices) {
        for (const [key, val] of Object.entries(choice.effects)) {
          if (key === 'flags') continue;
          // bank effects can be large (life savings, jackpots, etc.)
          const limit = key === 'bank' ? 100_000 : 100;
          expect(Math.abs(val), `Effect "${key}" in "${event.id}" seems extreme`).toBeLessThanOrEqual(limit);
        }
      }
    }
  });

  it('events cover a range of age groups', () => {
    const hasEarlyEvent = staticEvents.some(e => e.minAge <= 5);
    const hasAdultEvent = staticEvents.some(e => e.minAge >= 18 && e.minAge <= 50);
    const hasSeniorEvent = staticEvents.some(e => e.minAge >= 60);
    expect(hasEarlyEvent).toBe(true);
    expect(hasAdultEvent).toBe(true);
    expect(hasSeniorEvent).toBe(true);
  });

  it('event descriptions are non-empty strings', () => {
    for (const event of staticEvents) {
      expect(typeof event.description).toBe('string');
      expect(event.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('choice text is a non-empty string', () => {
    for (const event of staticEvents) {
      for (const choice of event.choices) {
        expect(typeof choice.text).toBe('string');
        expect(choice.text.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── 3. careers.json schema validation ───────────────────────────────────────

describe('careers.json', () => {
  const REQUIRED_FIELDS = [
    'id', 'title', 'salary', 'happinessEffect', 'healthEffect', 'minAge', 'type',
    'sector', 'tier', 'tierGroupId', 'nextTierId', 'requiresDegree',
    'requiresNetworking', 'statRequirements', 'smarts_gain', 'networking_gain',
  ];
  const VALID_TYPES   = new Set(['part_time', 'full_time']);
  const VALID_SECTORS = new Set(['service', 'tech', 'trades', 'healthcare', 'education', 'finance', 'law', 'law_enforcement', 'military', 'government', 'creative', 'fitness']);
  const VALID_DEGREES = new Set([null, 'highSchool', 'associate', 'bachelor', 'master', 'phd']);

  it('is a non-empty array', () => {
    expect(Array.isArray(staticCareers)).toBe(true);
    expect(staticCareers.length).toBeGreaterThan(0);
  });

  it('every career has all required fields', () => {
    for (const career of staticCareers) {
      for (const field of REQUIRED_FIELDS) {
        expect(career, `Career "${career.id}" missing field: ${field}`).toHaveProperty(field);
      }
    }
  });

  it('no duplicate career IDs', () => {
    const ids = staticCareers.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('no duplicate career titles', () => {
    const titles = staticCareers.map(c => c.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('all salaries are positive integers', () => {
    for (const career of staticCareers) {
      expect(Number.isInteger(career.salary), `${career.id}: salary must be integer`).toBe(true);
      expect(career.salary, `${career.id}: salary must be positive`).toBeGreaterThan(0);
    }
  });

  it('happinessEffect and healthEffect are integers', () => {
    for (const career of staticCareers) {
      expect(Number.isInteger(career.happinessEffect), `${career.id}: happinessEffect must be integer`).toBe(true);
      expect(Number.isInteger(career.healthEffect), `${career.id}: healthEffect must be integer`).toBe(true);
    }
  });

  it('effects are within reasonable range (-50 to +50)', () => {
    for (const career of staticCareers) {
      expect(Math.abs(career.happinessEffect)).toBeLessThanOrEqual(50);
      expect(Math.abs(career.healthEffect)).toBeLessThanOrEqual(50);
    }
  });

  it('minAge is a non-negative integer', () => {
    for (const career of staticCareers) {
      expect(Number.isInteger(career.minAge)).toBe(true);
      expect(career.minAge).toBeGreaterThanOrEqual(0);
    }
  });

  it('type is a known value', () => {
    for (const career of staticCareers) {
      expect(VALID_TYPES.has(career.type), `Unknown type "${career.type}" in career "${career.id}"`).toBe(true);
    }
  });

  it('part_time jobs have lower salary than full_time jobs on average', () => {
    const partTime = staticCareers.filter(c => c.type === 'part_time');
    const fullTime = staticCareers.filter(c => c.type === 'full_time');
    const avgPT = partTime.reduce((s, c) => s + c.salary, 0) / partTime.length;
    const avgFT = fullTime.reduce((s, c) => s + c.salary, 0) / fullTime.length;
    expect(avgPT).toBeLessThan(avgFT);
  });

  it('careers are sorted such that higher minAge generally means higher salary', () => {
    // Not a strict requirement, but senior careers should pay more than entry level
    const entryLevel = staticCareers.filter(c => c.minAge <= 18);
    const senior = staticCareers.filter(c => c.minAge >= 26);
    const maxEntry = Math.max(...entryLevel.map(c => c.salary));
    const minSenior = Math.min(...senior.map(c => c.salary));
    expect(minSenior).toBeGreaterThan(maxEntry);
  });

  it('title is a non-empty string', () => {
    for (const career of staticCareers) {
      expect(typeof career.title).toBe('string');
      expect(career.title.trim().length).toBeGreaterThan(0);
    }
  });

  it('sector is a known value', () => {
    for (const career of staticCareers) {
      expect(VALID_SECTORS.has(career.sector), `Unknown sector "${career.sector}" in "${career.id}"`).toBe(true);
    }
  });

  it('tier is an integer between 1 and 5', () => {
    for (const career of staticCareers) {
      expect(Number.isInteger(career.tier), `${career.id}: tier must be integer`).toBe(true);
      expect(career.tier).toBeGreaterThanOrEqual(1);
      expect(career.tier).toBeLessThanOrEqual(5);
    }
  });

  it('requiresDegree is a known value or null', () => {
    for (const career of staticCareers) {
      expect(VALID_DEGREES.has(career.requiresDegree), `Unknown requiresDegree "${career.requiresDegree}" in "${career.id}"`).toBe(true);
    }
  });

  it('statRequirements is an object', () => {
    for (const career of staticCareers) {
      expect(typeof career.statRequirements).toBe('object');
      expect(career.statRequirements).not.toBeNull();
    }
  });

  it('smarts_gain and networking_gain are non-negative integers', () => {
    for (const career of staticCareers) {
      expect(Number.isInteger(career.smarts_gain), `${career.id}: smarts_gain must be integer`).toBe(true);
      expect(Number.isInteger(career.networking_gain), `${career.id}: networking_gain must be integer`).toBe(true);
      expect(career.smarts_gain).toBeGreaterThanOrEqual(0);
      expect(career.networking_gain).toBeGreaterThanOrEqual(0);
    }
  });

  it('nextTierId references a real career id or is null', () => {
    const ids = new Set(staticCareers.map(c => c.id));
    for (const career of staticCareers) {
      if (career.nextTierId !== null) {
        expect(ids.has(career.nextTierId), `${career.id}: nextTierId "${career.nextTierId}" not found`).toBe(true);
      }
    }
  });

  it('tier 5 careers have no nextTierId (apex)', () => {
    for (const career of staticCareers) {
      if (career.tier === 5) {
        expect(career.nextTierId, `${career.id}: tier 5 should not have nextTierId`).toBeNull();
      }
    }
  });

  it('tierGroupId entries form valid chains — each non-apex member points to a real career', () => {
    const idSet = new Set(staticCareers.map(c => c.id));
    const byGroup = {};
    for (const c of staticCareers) {
      if (c.tierGroupId) {
        if (!byGroup[c.tierGroupId]) byGroup[c.tierGroupId] = [];
        byGroup[c.tierGroupId].push(c);
      }
    }
    for (const [group, members] of Object.entries(byGroup)) {
      // Every non-apex member (nextTierId !== null) must point to an existing career
      for (const m of members) {
        if (m.nextTierId !== null) {
          expect(idSet.has(m.nextTierId), `${group}/${m.id}: nextTierId "${m.nextTierId}" not found`).toBe(true);
        }
      }
      // Within the group, tiers should be strictly ascending (no duplicate tiers in one group)
      const tiers = members.map(m => m.tier).sort((a, b) => a - b);
      const uniqueTiers = new Set(tiers);
      expect(uniqueTiers.size, `${group}: duplicate tier numbers within group`).toBe(tiers.length);
    }
  });

  it('has at least 25 total careers', () => {
    expect(staticCareers.length).toBeGreaterThanOrEqual(25);
  });
});
