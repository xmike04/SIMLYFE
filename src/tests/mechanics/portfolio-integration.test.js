/** portfolio integration mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { getWealthTier as gwt } from '../../config/wealthTiers';
import { calculateCapitalGainsTax } from '../../config/assetCatalog';
import { FUND_LIST } from '../../config/investmentMarket';
import { calcNetWorth, calcCryptoYear, processInvestmentYear } from './support/investments.js';
import { calcDivorceCost } from './support/relationships.js';

describe('§13.10 Full pipeline integration: wealth tier + assets + investments + relationships', () => {
  it('net worth calculation correctly sums all asset classes', () => {
    const bank = 250_000;
    const properties = [
      { currentValue: 400_000 }, // suburban home
      { currentValue: 800_000 }, // beachfront villa
    ];
    const belongings = [
      { currentValue: 120_000, subType: 'stock'   }, // ApexTech shares
      { currentValue: 10_000,  subType: 'bond'    }, // US bond
      { currentValue: 75_000,  subType: undefined  }, // luxury SUV
    ];
    const nw = calcNetWorth(bank, properties, belongings);
    expect(nw).toBe(1_655_000);
    // nw puts them in wealthy tier
    expect(gwt(nw).id).toBe('wealthy');
  });

  it('wealthy player selling a boomed property triggers large CGT', () => {
    const purchasePrice = 250_000;
    const currentValue  = 500_000; // doubled
    const cgtRate = gwt(1_500_000).capitalGainsTaxRate; // wealthy = 28%
    const cgt = calculateCapitalGainsTax(purchasePrice, currentValue, cgtRate);
    expect(cgt).toBe(Math.floor(250_000 * 0.28)); // $70,000
    // net proceeds
    expect(currentValue - cgt).toBe(430_000);
  });

  it('expensive divorce + lifestyle costs preserve the remaining wealth tier', () => {
    const bank = 80_000; // just above middle-class entry
    const divorceCost = calcDivorceCost(bank);   // 15% = $12k
    const lifestyleCost = gwt(bank).lifestyleCost; // $3k for middle
    const yearEnd = bank - divorceCost - lifestyleCost;
    expect(divorceCost).toBe(12_000);
    expect(yearEnd).toBe(80_000 - 12_000 - 3_000); // $65k remaining
    expect(gwt(yearEnd).id).toBe('middle'); // still middle
  });

  it('crypto moonshot can push broke player into upper_middle in one year', () => {
    // Broke player holds 1000 PUMP tokens worth $1 each ($1k invested)
    const crypto = {
      subType: 'crypto', currentValue: 1_000,
      volatility: 2.00, trendiness: 0.55, yearsOwned: 0,
    };
    // Force moonshot: moonshotRoll=0.01, swingRoll=0.5 → 50+475=525x
    const newValue = calcCryptoYear(crypto, 'boom', 0.01, 0.99, 0.5);
    expect(newValue).toBe(Math.floor(1_000 * (50 + 0.5 * 950)));
    expect(gwt(newValue).id).toBe('upper_middle'); // 525k lands in upper_middle
  });

  it('asset upkeep drain: multiple properties + lifestyle can bankrupt middle player', () => {
    const bank = 60_000;
    const tier = gwt(bank);                          // middle: $3k lifestyle
    const propertyUpkeep = 2_500 + 4_000 + 12_000;  // suburban + condo + beach villa
    const totalDrain = tier.lifestyleCost + propertyUpkeep;
    const yearEnd = bank - totalDrain;
    expect(totalDrain).toBe(21_500);
    expect(yearEnd).toBe(38_500);
    expect(yearEnd).toBeGreaterThan(0); // survived, but drained
  });

  it('happiness penalty stacks with wealth tier (working class pays 5, upper pays 12)', () => {
    const workingTier = gwt(15_000);
    const upperTier   = gwt(300_000);
    expect(workingTier.happinessPenalty).toBe(5);
    expect(upperTier.happinessPenalty).toBe(12);
    expect(upperTier.happinessPenalty).toBeGreaterThan(workingTier.happinessPenalty);
  });

  it('fund investment in boom: VC seed can return 60% bonus on top of 0% base', () => {
    const vcSeed = FUND_LIST.find(f => f.id === 'vc_seed');
    // Force zero-swing: rng = 0.5 → swing = 0; boom → boomBonus=0.60
    const result = processInvestmentYear(
      { ...vcSeed, currentValue: 1_000_000, returnProfile: vcSeed.returnProfile },
      'boom',
      () => 0.5
    );
    expect(result.income).toBe(0); // Paper gains are not paid as cash.
    expect(result.newValue).toBe(1_600_000);
  });

  it('fund investment in recession: VC seed can lose 50%', () => {
    const vcSeed = FUND_LIST.find(f => f.id === 'vc_seed');
    const result = processInvestmentYear(
      { ...vcSeed, currentValue: 1_000_000, returnProfile: vcSeed.returnProfile },
      'recession',
      () => 0.5
    );
    expect(result.income).toBe(0); // Paper losses do not also debit cash.
    expect(result.newValue).toBe(500_000);
  });

  it('S&P500 fund has lower risk and lower boom bonus than VC seed', () => {
    const sp = FUND_LIST.find(f => f.id === 'sp500_idx');
    const vc = FUND_LIST.find(f => f.id === 'vc_seed');
    expect(sp.risk).toBeLessThan(vc.risk);
    expect(sp.returnProfile.boomBonus).toBeLessThan(vc.returnProfile.boomBonus);
    expect(sp.returnProfile.recessionPenalty).toBeGreaterThan(vc.returnProfile.recessionPenalty); // less negative
  });
});
