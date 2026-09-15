/** estate mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { prepareWillDraft, computeEstateDistribution } from '../../engine/mechanics/relationships';

describe('prepareWillDraft', () => {
  const rels = [
    { id: 'rel_m', type: 'Mother', name: 'Mona', isAlive: true },
    { id: 'rel_f', type: 'Father', name: 'Frank', isAlive: true },
    { id: 'rel_s', type: 'Spouse', name: 'Sam', isAlive: true },
  ];

  it('accepts a valid directed will and drops zero-pct entries', () => {
    const result = prepareWillDraft(
      [{ id: 'rel_m', pct: 40 }, { id: 'rel_f', pct: 0 }, { id: 'rel_s', pct: 60 }],
      rels
    );
    expect(result.ok).toBe(true);
    expect(result.allocations).toEqual([{ id: 'rel_m', pct: 40 }, { id: 'rel_s', pct: 60 }]);
    expect(result.allocatedPct).toBe(100);
  });

  it('accepts an empty draft as the standard even-split will', () => {
    expect(prepareWillDraft([], rels)).toEqual({ ok: true, allocations: [], allocatedPct: 0 });
  });

  it('floors fractional percents', () => {
    const result = prepareWillDraft([{ id: 'rel_m', pct: 33.9 }], rels);
    expect(result.ok).toBe(true);
    expect(result.allocations).toEqual([{ id: 'rel_m', pct: 33 }]);
  });

  it('rejects malformed input before state mutation', () => {
    expect(prepareWillDraft(null, rels)).toEqual({ ok: false, reason: 'invalid_allocations' });
    expect(prepareWillDraft([null], rels)).toEqual({ ok: false, reason: 'invalid_allocations' });
    expect(prepareWillDraft([{ id: 'rel_m', pct: NaN }], rels)).toEqual({ ok: false, reason: 'invalid_pct' });
    expect(prepareWillDraft([{ id: 'rel_m', pct: -5 }], rels)).toEqual({ ok: false, reason: 'invalid_pct' });
    expect(prepareWillDraft([{ id: 'rel_m', pct: 101 }], rels)).toEqual({ ok: false, reason: 'invalid_pct' });
    expect(prepareWillDraft([{ id: 'rel_nobody', pct: 10 }], rels)).toEqual({ ok: false, reason: 'unknown_beneficiary' });
    expect(prepareWillDraft([{ id: 'rel_m', pct: 10 }, { id: 'rel_m', pct: 20 }], rels)).toEqual({ ok: false, reason: 'duplicate_beneficiary' });
    expect(prepareWillDraft([{ id: 'rel_m', pct: 60 }, { id: 'rel_f', pct: 60 }], rels)).toEqual({ ok: false, reason: 'over_allocated' });
  });
});

describe('computeEstateDistribution', () => {
  const rels = [
    { id: 'rel_m', type: 'Mother', name: 'Mona', isAlive: true },
    { id: 'rel_f', type: 'Father', name: 'Frank', isAlive: false },
    { id: 'rel_s', type: 'Spouse', name: 'Sam', isAlive: true },
  ];

  it('sends the whole estate to the residue when no will was drafted', () => {
    const estate = computeEstateDistribution(null, rels, 10000);
    expect(estate.mode).toBe('unwilled');
    expect(estate.estateValue).toBe(10000);
    expect(estate.bequests).toEqual([]);
    expect(estate.residualValue).toBe(10000);
  });

  it('splits a standard will evenly among living relationships only', () => {
    const estate = computeEstateDistribution({ allocations: [] }, rels, 10001);
    expect(estate.mode).toBe('even_split');
    expect(estate.bequests.map(b => b.id)).toEqual(['rel_m', 'rel_s']);
    expect(estate.bequests.every(b => b.amount === 5000)).toBe(true);
    expect(estate.residualValue).toBe(1); // rounding remainder
  });

  it('pays directed bequests and taxes the unallocated residue', () => {
    const will = { allocations: [{ id: 'rel_m', pct: 25 }, { id: 'rel_s', pct: 50 }] };
    const estate = computeEstateDistribution(will, rels, 10000);
    expect(estate.mode).toBe('directed');
    expect(estate.bequests).toEqual([
      { id: 'rel_m', name: 'Mona', type: 'Mother', pct: 25, amount: 2500 },
      { id: 'rel_s', name: 'Sam', type: 'Spouse', pct: 50, amount: 5000 },
    ]);
    expect(estate.residualValue).toBe(2500);
  });

  it('lapses bequests to dead or unknown beneficiaries into the residue', () => {
    const will = { allocations: [{ id: 'rel_f', pct: 60 }, { id: 'rel_gone', pct: 20 }, { id: 'rel_s', pct: 20 }] };
    const estate = computeEstateDistribution(will, rels, 1000);
    expect(estate.bequests).toEqual([{ id: 'rel_s', name: 'Sam', type: 'Spouse', pct: 20, amount: 200 }]);
    expect(estate.residualValue).toBe(800);
  });

  it('treats non-finite or non-positive net worth as an empty estate', () => {
    for (const worth of [NaN, undefined, -500, 0]) {
      const estate = computeEstateDistribution({ allocations: [{ id: 'rel_s', pct: 50 }] }, rels, worth);
      expect(estate.estateValue).toBe(0);
      expect(estate.bequests).toEqual([]);
      expect(estate.residualValue).toBe(0);
    }
  });

  it('never pays out more than the estate on malformed saved allocations', () => {
    const will = { allocations: [{ id: 'rel_m', pct: 90 }, { id: 'rel_s', pct: 90 }] };
    const estate = computeEstateDistribution(will, rels, 1000);
    const paid = estate.bequests.reduce((sum, b) => sum + b.amount, 0);
    expect(paid).toBe(1000);
    expect(estate.residualValue).toBe(0);
    expect(estate.bequests).toEqual([
      { id: 'rel_m', name: 'Mona', type: 'Mother', pct: 90, amount: 900 },
      { id: 'rel_s', name: 'Sam', type: 'Spouse', pct: 90, amount: 100 },
    ]);
  });

  it('skips malformed percent entries instead of crashing', () => {
    const will = { allocations: [{ id: 'rel_s', pct: 'oops' }, { id: 'rel_m', pct: 10 }, null] };
    const estate = computeEstateDistribution(will, rels, 1000);
    expect(estate.bequests).toEqual([{ id: 'rel_m', name: 'Mona', type: 'Mother', pct: 10, amount: 100 }]);
    expect(estate.residualValue).toBe(900);
  });
});
