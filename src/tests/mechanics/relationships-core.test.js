/** relationships core mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { findSpouse, markAsEx, normalizeRelationshipNpc, pickParentName } from '../../engine/mechanics/relationships';

describe('modifyRelationship (legacy mirror)', () => {
  function modifyRelation(relations, id, delta) {
    return relations.map(r =>
      r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r
    );
  }

  const rels = [
    { id: 'rel_m', type: 'Mother', relation: 70 },
    { id: 'rel_f', type: 'Father', relation: 60 },
  ];

  it('increases relation score', () => {
    const result = modifyRelation(rels, 'rel_m', 10);
    expect(result[0].relation).toBe(80);
  });

  it('decreases relation score', () => {
    const result = modifyRelation(rels, 'rel_f', -20);
    expect(result[1].relation).toBe(40);
  });

  it('clamps to 0 minimum', () => {
    const result = modifyRelation(rels, 'rel_f', -999);
    expect(result[1].relation).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    const result = modifyRelation(rels, 'rel_m', 999);
    expect(result[0].relation).toBe(100);
  });

  it('does not mutate other relationships', () => {
    const result = modifyRelation(rels, 'rel_m', 10);
    expect(result[1].relation).toBe(60);
  });
});

describe('dating success formula (legacy mirror)', () => {
  function datingSuccess(playerLooks, partnerLooks) {
    return (partnerLooks / 150) + (playerLooks / 150);
  }

  it('two average-looks people (~75 each) gives ~1.0 success chance', () => {
    expect(datingSuccess(75, 75)).toBeCloseTo(1.0, 1);
  });

  it('two max-looks people gives 1.33 chance (always succeeds)', () => {
    expect(datingSuccess(100, 100)).toBeCloseTo(1.33, 2);
  });

  it('two min-looks people gives low chance', () => {
    expect(datingSuccess(30, 30)).toBeCloseTo(0.4, 2);
  });

  it('high player looks compensates for low partner looks', () => {
    const chance = datingSuccess(100, 30);
    expect(chance).toBeGreaterThan(0.85);
  });
});

describe('findSpouse', () => {
  it('matches status married and alive', () => {
    const spouse = findSpouse([
      { id: '1', type: 'Friend', status: 'friend', relation: 50, isAlive: true },
      { id: '2', type: 'Spouse', status: 'married', relation: 80, isAlive: true },
    ]);
    expect(spouse?.id).toBe('2');
  });

  it('does not match divorced ex who still has type Spouse', () => {
    const spouse = findSpouse([
      { id: '2', type: 'Spouse', status: 'ex', relation: 10, isAlive: true },
    ]);
    expect(spouse).toBeNull();
  });

  it('does not match markAsEx result', () => {
    const divorced = markAsEx({ id: '2', type: 'Spouse', status: 'married', relation: 10, isAlive: true });
    expect(divorced.status).toBe('ex');
    expect(divorced.type).toBe('Ex');
    expect(findSpouse([divorced])).toBeNull();
  });

  it('does not treat numeric relation as Spouse', () => {
    const spouse = findSpouse([{ id: '4', type: 'Friend', status: 'friend', relation: 'Spouse' }]);
    expect(spouse).toBeNull();
  });
});

describe('markAsEx', () => {
  it('clears married spouse to Ex', () => {
    const ex = markAsEx({ id: '1', type: 'Spouse', status: 'married', relation: 40 });
    expect(ex).toEqual({ id: '1', type: 'Ex', status: 'ex', relation: 40 });
  });

  it('clears dating lover to Ex', () => {
    const ex = markAsEx({ id: '2', type: 'Lover', status: 'dating', relation: 15 });
    expect(ex.status).toBe('ex');
    expect(ex.type).toBe('Ex');
  });
});

describe('normalizeRelationshipNpc', () => {
  it('fills status dating and isAlive for dating-app matches', () => {
    const npc = normalizeRelationshipNpc(
      { id: 'x', type: 'Lover', name: 'Sam', age: 22, relation: 50 },
      { asDating: true }
    );
    expect(npc.status).toBe('dating');
    expect(npc.isAlive).toBe(true);
    expect(npc.type).toBe('Lover');
  });

  it('preserves explicit isAlive false unless asDating forces alive', () => {
    const dead = normalizeRelationshipNpc({ id: 'd', type: 'Friend', isAlive: false, status: 'family' });
    expect(dead.isAlive).toBe(false);
    const forced = normalizeRelationshipNpc({ id: 'd', type: 'Lover', isAlive: false }, { asDating: true });
    expect(forced.isAlive).toBe(true);
    expect(forced.status).toBe('dating');
  });
});

describe('parent name generation', () => {
  it('uses label-compatible parent name pools', () => {
    expect(pickParentName('Mother', 0)).toBe('Mary');
    expect(pickParentName('Father', 0)).toBe('James');
    expect(pickParentName('Mother', 0.999)).toBe('Karen');
    expect(pickParentName('Father', 0.999)).toBe('Charles');
  });
});
