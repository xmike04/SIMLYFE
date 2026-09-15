/** investment trading mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { normalizeInvestmentSubType, prepareInvestmentPurchase, applyPaperInvestmentReturn, computeInvestmentSale } from '../../engine/mechanics/investments';
import { calculateCapitalGainsTax } from '../../config/assetCatalog';

describe('Investment purchase validation', () => {
  const fund = { id: 'sp500_idx', name: 'S&P 500 Index Fund', ticker: 'SPX', minInvestment: 500, returnProfile: { base: 0.1 } };

  it('normalizes UI category aliases to canonical saved subtypes', () => {
    expect(normalizeInvestmentSubType('stocks')).toBe('stock');
    expect(normalizeInvestmentSubType('bonds')).toBe('bond');
    expect(normalizeInvestmentSubType('penny')).toBe('penny_stock');
    expect(normalizeInvestmentSubType('funds')).toBe('fund');
  });

  it('prepares a valid fund purchase', () => {
    const purchase = prepareInvestmentPurchase(fund, 1000, 'funds', 5000);
    expect(purchase).toMatchObject({ ok: true, subType: 'fund', units: 1000, actualCost: 1000 });
  });

  it.each([null, undefined, 'sp500_idx', [], {}])('rejects invalid instrument %s', (instrument) => {
    expect(prepareInvestmentPurchase(instrument, 1000, 'fund', 5000).reason).toBe('invalid_instrument');
  });

  it.each([undefined, NaN, Infinity, 0, -10])('rejects invalid amount %s', (amount) => {
    expect(prepareInvestmentPurchase(fund, amount, 'fund', 5000).reason).toBe('invalid_amount');
  });
});

describe('applyPaperInvestmentReturn', () => {
  it('updates asset value without cash credit', () => {
    const { newValue, cashDelta } = applyPaperInvestmentReturn(10000, 700);
    expect(newValue).toBe(10700);
    expect(cashDelta).toBe(0);
  });

  it('clamps value at 0 on large losses', () => {
    const { newValue, cashDelta } = applyPaperInvestmentReturn(500, -2000);
    expect(newValue).toBe(0);
    expect(cashDelta).toBe(0);
  });
});

describe('§14 sellInvestment — computeInvestmentSale', () => {
  const makeCryptoHolding = (overrides = {}) => ({
    id: 'inv_crypto_1',
    subType: 'crypto',
    purchasePrice: 1_000,
    currentValue: 50_000,
    units: 100,
    ...overrides,
  });

  const makeBondHolding = (overrides = {}) => ({
    id: 'inv_bond_1',
    subType: 'bond',
    purchasePrice: 10_000,
    currentValue: 10_000,
    couponRate: 0.045,
    yearsToMaturity: 3,
    ...overrides,
  });

  const makeStockHolding = (overrides = {}) => ({
    id: 'inv_stock_1',
    subType: 'stock',
    purchasePrice: 5_000,
    currentValue: 3_000, // at a loss
    ...overrides,
  });

  it('crypto at large gain: CGT applied, net proceeds correct', () => {
    const cgtRate = 0.23; // upper_middle tier
    const { proceeds, cgt, gain } = computeInvestmentSale(makeCryptoHolding(), 10_000, cgtRate);
    expect(gain).toBe(49_000);
    expect(cgt).toBe(calculateCapitalGainsTax(1_000, 50_000, 0.23));
    expect(proceeds).toBe(Math.floor(50_000) - cgt);
  });

  it('crypto at large gain: bank increases by net proceeds', () => {
    const { newBank } = computeInvestmentSale(makeCryptoHolding(), 10_000, 0.23);
    const expectedCgt = calculateCapitalGainsTax(1_000, 50_000, 0.23);
    expect(newBank).toBe(10_000 + 50_000 - expectedCgt);
  });

  it('stock at a loss: no CGT, proceeds = full currentValue', () => {
    const { proceeds, cgt } = computeInvestmentSale(makeStockHolding(), 20_000, 0.20);
    expect(cgt).toBe(0);
    expect(proceeds).toBe(3_000);
  });

  it('stock at a loss: bank increases by full currentValue (no CGT penalty)', () => {
    const { newBank } = computeInvestmentSale(makeStockHolding(), 20_000, 0.20);
    expect(newBank).toBe(23_000);
  });

  it('bond early sale: returns purchasePrice (par), no CGT', () => {
    const { proceeds, newBank } = computeInvestmentSale(makeBondHolding(), 5_000, 0.20);
    expect(proceeds).toBe(10_000); // par value, no CGT
    expect(newBank).toBe(15_000);
  });

  it('bond: proceeds do not depend on CGT rate', () => {
    const r1 = computeInvestmentSale(makeBondHolding(), 0, 0.00);
    const r2 = computeInvestmentSale(makeBondHolding(), 0, 0.37);
    expect(r1.proceeds).toBe(r2.proceeds);
  });

  it('penny stock at zero value: proceeds = 0, bank unchanged', () => {
    const bust = { id: 'p1', subType: 'penny_stock', purchasePrice: 2_000, currentValue: 0 };
    const { proceeds, newBank } = computeInvestmentSale(bust, 8_000, 0.15);
    expect(proceeds).toBe(0);
    expect(newBank).toBe(8_000);
  });

  it('fund at gain: CGT applies at provided rate', () => {
    const fund = { id: 'f1', subType: 'fund', purchasePrice: 100_000, currentValue: 130_000 };
    const cgtRate = 0.28;
    const { proceeds, cgt } = computeInvestmentSale(fund, 0, cgtRate);
    expect(cgt).toBe(calculateCapitalGainsTax(100_000, 130_000, cgtRate));
    expect(proceeds).toBe(130_000 - cgt);
  });
});
