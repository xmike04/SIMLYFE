import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPromptMessages,
  ContractValidationError,
  DEFAULT_GLOBAL_DAILY_LIMIT,
  getAgeEventGuidance,
  normalizeProviderUsage,
  OPENAI_EVENT_RESPONSE_FORMAT,
  parseAllowedOrigins,
  parseGenerateEventRequest,
  parseGlobalDailyLimit,
  parseProviderEvent,
  parseRateLimitResult,
} from "./contract.ts";

const edgeSource = readFileSync(
  `${process.cwd()}/supabase/functions/generate-event/index.ts`,
  "utf8",
);

function validBody() {
  return {
    state: {
      character: { name: "Alex", gender: "nonbinary", country: "US" },
      age: 25,
      stats: {
        health: 80, happiness: 70, smarts: 75, looks: 60, athleticism: 50,
        karma: 40, acting: 10, voice: 20, modeling: 30, grades: 80,
      },
      bank: 5000,
      career: { id: null, title: "Analyst" },
      recentHistory: [{ age: 24, text: "Started a new job." }],
      relationships: [{
        id: null, name: "Sam", type: "Friend", age: 26, relation: 75,
        status: null, isAlive: true,
      }],
      pets: [{ id: null, name: "Mochi", type: null, age: 3, isAlive: true }],
      city: "Chicago",
      education: {
        highSchool: true, associate: false, bachelor: true, master: false,
        phd: false, currentDegree: null,
      },
      economyPhase: "normal",
    },
  };
}

