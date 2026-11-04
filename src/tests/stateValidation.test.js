import { describe, expect, it } from 'vitest';
import { validateHydratedSave } from '../engine/stateValidation';

function makeValidSave() {
  return {
    character: { name: 'Test Character', gender: 'Female', country: 'USA', city: null },
    age: 24,
    stats: {
      health: 80,
      happiness: 75,
      smarts: 60,
      looks: 55,
      grades: 70,
      athleticism: 50,
      karma: 50,
      acting: 0,
      voice: 0,
      modeling: 0,
    },
    bank: 1200,
    history: [{ age: 24, text: 'A private event.' }],
    isDead: false,
    flags: [],
    career: null,
    relationships: [{
      id: 'rel-1',
      type: 'Friend',
      name: 'Private NPC',
      age: 25,
      relation: 70,
      status: 'friend',
      isAlive: true,
    }],
    belongings: [],
    properties: [],
    education: {
      highSchool: true,
      associate: false,
      bachelor: false,
      master: false,
      phd: false,
      currentDegree: null,
    },
    careerMeta: {
      yearsInRole: 0,
      isOnPIP: false,
      financialStressFlag: false,
      unemploymentYearsLeft: 0,
    },
    networking: 10,
    economyCycle: { year: 2, phase: 'normal', yearsInPhase: 2 },
    pets: [],
    will: { allocations: [{ id: 'rel-1', pct: 40 }], draftedAtAge: 24 },
  };
}

