/** relationships annual mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { advanceRelationshipsYear } from '../../engine/annual/relationships';
import { advancePetsYear } from '../../engine/annual/pets';
import { calcDivorceCost as divorceCost } from './support/relationships.js';

function tickRelationships(relationships, options = {}) {
  return advanceRelationshipsYear(relationships, { happiness: 80 }, { randomFn: () => 0.999, ...options });
}

function tickRelationship(relationship, options = {}) {
  return tickRelationships([relationship], options).relationships[0];
}

// Legacy presentation/action mirrors below remain explicitly labeled migration targets.

function getMood(relation) {
  if (relation >= 75) return 'happy';
  if (relation >= 50) return 'neutral';
  if (relation >= 25) return 'upset';
  return 'hostile';
}

// Observe the production result while isolating breakup from this year's decay.
function shouldAutoBreakup(rel) {
  const next = tickRelationship(rel, { activitiesThisYear: { [`rel_interact__${rel.id}`]: 1 } });
  return rel.status !== 'ex' && next.status === 'ex';
}

// Measure the production score change; do not duplicate the status-based decay table.
function passiveRelationDecay(rel) {
  return rel.relation - tickRelationship(rel).relation;
}

function marriageEligibility(rel, playerAge) {
  if (rel.status !== 'dating') return { eligible: false, reason: 'Not currently dating' };
  if (playerAge < 18) return { eligible: false, reason: 'Must be 18+ to marry' };
  if (rel.relation < 80) return { eligible: false, reason: `Relation must be 80+ (currently ${rel.relation})` };
  return { eligible: true, reason: '' };
}

const makeRel = (overrides = {}) => ({
  id: 'rel_test',
  name: 'Alex',
  age: 30,
  relation: 60,
  status: 'dating',
  mood: 'neutral',
  isAlive: true,
  ...overrides,
});

describe('getMood (legacy mirror)', () => {
  it('relation 100 → happy', () => expect(getMood(100)).toBe('happy'));
  it('relation 75 → happy', ()  => expect(getMood(75)).toBe('happy'));
  it('relation 74 → neutral', () => expect(getMood(74)).toBe('neutral'));
  it('relation 50 → neutral', () => expect(getMood(50)).toBe('neutral'));
  it('relation 49 → upset', ()  => expect(getMood(49)).toBe('upset'));
  it('relation 25 → upset', ()  => expect(getMood(25)).toBe('upset'));
  it('relation 24 → hostile', () => expect(getMood(24)).toBe('hostile'));
  it('relation 0 → hostile', ()  => expect(getMood(0)).toBe('hostile'));
});

describe('shouldAutoBreakup', () => {
  it('dating + relation 19 → true', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'dating', relation: 19 }))).toBe(true);
  });

  it('married + relation 5 → true', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'married', relation: 5 }))).toBe(true);
  });

  it('dating + relation 20 → false (threshold is exclusive)', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'dating', relation: 20 }))).toBe(false);
  });

  it('family + relation 5 → false (family never auto-breaks)', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'family', relation: 5 }))).toBe(false);
  });

  it('friend + relation 0 → false', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'friend', relation: 0 }))).toBe(false);
  });

  it('ex + relation 0 → false', () => {
    expect(shouldAutoBreakup(makeRel({ status: 'ex', relation: 0 }))).toBe(false);
  });
});

describe('passiveRelationDecay', () => {
  it('family decays by 1 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'family' }))).toBe(1);
  });

  it('dating decays by 3 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'dating' }))).toBe(3);
  });

  it('married decays by 2 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'married' }))).toBe(2);
  });

  it('friend decays by 2 per year', () => {
    expect(passiveRelationDecay(makeRel({ status: 'friend' }))).toBe(2);
  });

  it('ex decays by 0 (no obligation)', () => {
    expect(passiveRelationDecay(makeRel({ status: 'ex' }))).toBe(0);
  });

  it('estranged decays by 0', () => {
    expect(passiveRelationDecay(makeRel({ status: 'estranged' }))).toBe(0);
  });
});

describe('elder death thresholds (production annual pass)', () => {
  const survives = (age, roll) => tickRelationship(makeRel({
    status: 'family', age: age - 1, npcJob: 'teacher', npcSpouse: true, npcSick: true,
  }), { randomFn: () => roll }).isAlive;

  it('age 69 has no death chance', () => expect(survives(69, 0)).toBe(true));
  it('age 70 has no death chance at the exclusive threshold', () => expect(survives(70, 0)).toBe(true));
  it('age 100 has a 50% threshold', () => {
    expect(survives(100, 0.49)).toBe(false);
    expect(survives(100, 0.5)).toBe(true);
  });
  it('age 130 guarantees death', () => expect(survives(130, 0.999)).toBe(false));
  it('the same roll becomes fatal as elders age', () => {
    expect(survives(80, 0.25)).toBe(true);
    expect(survives(90, 0.25)).toBe(false);
    expect(survives(90, 0.5)).toBe(true);
    expect(survives(110, 0.5)).toBe(false);
  });
});

describe('marriageEligibility (legacy mirror)', () => {
  it('valid: dating, relation 80+, age 18+ → eligible', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 85 }), 25);
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('');
  });

  it('blocked when not dating (status married)', () => {
    const result = marriageEligibility(makeRel({ status: 'married', relation: 90 }), 30);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/not currently dating/i);
  });

  it('blocked when not dating (status friend)', () => {
    const result = marriageEligibility(makeRel({ status: 'friend', relation: 95 }), 30);
    expect(result.eligible).toBe(false);
  });

  it('blocked when player under 18', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 90 }), 17);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/18/);
  });

  it('blocked when relation < 80', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 79 }), 25);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/80/);
  });

  it('exact edge: relation exactly 80 → eligible', () => {
    const result = marriageEligibility(makeRel({ status: 'dating', relation: 80 }), 18);
    expect(result.eligible).toBe(true);
  });
});

describe('divorceCost (legacy mirror)', () => {
  it('15% of bank, floored', () => {
    expect(divorceCost(100000)).toBe(15000);
  });

  it('minimum cost is $5,000', () => {
    expect(divorceCost(0)).toBe(5000);
    expect(divorceCost(10000)).toBe(5000); // 15% = 1500, floored to 5000
  });

  it('maximum cost is $50,000', () => {
    expect(divorceCost(1000000)).toBe(50000);
  });

  it('moderate bank: 15% applied', () => {
    expect(divorceCost(200000)).toBe(30000);
  });
});

describe('jealousy (production annual pass)', () => {
  it('does not penalize a player with no relationships', () => {
    expect(tickRelationships([]).stats.happiness).toBe(80);
  });
  it('does not penalize a player with only family', () => {
    const rels = [makeRel({ status: 'family' }), makeRel({ status: 'family', id: 'rel_2' })];
    expect(tickRelationships(rels).stats.happiness).toBe(80);
  });
  it('does not penalize a player with one lover', () => {
    expect(tickRelationships([makeRel({ status: 'dating' })]).stats.happiness).toBe(80);
  });
  it('two simultaneous lovers cause a five-point penalty', () => {
    const rels = [makeRel({ id: 'rel_1' }), makeRel({ id: 'rel_2' })];
    const year = tickRelationships(rels);
    expect(year.stats.happiness).toBe(75);
    expect(year.events).toEqual(expect.arrayContaining([expect.stringContaining('2 simultaneous partners')]));
  });
  it('counts a married partner alongside a dating partner', () => {
    const rels = [makeRel({ id: 'rel_1', status: 'married' }), makeRel({ id: 'rel_2' })];
    expect(tickRelationships(rels).stats.happiness).toBe(75);
  });
  it('ex and estranged partners do not trigger jealousy', () => {
    const rels = [makeRel({ id: 'rel_1', status: 'ex' }), makeRel({ id: 'rel_2', status: 'estranged' }), makeRel({ id: 'rel_3' })];
    expect(tickRelationships(rels).stats.happiness).toBe(80);
  });
});

describe('relationship decay and breakup integration (production annual pass)', () => {
  it('neglect takes dating relation 22 to 19 and breaks up in the same year', () => {
    const year = tickRelationships([makeRel({ relation: 22 })]);
    expect(year.relationships[0].relation).toBe(19);
    expect(year.relationships[0].status).toBe('ex');
    expect(year.events).toEqual(expect.arrayContaining([expect.stringContaining('You broke up')]));
  });
  it('a spouse with a recorded interaction avoids passive decay', () => {
    const rel = makeRel({ status: 'married', relation: 60 });
    const next = tickRelationship(rel, { activitiesThisYear: { rel_interact__rel_test: 1 } });
    expect(next.relation).toBe(60);
    expect(next.status).toBe('married');
  });
  it('two simultaneous lovers produce a jealousy event', () => {
    const rels = [makeRel({ id: 'rel_a', relation: 80 }), makeRel({ id: 'rel_b', relation: 75 })];
    expect(tickRelationships(rels).events).toEqual(expect.arrayContaining([expect.stringContaining('jealousy')]));
  });
  it('a parent reaching 85 dies below the 25% threshold', () => {
    const parent = makeRel({ status: 'family', type: 'Mother', age: 84 });
    expect(tickRelationship(parent, { randomFn: () => 0.249 }).isAlive).toBe(false);
    expect(tickRelationship(parent, { randomFn: () => 0.25 }).isAlive).toBe(true);
  });
  it('a strong marriage survives annual processing', () => {
    const next = tickRelationship(makeRel({ status: 'married', type: 'Spouse', relation: 90 }));
    expect(next.status).toBe('married');
    expect(next.type).toBe('Spouse');
    expect(next.relation).toBe(88);
  });
  it('an auto-divorce clears spouse status and type, then stops romantic decay', () => {
    const next = tickRelationship(makeRel({ status: 'married', type: 'Spouse', relation: 15 }));
    expect(next.status).toBe('ex');
    expect(next.type).toBe('Ex');
    expect(tickRelationship(next).relation).toBe(next.relation);
  });
});

describe('Pet lifecycle (production annual pass)', () => {
  const dogDef = { species: 'Dog', annualMaintenanceCost: 800, happinessBonus: 5, lifespanMin: 10, lifespanMax: 15 };
  const tickPet = (age, roll = 0.999) => advancePetsYear([
    { speciesId: 'dog', name: 'Rex', age, isAlive: true },
  ], { catalog: { dog: dogDef }, randomFn: () => roll });

  it('ages a living pet by one year', () => expect(tickPet(3).pets[0].age).toBe(4));
  it('has no death chance before the minimum lifespan', () => expect(tickPet(5, 0).pets[0].isAlive).toBe(true));
  it('guarantees death at the maximum lifespan', () => expect(tickPet(14).pets[0].isAlive).toBe(false));
  it('uses the partial death threshold between minimum and maximum lifespan', () => {
    expect(tickPet(11, 0.119).pets[0].isAlive).toBe(false);
    expect(tickPet(11, 0.12).pets[0].isAlive).toBe(true);
  });
  it('charges annual maintenance', () => expect(tickPet(3).maintenanceCost).toBe(800));
});

describe('Custody battle (legacy mirror)', () => {
  function resolveCustodyFight(randomValue) {
    return randomValue < 0.8 ? 'won' : 'lost';
  }

  function calculateChildSupport(amount, years) {
    return amount * years;
  }

  it('wins full custody when random < 0.8', () => {
    expect(resolveCustodyFight(0.0)).toBe('won');
    expect(resolveCustodyFight(0.5)).toBe('won');
    expect(resolveCustodyFight(0.79)).toBe('won');
  });

  it('loses custody when random >= 0.8', () => {
    expect(resolveCustodyFight(0.8)).toBe('lost');
    expect(resolveCustodyFight(0.99)).toBe('lost');
  });

  it('wins 80% of the time on average', () => {
    let wins = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (resolveCustodyFight(Math.random()) === 'won') wins++;
    }
    const winRate = wins / trials;
    expect(winRate).toBeGreaterThan(0.75);
    expect(winRate).toBeLessThan(0.85);
  });

  it('calculates correct annual child support', () => {
    expect(calculateChildSupport(200, 12)).toBe(2400);
  });

  it('scales linearly with different monthly amounts', () => {
    expect(calculateChildSupport(500, 12)).toBe(6000);
    expect(calculateChildSupport(150, 6)).toBe(900);
  });
});

describe('NPC autonomy (production annual pass)', () => {
  const npcYear = (age, overrides, roll) => tickRelationship(makeRel({
    status: 'friend', age: age - 1, npcJob: 'teacher', npcSpouse: true, npcSick: true, ...overrides,
  }), { randomFn: () => roll });

  it('triggers a job event below the 5% threshold', () => {
    expect(npcYear(30, { npcJob: null }, 0.051).npcJob).toBeNull();
    expect(npcYear(30, { npcJob: null }, 0.04).npcJob).toBeTruthy();
  });
  it('keeps an existing NPC job', () => {
    expect(npcYear(30, { npcJob: 'chef' }, 0.001).npcJob).toBe('chef');
  });
  it('does not assign jobs outside the eligible age range', () => {
    expect(npcYear(20, { npcJob: null }, 0.001).npcJob).toBeNull();
    expect(npcYear(50, { npcJob: null }, 0.001).npcJob).toBeNull();
  });
  it('triggers marriage below the 4% threshold', () => {
    expect(npcYear(30, { npcSpouse: false }, 0.039).npcSpouse).toBe(true);
    expect(npcYear(30, { npcSpouse: false }, 0.041).npcSpouse).toBe(false);
  });
  it('does not generate a second marriage for a married NPC', () => {
    const year = tickRelationships([makeRel({ status: 'friend', age: 29, npcJob: 'chef', npcSpouse: true, npcSick: true })], { randomFn: () => 0.001 });
    expect(year.relationships[0].npcSpouse).toBe(true);
    expect(year.events.some(event => event.includes('got married'))).toBe(false);
  });
  it('increases sickness probability with age past 40', () => {
    expect(npcYear(35, { npcSick: false }, 0).npcSick).toBe(false);
    expect(npcYear(40, { npcSick: false }, 0.029).npcSick).toBe(true);
    expect(npcYear(40, { npcSick: false }, 0.03).npcSick).toBe(false);
    expect(npcYear(60, { npcSick: false }, 0.08).npcSick).toBe(false);
    expect(npcYear(80, { npcSick: false }, 0.08).npcSick).toBe(true);
  });
});
