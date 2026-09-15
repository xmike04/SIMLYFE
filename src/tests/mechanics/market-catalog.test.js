/** market catalog mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { BOND_LIST, STOCK_LIST, PENNY_STOCK_LIST, FUND_LIST, getMarketHealth, bondDisplayName } from '../../config/investmentMarket';

describe('§13.9 investmentMarket schema validation', () => {
  it('all BOND_LIST entries have required fields', () => {
    for (const bond of BOND_LIST) {
      expect(bond.id).toBeTruthy();
      expect(bond.name).toBeTruthy();
      expect(bond.coupon).toBeGreaterThan(0);
      expect(bond.maturity).toBeGreaterThan(0);
      expect(bond.minInvestment).toBeGreaterThan(0);
      expect(bond.risk).toBeGreaterThanOrEqual(0);
      expect(bond.risk).toBeLessThanOrEqual(1);
    }
  });

  it('all STOCK_LIST entries have required fields', () => {
    for (const stock of STOCK_LIST) {
      expect(stock.id).toBeTruthy();
      expect(stock.ticker).toBeTruthy();
      expect(stock.basePrice).toBeGreaterThan(0);
      expect(stock.volatility).toBeGreaterThan(0);
      expect(stock.baseReturn).toBeGreaterThan(0);
      expect(stock.sector).toBeTruthy();
    }
  });

  it('all PENNY_STOCK_LIST entries have required fields', () => {
    for (const penny of PENNY_STOCK_LIST) {
      expect(penny.id).toBeTruthy();
      expect(penny.ticker).toBeTruthy();
      expect(penny.basePrice).toBeGreaterThan(0);
      expect(penny.basePrice).toBeLessThan(5); // must be genuinely cheap
    }
  });

  it('all FUND_LIST entries have a returnProfile with required keys', () => {
    for (const fund of FUND_LIST) {
      expect(fund.returnProfile).toBeDefined();
      expect(fund.returnProfile.base).toBeDefined();
      expect(fund.returnProfile.boomBonus).toBeDefined();
      expect(fund.returnProfile.recessionPenalty).toBeDefined();
      expect(fund.returnProfile.volatility).toBeGreaterThanOrEqual(0);
    }
  });

  it('getMarketHealth returns score in 5–95 range and valid color/label', () => {
    const types = ['crypto', 'stocks', 'bonds', 'penny', 'funds'];
    const phases = ['normal', 'boom', 'recession'];
    for (const t of types) {
      for (const p of phases) {
        const mh = getMarketHealth(t, p);
        expect(mh.score).toBeGreaterThanOrEqual(5);
        expect(mh.score).toBeLessThanOrEqual(95);
        expect(['Bullish', 'Mixed', 'Bearish']).toContain(mh.label);
        expect(mh.color).toMatch(/^#/);
      }
    }
  });

  it('bondDisplayName formats correctly', () => {
    const bond = BOND_LIST.find(b => b.id === 'us_10yr');
    expect(bondDisplayName(bond)).toBe('US Government Bond (10-Yr)');
  });

  it('bonds are in ascending coupon order within same country', () => {
    const usBonds = BOND_LIST.filter(b => b.id.startsWith('us_'));
    // longer maturity → higher coupon (normal yield curve)
    for (let i = 1; i < usBonds.length; i++) {
      expect(usBonds[i].coupon).toBeGreaterThan(usBonds[i - 1].coupon);
    }
  });
});
