import { describe, it } from "vitest";
import assert from "node:assert/strict";
import * as contract from "./contract.ts";

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


describe("provider request compatibility", () => {
  it("leaves bounded reasoning headroom for a complete strict Nano event", () => {
    const request = contract.parseGenerateEventRequest(validBody());
    const body = contract.buildProviderRequest(request);
    assert.equal(body?.model, "gpt-5-nano");
    assert.equal(body?.reasoning_effort, "minimal");
    assert.equal(body?.max_completion_tokens, 1024);
    assert.equal(body?.response_format.json_schema.strict, true);
    assert.equal(body?.messages[0].role, "system");
    assert.equal(JSON.parse(body?.messages[1].content).GAME_STATE_JSON.age, 25);
    assert.equal(Object.hasOwn(body, "temperature"), false);
  });

  for (const model of ["gpt-5-nano", "gpt-5-nano-2025-08-07"]) {
    it(`omits unsupported sampling parameters for ${model}`, () => {
      const request = contract.parseGenerateEventRequest({ ...validBody(), narrativeMode: true });
      const body = contract.buildProviderRequest(request, model);
      assert.equal(body?.reasoning_effort, "minimal");
      assert.equal(body?.max_completion_tokens, 1024);
      assert.equal(Object.hasOwn(body, "temperature"), false);
      assert.equal(Object.hasOwn(body, "top_p"), false);
    });
  }

  it("preserves the existing parameters for an explicit legacy override", () => {
    const request = contract.parseGenerateEventRequest(validBody());
    const body = contract.buildProviderRequest(request, "gpt-4.1-mini");
    assert.equal(body?.model, "gpt-4.1-mini");
    assert.equal(body?.max_completion_tokens, 200);
    const narrative = contract.buildProviderRequest(
      contract.parseGenerateEventRequest({ ...validBody(), narrativeMode: true }), "gpt-4.1-mini",
    );
    assert.equal(narrative.max_completion_tokens, 400);
    assert.equal(body?.temperature, 0.8);
    assert.equal(Object.hasOwn(body, "reasoning_effort"), false);
  });

  it("sends a complete English action-label budget with headroom in both modes", () => {
    for (const narrativeMode of [false, true]) {
      const request = contract.parseGenerateEventRequest({ ...validBody(), narrativeMode });
      const body = contract.buildProviderRequest(request);
      const instructions = body.messages[0].content;
      assert.match(instructions, /Write the description and choice labels in English/);
      assert.match(instructions, /complete action label of 4-10 words/);
      assert.match(instructions, /Aim for at most 60 characters/);
      assert.match(instructions, /Never cut off a word or thought to fit the limit/);
      assert.match(instructions, /put consequences in numericEffects and flags/);
      const textSchema = body.response_format.json_schema.schema.properties.choices.items.properties.text;
      assert.equal(textSchema.maxLength, 80);
      assert.match(textSchema.description, /complete English action label/);
      assert.match(textSchema.description, /at most 60 characters/);
      // Names and history remain untrusted JSON data, not interpolated instructions.
      assert.equal(JSON.parse(body.messages[1].content).GAME_STATE_JSON.character.name, "Alex");
      assert.equal(body.max_completion_tokens, 1024);
    }
  });

  it("retains the deployed separate Android allowlist", () => {
    assert.deepEqual(
      [...(contract.parseClientOrigins("https://simlyfe.vercel.app", "https://localhost") ?? [])],
      ["https://simlyfe.vercel.app", "https://localhost"],
    );
  });

  it("requires exact native origins and a nonempty browser allowlist", () => {
    assert.throws(() => contract.parseClientOrigins("https://simlyfe.vercel.app", "*"), /Wildcard/);
    assert.throws(() => contract.parseClientOrigins("", "https://localhost"), /must not be empty/);
  });
});