describe('validateHydratedSave', () => {
  it('observes malformed continuity fields with bounded paths and codes without normalization', () => {
    const save = makeValidSave();
    save.flags = ['valid', 'Private flag', 'valid'];
    save.activitiesThisYear = { 'private-player-tracker': '2' };
    save.currentEvent = { description: 'Private event', choices: [{ text: 'Private label', effects: { privateEffect: 1 } }] };
    const before = structuredClone(save);
    Object.freeze(save.flags);
    Object.freeze(save.activitiesThisYear);
    Object.freeze(save.currentEvent);
    Object.freeze(save);
    const result = validateHydratedSave(save);
    expect(result.warnings).toEqual([
      { code: 'invalid_value', field: 'flags' },
      { code: 'invalid_value', field: 'activitiesThisYear' },
      { code: 'invalid_value', field: 'currentEvent' },
    ]);
    expect(result.warningFields).toEqual(['activitiesThisYear', 'currentEvent', 'flags']);
    expect(JSON.stringify(result)).not.toMatch(/Private|private/);
    expect(save).toEqual(before);
  });

  it('accepts missing/null continuity defaults, legacy raw choices, and new versioned choices', () => {
    const save = makeValidSave();
    const event = { description: 'An opportunity.', choices: [{ text: 'Consider it', effects: { bank: 250 } }] };
    for (const currentEvent of [undefined, null, event, { ...event, version: 1, id: 'annual-24', age: 24, source: 'annual' }]) {
      expect(validateHydratedSave({ ...save, flags: null, activitiesThisYear: null, currentEvent }).hasWarnings).toBe(false);
    }
    expect(validateHydratedSave({ ...save, flags: ['a', 'b', 'c', 'd', 'e'], activitiesThisYear: { 'vacation__Staycation': 1 } }).hasWarnings).toBe(false);
  });

  it('warns about malformed metadata without exposing it or discarding the supplied event', () => {
    const save = makeValidSave();
    save.currentEvent = { description: 'An opportunity.', choices: [{ text: 'Consider it', effects: {} }], meta: { prompt: 'private prompt' } };
    const before = structuredClone(save);
    expect(validateHydratedSave(save).warnings).toEqual([{ code: 'invalid_metadata', field: 'currentEvent' }]);
    expect(save).toEqual(before);
  });

  it('accepts the current save shape without exposing field values', () => {
    const result = validateHydratedSave(makeValidSave());
    expect(result).toEqual({
      hasWarnings: false,
      warnings: [],
      warningFields: [],
      truncated: false,
    });
  });

  it('reports malformed fields without changing the save', () => {
    const save = makeValidSave();
    save.age = '24';
    save.stats.health = 120;
    save.history = [{ age: '24', text: 42 }];
    save.relationships = [{
      id: 'dating-1',
      type: 'Lover',
      name: 'Secret NPC Name',
      age: 25,
      relation: 60,
    }];
    save.secretKeyNamedAfterPlayer = 'private value';
    const before = structuredClone(save);

    const result = validateHydratedSave(save);

    expect(save).toEqual(before);
    expect(result.hasWarnings).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      { code: 'invalid_type', field: 'age' },
      { code: 'out_of_range', field: 'stats.health' },
      { code: 'invalid_type', field: 'history[].age' },
      { code: 'invalid_type', field: 'history[].text' },
      { code: 'invalid_type', field: 'relationships[].status' },
      { code: 'invalid_type', field: 'relationships[].isAlive' },
      { code: 'unknown_field', field: 'unknown' },
    ]));
    expect(JSON.stringify(result)).not.toContain('Secret NPC Name');
    expect(JSON.stringify(result)).not.toContain('private value');
    expect(JSON.stringify(result)).not.toContain('secretKeyNamedAfterPlayer');
  });

  it('accepts a null will and reports malformed will shapes', () => {
    const nullWill = makeValidSave();
    nullWill.will = null;
    expect(validateHydratedSave(nullWill).hasWarnings).toBe(false);

    const save = makeValidSave();
    save.will = { allocations: [{ id: '', pct: 140 }, 'bad'], draftedAtAge: 'young' };
    const result = validateHydratedSave(save);
    expect(result.hasWarnings).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      { code: 'invalid_type', field: 'will.allocations[].id' },
      { code: 'out_of_range', field: 'will.allocations[].pct' },
      { code: 'invalid_item_type', field: 'will.allocations[]' },
      { code: 'invalid_type', field: 'will.draftedAtAge' },
    ]));
  });

  it('handles an invalid root and missing core fields in observe-only mode', () => {
    expect(validateHydratedSave(null)).toEqual({
      hasWarnings: true,
      warnings: [{ code: 'invalid_type', field: 'save' }],
      warningFields: ['save'],
      truncated: false,
    });

    const partial = { age: 1 };
    const result = validateHydratedSave(partial);
    expect(partial).toEqual({ age: 1 });
    expect(result.warningFields).toEqual(expect.arrayContaining([
      'bank', 'character', 'history', 'isDead', 'stats',
    ]));
  });
  it('warns about optional action metadata without changing legacy entries or exposing values', () => {
    const save = makeValidSave();
    const legacy = { age: 20, text: 'An existing memory' };
    save.history = [legacy];
    expect(validateHydratedSave(save).hasWarnings).toBe(false);
    save.history.push({ age: 24, text: 'Keep this.', action: { version: 999, id: 'Private command' } });
    const before = structuredClone(save);
    const result = validateHydratedSave(save);
    expect(result.warnings).toContainEqual({ code: 'invalid_value', field: 'history[].action' });
    expect(JSON.stringify(result)).not.toMatch(/Private command|Keep this/);
    expect(save).toEqual(before);
    expect(save.history[0]).toBe(legacy);
  });

  it('accepts a valid versioned action record alongside ordinary age/text entries', () => {
    const save = makeValidSave();
    save.history.push({ age: 24, text: 'Career: Selected Teacher.', action: { version: 1, id: 'career-test-1', type: 'career.choose', targetId: 'teacher', beforeCareerId: null, afterCareerId: 'teacher', beforeSalary: null, afterSalary: 50000, code: 'career_selected' } });
    const before = structuredClone(save);
    expect(validateHydratedSave(save).hasWarnings).toBe(false);
    expect(save).toEqual(before);
  });

});