describe("generate-event edge contract", () => {
  it("accepts the compact projection and supplies optional defaults", () => {
    const parsed = parseGenerateEventRequest(validBody());
    expect(parsed.actionContext).toBeNull();
    expect(parsed.narrativeMode).toBe(false);
    expect(parsed.state.recentHistory).toHaveLength(1);
  });

  it("rejects caller-controlled OpenAI parameters", () => {
    expect(() => parseGenerateEventRequest({ ...validBody(), model: "gpt-anything" }))
      .toThrow(ContractValidationError);
    expect(() => parseGenerateEventRequest({ ...validBody(), messages: [] }))
      .toThrow(/not allowed/);
  });

  it("bounds body streaming and the complete edge operation with deadlines", () => {
    expect(edgeSource).toContain("const REQUEST_TIMEOUT_MS = 15_000");
    expect(edgeSource).toContain("const BODY_READ_TIMEOUT_MS = 2_000");
    expect(edgeSource).toContain("readJsonBody(request, bodySignal)");
    expect(edgeSource).toContain("consumeRateLimit(rateKey, projectDailyLimit, operationSignal)");
    expect(edgeSource).toContain("generateEvent(parsedRequest, model, operationSignal)");
    expect(edgeSource).toContain('signal.addEventListener("abort", cancelReader, { once: true })');
  });

  it("bounds projection arrays", () => {
    const body = validBody();
    body.state.recentHistory = Array.from({ length: 6 }, (_, age) => ({ age, text: "event" }));
    expect(() => parseGenerateEventRequest(body)).toThrow(/at most 5/);
  });

  it("builds server-owned instructions and JSON data messages", () => {
    const messages = buildPromptMessages(parseGenerateEventRequest(validBody()));
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("untrusted data");
    expect(JSON.parse(messages[1].content).GAME_STATE_JSON.character.name).toBe("Alex");
  });

  it.each([
    [0, "INFANCY"],
    [2, "INFANCY"],
    [3, "EARLY CHILDHOOD"],
    [5, "EARLY CHILDHOOD"],
    [6, "SCHOOL AGE"],
    [12, "SCHOOL AGE"],
    [13, "TEEN YEARS"],
    [17, "TEEN YEARS"],
    [18, "ADULTHOOD"],
  ])("maps age %i to the %s pacing band", (age, band) => {
    expect(getAgeEventGuidance(age)).toContain(band);
  });

  it("keeps infancy mild and requires engaging post-infancy choices", () => {
    const infantBody = validBody();
    infantBody.state.age = 2;
    const infantPrompt = buildPromptMessages(parseGenerateEventRequest(infantBody))[0].content;
    expect(infantPrompt).toContain("LIFE STAGE: INFANCY");
    expect(infantPrompt).toContain("Keep consequences mild");
    expect(infantPrompt).toContain("parents separating");

    const childBody = validBody();
    childBody.state.age = 4;
    const childPrompt = buildPromptMessages(parseGenerateEventRequest(childBody))[0].content;
    expect(childPrompt).toContain("LIFE STAGE: EARLY CHILDHOOD");
    expect(childPrompt).toContain("two or three concise, materially different choices");
    expect(childPrompt).toContain("tension, surprise, opportunity, discovery, or relationship change");
    expect(childPrompt).toContain("Do not repeat or lightly reword recent history");
  });

  it("normalizes strict provider effects into the browser envelope", () => {
    const event = parseProviderEvent({
      description: "A promotion lands in your inbox.",
      choices: [{
        text: "Accept",
        numericEffects: [{ key: "bank", value: 5000 }, { key: "happiness", value: 10 }],
        flags: ["promoted"],
      }],
    });
    expect(event.choices[0].effects).toEqual({ bank: 5000, happiness: 10, flags: ["promoted"] });
  });

  it("enforces the 35-word narrative limit after provider validation", () => {
    const description = Array.from({ length: 36 }, () => "word").join(" ");
    expect(() => parseProviderEvent({
      description,
      choices: [{ text: "Continue", numericEffects: [], flags: [] }],
    })).toThrow(/too long/);
  });

  it("requires exact non-wildcard HTTP origins", () => {
    expect(parseAllowedOrigins("https://simlyfe.example,http://localhost:5173").size).toBe(2);
    expect(() => parseAllowedOrigins("*")).toThrow(/Wildcard/);
    expect(() => parseAllowedOrigins("https://simlyfe.example/path")).toThrow(/exact HTTP origins/);
  });

  it("uses strict JSON Schema Structured Outputs", () => {
    expect(OPENAI_EVENT_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(OPENAI_EVENT_RESPONSE_FORMAT.json_schema.strict).toBe(true);
    expect(OPENAI_EVENT_RESPONSE_FORMAT.json_schema.schema.additionalProperties).toBe(false);
  });

  it("normalizes cached input token usage without retaining provider details", () => {
    expect(normalizeProviderUsage({
      prompt_tokens: 500,
      completion_tokens: 80,
      total_tokens: 580,
      prompt_tokens_details: { cached_tokens: 320, other_provider_field: "discard" },
    })).toEqual({
      inputTokens: 500,
      outputTokens: 80,
      totalTokens: 580,
      cachedInputTokens: 320,
    });
  });

  it("requires and bounds both user and project quota fields", () => {
    expect(parseRateLimitResult({
      allowed: true,
      remaining_burst: 1,
      remaining_day: 99,
      remaining_project_day: 9_999,
      retry_after_seconds: 0,
    })).toEqual({
      allowed: true,
      remaining_burst: 1,
      remaining_day: 99,
      remaining_project_day: 9_999,
      retry_after_seconds: 0,
    });
    expect(() => parseRateLimitResult({
      allowed: false,
      remaining_burst: 0,
      remaining_day: 0,
      retry_after_seconds: 60,
    })).toThrow(/remaining_project_day is required/);
    expect(() => parseRateLimitResult({
      allowed: false,
      remaining_burst: 0,
      remaining_day: 0,
      remaining_project_day: 100_001,
      retry_after_seconds: 60,
    })).toThrow(/between 0 and 100000/);
  });

  it("defaults and bounds the configurable project-wide daily limit", () => {
    expect(parseGlobalDailyLimit(undefined)).toBe(DEFAULT_GLOBAL_DAILY_LIMIT);
    expect(parseGlobalDailyLimit("10000")).toBe(10_000);
    expect(() => parseGlobalDailyLimit("99")).toThrow(/between 100 and 100000/);
    expect(() => parseGlobalDailyLimit("unlimited")).toThrow(/must be an integer/);
  });
});
