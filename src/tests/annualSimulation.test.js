import { describe, expect, it, vi } from 'vitest';
import { advanceLifeYear } from '../engine/annual/advanceLifeYear';
import { advanceBelongingsYear } from '../engine/annual/belongings';
import { advanceRelationshipsYear } from '../engine/annual/relationships';
import { buildLifeSave } from '../engine/lifeSave';

function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}
const holding = fields => ({ type: 'investment', yearsOwned: 0, currentValue: 1000, purchasePrice: 1000, ...fields });
const life = fields => ({ ...buildLifeSave({ character: { name: 'Fixture', gender: 'Female', country: 'US' }, ...fields }), activitiesThisYear: {} });
const rolls = (...values) => vi.fn(() => {
  if (!values.length) throw new Error('Unexpected extra random draw');
  return values.shift();
});

describe('annual simulation boundary', () => {
  it('does not mutate frozen life data, even across catalog returns and family changes', () => {
    const input = freezeTree(life({
      age: 17,
      belongings: [holding({ subType: 'fund', returnProfile: { base: .1, boomBonus: .2, recessionPenalty: -.3, volatility: .1 } })],
      relationships: [{ id: 'partner', name: 'Partner', age: 20, isAlive: true, type: 'Lover', status: 'dating', relation: 20 }],
      pets: [{ id: 'dog', speciesId: 'dog', name: 'Pup', age: 3, isAlive: true }],
    }));
    const initial = structuredClone(input);
    const output = advanceLifeYear(input, { randomFn: () => .5 });
    expect(input).toEqual(initial);
    expect(output.state).toMatchObject({ age: 18, education: { highSchool: true } });
    expect(output.state.relationships[0]).toMatchObject({ status: 'ex', type: 'Ex', age: 21 });
    expect(output.state.belongings[0].currentValue).toBe(1100);
    expect(output.history.some(entry => entry.text.includes('High School Diploma'))).toBe(true);
  });

  it('routes every random draw through the supplied dependency, including return profiles', () => {
    const input = life({
      career: { id: 'founder', equity: 500, salary: 0 },
      belongings: [holding({ subType: 'fund', returnProfile: { base: .1, volatility: .1 } })],
      properties: [holding({ returnProfile: { base: .1, volatility: .1 } })],
      pets: [{ speciesId: 'dog', age: 0, isAlive: true }],
      relationships: [{ id: 'parent', age: 75, status: 'family', isAlive: true, relation: 70 }],
    });
    const globalRandom = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Global RNG used'); });
    const randomFn = vi.fn(() => .5);
    try {
      const output = advanceLifeYear(input, { randomFn });
      expect(output.state.career.equity).toBe(750);
      expect(output.state.belongings[0].currentValue).toBe(1100);
      expect(randomFn).toHaveBeenCalledTimes(8); // founder, market×2, property, fund, pet, elder, illness
      expect(globalRandom).not.toHaveBeenCalled();
    } finally { globalRandom.mockRestore(); }
  });

  it('skips the market boom draw on a crash and leaves the next draw for the pet', () => {
    const input = life({
      properties: [{ type: 'realEstate', currentValue: 1000, yearsOwned: 0 }],
      pets: [{ id: 'pet', speciesId: 'dog', name: 'Pup', age: 0, isAlive: true }],
    });
    const randomFn = rolls(.01, .8);
    const output = advanceLifeYear(input, { randomFn });
    expect(output.state.properties[0].currentValue).toBe(700);
    expect(output.state.pets[0].isAlive).toBe(true);
    expect(randomFn).toHaveBeenCalledTimes(2);
  });

  it('keeps crypto crash, moonshot, multiplier draws in order before the following stock', () => {
    const randomFn = rolls(.8, .01, .5, .5);
    const output = advanceBelongingsYear([
      holding({ subType: 'crypto', volatility: 1.8 }),
      holding({ subType: 'stock', baseReturn: .08 }),
    ], {}, { randomFn });
    expect(output.belongings.map(item => item.currentValue)).toEqual([525000, 1080]);
    expect(randomFn).toHaveBeenCalledTimes(4);
  });

  it('retains the existing double trend adjustment for boom crypto years', () => {
    const output = advanceBelongingsYear([holding({ subType: 'crypto', volatility: .6, trendiness: 1 })], {}, {
      phase: 'boom', randomFn: rolls(.8, .8, .5),
    });
    expect(output.belongings[0].currentValue).toBe(1500);
  });

  it('returns bond principal once, keeps the final coupon, and leaves fund gains on paper', () => {
    const input = life({ belongings: [
      holding({ name: 'Bond', subType: 'bonds', yearsToMaturity: 1, couponRate: .04 }),
      holding({ subType: 'fund', returnProfile: { base: .1, volatility: 0 } }),
    ] });
    const first = advanceLifeYear(input, { randomFn: () => .5 });
    expect(first.state.bank).toBe(1040);
    expect(first.state.belongings).toHaveLength(1);
    expect(first.state.belongings[0].currentValue).toBe(1100);
    expect(first.history[0].text).toContain('principal of $1,000 returned. | Investments:');
    const second = advanceLifeYear({ ...input, ...first.state }, { randomFn: () => .5 });
    expect(second.state.bank).toBe(1040);
    expect(second.state.belongings[0].currentValue).toBe(1210);
  });

  it('preserves legacy property investment cash accounting while modern funds remain cash neutral', () => {
    const asset = holding({ returnProfile: { base: .1, volatility: 0 } });
    const output = advanceLifeYear(life({ properties: [asset], belongings: [{ ...asset, subType: 'fund' }] }), { randomFn: () => .5 });
    expect(output.state.bank).toBe(100);
    expect(output.state.properties[0].currentValue).toBe(1100);
    expect(output.state.belongings[0].currentValue).toBe(1100);
  });

  it('retains annual history order across education, income, maintenance, and family costs', () => {
    const output = advanceLifeYear(life({
      age: 17, bank: 50000,
      career: { id: 'fixture', salary: 30000 },
      properties: [{ type: 'realEstate', currentValue: 10000, yearsOwned: 0, upkeep: 100 }],
      relationships: [{ id: 'ex', status: 'ex', isAlive: true, age: 18, childSupport: 2400 }],
      pets: [{ speciesId: 'dog', name: 'Pup', age: 0, isAlive: true }],
    }), { randomFn: () => .5 });
    expect(output.history.map(entry => entry.text.split(':')[0])).toEqual([
      'Business', 'Lifestyle', 'Education', 'Career', 'Economy', 'Family', 'Pets',
    ]);
    expect(output.history.every(entry => entry.age === 18)).toBe(true);
  });

  it('ages before applying adult-child milestones, then gives that child its first job at 22', () => {
    const child = { id: 'child', type: 'Child', name: 'Child', age: 17, status: 'family', relation: 80, isAlive: true };
    const adult = advanceRelationshipsYear([child], { happiness: 80 }, { randomFn: () => .99 });
    expect(adult.relationships[0]).toMatchObject({ age: 18, status: 'family_adult' });
    const employed = advanceRelationshipsYear([{ ...adult.relationships[0], age: 21 }], { happiness: 80 }, { randomFn: rolls(.99, .0) });
    expect(employed.relationships[0]).toMatchObject({ age: 22, npcJob: 'barista' });
  });
});
