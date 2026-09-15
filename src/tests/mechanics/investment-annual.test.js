/** investment annual mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { BOND_LIST, CRYPTO_LIST } from '../../config/investmentMarket';
import { processInvestmentYear, calcCryptoYear } from './support/investments.js';

describe('§13.6 Investment processing — bonds', () => {
  const makeBond = (overrides = {}) => ({
    subType: 'bond',
    purchasePrice: 10_000,
    currentValue: 10_000,
    couponRate: 0.045,
    yearsToMaturity: 5,
    yearsOwned: 0,
    ...overrides,
  });

  it('bond coupon income = purchasePrice × couponRate (floored)', () => {
    const { income } = processInvestmentYear(makeBond());
    expect(income).toBe(Math.floor(10_000 * 0.045)); // $450
  });

  it('bond value stays at purchasePrice (par) between maturity years', () => {
    const { newValue } = processInvestmentYear(makeBond({ yearsToMaturity: 3 }));
    expect(newValue).toBe(10_000);
  });

  it('bond matures when yearsToMaturity reaches 1 → returns matured:true', () => {
    const { matured, newValue } = processInvestmentYear(makeBond({ yearsToMaturity: 1 }));
    expect(matured).toBe(true);
    expect(newValue).toBe(0); // removed from portfolio
  });

  it('coupon income still paid in maturity year', () => {
    const { income, matured } = processInvestmentYear(makeBond({ yearsToMaturity: 1 }));
    expect(matured).toBe(true);
    expect(income).toBe(450); // still earns the last coupon
  });

  it('US 10yr bond: correct coupon on $50k investment', () => {
    const us10yr = BOND_LIST.find(b => b.id === 'us_10yr');
    const bond = makeBond({ purchasePrice: 50_000, couponRate: us10yr.coupon });
    const { income } = processInvestmentYear(bond);
    expect(income).toBe(Math.floor(50_000 * 0.045)); // $2,250/yr
  });

  it('Brazilian bond has higher coupon than US bond (EM premium)', () => {
    const us = BOND_LIST.find(b => b.id === 'us_10yr');
    const br = BOND_LIST.find(b => b.id === 'br_10yr');
    expect(br.coupon).toBeGreaterThan(us.coupon);
  });

  it('Brazilian bond has higher risk than US bond', () => {
    const us = BOND_LIST.find(b => b.id === 'us_10yr');
    const br = BOND_LIST.find(b => b.id === 'br_10yr');
    expect(br.risk).toBeGreaterThan(us.risk);
  });

  it('multiple bonds maturing in same year: principals stack', () => {
    const b1 = makeBond({ purchasePrice: 10_000, yearsToMaturity: 1 });
    const b2 = makeBond({ purchasePrice: 25_000, yearsToMaturity: 1 });
    const r1 = processInvestmentYear(b1);
    const r2 = processInvestmentYear(b2);
    const totalReturn = r1.income + r2.income;
    expect(r1.matured).toBe(true);
    expect(r2.matured).toBe(true);
    expect(totalReturn).toBe(450 + 1_125); // coupons on last year
  });

  // Legacy history-format mirror: formatting still belongs to the hook, not this annual helper.
  function buildInvestmentHistoryStr(bondMaturities, totalInvestmentIncome) {
    let str = '';
    for (const bond of bondMaturities) {
      const msg = `Bond Maturity: ${bond.name} matured — principal of $${bond.principal.toLocaleString()} returned.`;
      str = str ? `${str} ${msg}` : msg;
    }
    if (totalInvestmentIncome !== 0) {
      const incomeMsg = totalInvestmentIncome > 0
        ? `Investments: Your portfolio returned $${totalInvestmentIncome.toLocaleString()} this year.`
        : `Investments: Your portfolio lost $${Math.abs(totalInvestmentIncome).toLocaleString()} this year.`;
      str = str ? `${str} | ${incomeMsg}` : incomeMsg;
    }
    return str;
  }

  it('bond maturity message is not overwritten when there is also coupon income', () => {
    const result = buildInvestmentHistoryStr(
      [{ name: 'US Government Bond (10-Yr)', principal: 10_000 }],
      450 // coupon income
    );
    expect(result).toContain('Bond Maturity');
    expect(result).toContain('$10,000 returned');
    expect(result).toContain('Investments:');
    expect(result).toContain('$450');
  });

  it('income-only year: no bond prefix, only income message', () => {
    const result = buildInvestmentHistoryStr([], 1_200);
    expect(result).toBe('Investments: Your portfolio returned $1,200 this year.');
    expect(result).not.toContain('Bond Maturity');
  });

  it('maturity-only year: no income suffix, only maturity message', () => {
    const result = buildInvestmentHistoryStr(
      [{ name: 'German Government Bond (5-Yr)', principal: 5_000 }],
      0
    );
    expect(result).toContain('Bond Maturity');
    expect(result).not.toContain('Investments:');
  });

  it('loss year with bond maturity: both messages present', () => {
    const result = buildInvestmentHistoryStr(
      [{ name: 'UK Government Bond (10-Yr)', principal: 20_000 }],
      -3_000
    );
    expect(result).toContain('Bond Maturity');
    expect(result).toContain('lost $3,000');
  });
});

describe('§13.7 Investment processing — stocks & penny stocks', () => {
  const makeStock = (overrides = {}) => ({
    subType: 'stock',
    currentValue: 10_000,
    volatility: 0.25,
    baseReturn: 0.08,
    yearsOwned: 0,
    ...overrides,
  });

  const makePenny = (overrides = {}) => ({
    subType: 'penny_stock',
    currentValue: 5_000,
    yearsOwned: 0,
    ...overrides,
  });

  it('stock in boom: gets +10% bonus on top of base return', () => {
    // Force a zero-swing roll: randomFn always returns 0.5 → swing = 0
    const { newValue } = processInvestmentYear(makeStock(), 'boom', () => 0.5);
    const expectedRate = 0 + 0.08 + 0.10; // swing=0, base=8%, boom=10%
    expect(newValue).toBe(Math.floor(10_000 * (1 + expectedRate)));
  });

  it('stock in recession: loses 15% from base return', () => {
    const { newValue } = processInvestmentYear(makeStock(), 'recession', () => 0.5);
    const expectedRate = 0 + 0.08 - 0.15; // swing=0, base=8%, recession=-15%
    expect(newValue).toBe(Math.max(0, Math.floor(10_000 * (1 + expectedRate))));
  });

  it('stock value cannot go below 0', () => {
    const { newValue } = processInvestmentYear(makeStock({ currentValue: 100 }), 'recession', () => 0);
    expect(newValue).toBeGreaterThanOrEqual(0);
  });

  it('penny stock: roll < 0.12 → bankrupt (value = 0)', () => {
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => 0.05);
    expect(newValue).toBe(0);
  });

  it('penny stock: 0.12 <= roll < 0.22 → moonshot (2x–6x)', () => {
    // roll=0.15 → moonshot, secondRoll=0.5 → 2 + 0.5*4 = 4x
    let callCount = 0;
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => {
      callCount++;
      return callCount === 1 ? 0.15 : 0.5;
    });
    expect(newValue).toBeGreaterThan(5_000 * 2);
    expect(newValue).toBeLessThanOrEqual(5_000 * 6);
  });

  it('penny stock: roll >= 0.22 → stays in ±range (not moonshot)', () => {
    // roll=0.50, swingRoll=0.5 → swing = (0.5-0.45)*0.70 = 0.035
    let callCount = 0;
    const { newValue } = processInvestmentYear(makePenny(), 'normal', () => {
      callCount++;
      return callCount === 1 ? 0.50 : 0.50;
    });
    // Should be near 5000 but not a moonshot multiple
    expect(newValue).toBeLessThan(5_000 * 2);
    expect(newValue).toBeGreaterThanOrEqual(0);
  });
});

describe('§13.8 Crypto volatility — moonshot/crash mechanics', () => {
  const makeCrypto = (overrides = {}) => ({
    subType: 'crypto',
    currentValue: 10_000,
    volatility: 1.80, // VOID-tier volatility
    trendiness: 0.5,
    yearsOwned: 0,
    ...overrides,
  });

  it('vol >= 1.5 + moonshotRoll < 0.02 → 50x–1000x multiplier', () => {
    const result = calcCryptoYear(makeCrypto(), 'normal', 0.01, 0.50, 0.5);
    // 50 + 0.5*950 = 525x
    expect(result).toBe(Math.floor(10_000 * (50 + 0.5 * 950)));
    expect(result).toBeGreaterThan(10_000 * 50);
  });

  it('vol >= 1.5 + moonshotRoll >= 0.02 + crashRoll low → crash path', () => {
    // crashRoll = 0.03 < 0.05 + (1.80-0.6)*0.1 = 0.17
    const result = calcCryptoYear(makeCrypto(), 'normal', 0.05, 0.03, 0.5);
    // survive = 0.02 + 0.5*0.18 = 0.11 → 89% loss
    expect(result).toBe(Math.max(0, Math.floor(10_000 * (0.02 + 0.5 * 0.18))));
    expect(result).toBeLessThan(10_000 * 0.20); // lost >80%
  });

  it('low-volatility coin (DHMN, 0.40) has much smaller moonshot window', () => {
    const dhmn = CRYPTO_LIST.find(c => c.id === 'diamondhands');
    expect(dhmn.volatility).toBeLessThan(0.80); // no moonshot mechanic
  });

  it('PumpDump has extreme volatility (>= 1.5)', () => {
    const pump = CRYPTO_LIST.find(c => c.id === 'pumpdump');
    expect(pump.volatility).toBeGreaterThanOrEqual(1.5);
  });

  it('VoidBucks has extreme volatility (>= 1.5)', () => {
    const void_ = CRYPTO_LIST.find(c => c.id === 'voidbucks');
    expect(void_.volatility).toBeGreaterThanOrEqual(1.5);
  });

  it('all crypto coins have trendiness between 0 and 1', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.trendiness).toBeGreaterThanOrEqual(0);
      expect(coin.trendiness).toBeLessThanOrEqual(1);
    }
  });

  it('all crypto coins have basePrice > 0', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.basePrice).toBeGreaterThan(0);
    }
  });
});
