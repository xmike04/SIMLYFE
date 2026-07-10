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
  };
}

describe('validateHydratedSave', () => {
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
});
