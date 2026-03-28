/**
 * llmService.test.js
 *
 * Tests for the LLM event generation service and the static JSON data files
 * it falls back to. Covers:
 *   1. generateDynamicEvent — API flow, prompt construction, JSON parsing
 *   2. Static events.json — schema validation, no duplicates, sane values
 *   3. Static careers.json — schema validation, no duplicates, sane values
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import staticEvents from '../engine/events.json';
import staticCareers from '../engine/careers.json';

// Tell Vitest not to auto-mock llmService for this file
vi.unmock('../engine/llmService');

// ─── Helper state fixture ─────────────────────────────────────────────────────

const makeState = (overrides = {}) => ({
  character: { name: 'Test User', gender: 'Male', country: 'USA' },
  age: 25,
  stats: {
    health: 80, happiness: 70, smarts: 60, looks: 55,
    athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0,
  },
  bank: 5000,
  career: { title: 'Software Engineer' },
  history: [
    { age: 24, text: 'You worked hard.' },
    { age: 23, text: 'You went on a vacation.' },
  ],
  ...overrides,
});

// ─── Helpers: load llmService with specific env vars ─────────────────────────
// Module-level consts (apiKey, supabaseUrl) require reset + re-import to change.

async function loadService(apiKey = '') {
  vi.resetModules();
  vi.stubEnv('VITE_OPENAI_API_KEY', apiKey);
  vi.stubEnv('VITE_SUPABASE_URL', '');         // ensure direct path
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  const mod = await import('../engine/llmService');
  return mod.generateDynamicEvent;
}

async function loadServiceProxy(supabaseUrl = 'https://test.supabase.co', anonKey = 'anon-key') {
  vi.resetModules();
  vi.stubEnv('VITE_OPENAI_API_KEY', '');
  vi.stubEnv('VITE_SUPABASE_URL', supabaseUrl);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey);
  const mod = await import('../engine/llmService');
  return mod.generateDynamicEvent;
}

// ─── 1. generateDynamicEvent — unit tests via fetch mock ─────────────────────

describe('generateDynamicEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns null when API key is missing', async () => {
    const generateDynamicEvent = await loadService(''); // empty key
    const result = await generateDynamicEvent(makeState());
    expect(result).toBeNull();
  });

  it('parses a valid JSON response correctly', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    const mockEvent = {
      description: 'You stumble across a hidden opportunity.',
      choices: [
        { text: 'Take it', effects: { bank: 200 } },
        { text: 'Ignore it', effects: {} },
      ],
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(mockEvent) } }] }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toBe(mockEvent.description);
    expect(result.choices).toHaveLength(2);
    expect(result.choices[0].effects.bank).toBe(200);
  });

  it('strips markdown code fences before JSON parse', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    const mockEvent = { description: 'A wrapped event.', choices: [{ text: 'OK', effects: {} }] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n' + JSON.stringify(mockEvent) + '\n```' } }],
      }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toBe('A wrapped event.');
  });

  it('returns error event object on API error status', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result).not.toBeNull();
    expect(result.description).toMatch(/LLM ERROR/i);
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0].text).toBe('Understood');
  });

  it('returns error event object on network failure', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toMatch(/LLM ERROR/i);
  });

  it('returns error event on malformed JSON from API', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not valid json at all {{{' } }] }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toMatch(/LLM ERROR/i);
  });

  it('returns error event when response schema is invalid', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    const invalidEvent = { description: '', choices: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(invalidEvent) } }] }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toMatch(/LLM ERROR/i);
  });

  it('includes actionContext in prompt when provided', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    let capturedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    await generateDynamicEvent(makeState(), 'Went to the gym');
    expect(capturedBody.messages[0].content).toContain('Went to the gym');
  });

  it('uses gpt-4o-mini model', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    let capturedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    await generateDynamicEvent(makeState());
    expect(capturedBody.model).toBe('gpt-4o-mini');
  });

  it('includes character stats in prompt', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    let capturedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    await generateDynamicEvent(makeState({ age: 42 }));
    const prompt = capturedBody.messages[0].content;
    expect(prompt).toContain('42');
    expect(prompt).toContain('Test User');
  });

  it('only sends last 5 history entries in prompt', async () => {
    const generateDynamicEvent = await loadService('sk-test');
    let capturedBody = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    const longHistory = Array.from({ length: 10 }, (_, i) => ({ age: i, text: `Entry ${i}` }));
    await generateDynamicEvent(makeState({ history: longHistory }));
    const prompt = capturedBody.messages[0].content;
    expect(prompt).toContain('Entry 9');
    expect(prompt).not.toContain('Entry 0');
  });
});

// ─── 1b. Proxy path tests ─────────────────────────────────────────────────────

describe('generateDynamicEvent — proxy path', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns null when neither direct key nor Supabase vars are set', async () => {
    const generateDynamicEvent = await loadServiceProxy('', '');
    const result = await generateDynamicEvent(makeState());
    expect(result).toBeNull();
  });

  it('calls Supabase edge function URL (not openai.com) when proxy is configured', async () => {
    const generateDynamicEvent = await loadServiceProxy('https://myproject.supabase.co', 'test-anon');
    let capturedUrl = null;
    global.fetch = vi.fn().mockImplementation((url) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    await generateDynamicEvent(makeState());
    expect(capturedUrl).toContain('supabase.co');
    expect(capturedUrl).toContain('generate-event');
    expect(capturedUrl).not.toContain('openai.com');
  });

  it('sends Authorization header with anon key when using proxy', async () => {
    const generateDynamicEvent = await loadServiceProxy('https://myproject.supabase.co', 'my-anon-key');
    let capturedHeaders = null;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      capturedHeaders = opts.headers;
      return Promise.resolve({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({ description: 'x', choices: [{ text: 'Ok', effects: {} }] }) } }] }),
      });
    });
    await generateDynamicEvent(makeState());
    expect(capturedHeaders['Authorization']).toContain('my-anon-key');
  });

  it('returns error event when proxy returns non-ok status', async () => {
    const generateDynamicEvent = await loadServiceProxy('https://myproject.supabase.co', 'test-anon');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    });
    const result = await generateDynamicEvent(makeState());
    expect(result.description).toMatch(/LLM ERROR/i);
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
