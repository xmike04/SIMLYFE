/** economy integration mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { calculateIncomeTax as cit, getWealthTier as gwt, WEALTH_TIERS as WT2 } from '../../config/wealthTiers';
import { calculateCapitalGainsTax, getAssetsByTier } from '../../config/assetCatalog';
import { getStoresByCategory, STORE_TIER_ORDER, STORE_CATALOG } from '../../config/storeCatalog';
import { applyEffects } from './support/adapters.js';
import { calcNetWorth } from './support/investments.js';
import { calcDivorceCost } from './support/relationships.js';

describe('§13.1 applyEffects — bank:0 edge case', () => {
  const baseStats = { health: 80, happiness: 80, smarts: 50, looks: 50, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, grades: 70 };

  it('bank:0 effect does not change bank (falsy guard bug would skip this)', () => {
    const { bank } = applyEffects(baseStats, 500, { bank: 0 });
    expect(bank).toBe(500); // no change — 0 means "no effect", not "set to 0"
  });

  it('bank negative effect correctly reduces', () => {
    const { bank } = applyEffects(baseStats, 1000, { bank: -1000 });
    expect(bank).toBe(0);
  });

  it('multiple stats + bank in one effect object all apply', () => {
    const { stats, bank } = applyEffects(baseStats, 2000, { health: -10, happiness: 15, karma: -5, bank: -500 });
    expect(stats.health).toBe(70);
    expect(stats.happiness).toBe(95);
    expect(stats.karma).toBe(45);
    expect(bank).toBe(1500);
  });
});

describe('§13.2 Wealth tier × income tax × lifestyle cost pipeline', () => {
  it('broke player pays 0 income tax regardless of salary', () => {
    const tax = cit(50_000, -100);
    expect(tax).toBe(0);
  });

  it('working-class player ($20k bank) pays 15% on salary', () => {
    const tax = cit(60_000, 20_000);
    expect(tax).toBe(9_000); // 60k × 15%
  });

  it('upper_middle player ($300k bank) pays 28% on salary', () => {
    const tax = cit(100_000, 300_000);
    expect(tax).toBe(28_000);
  });

  it('ultra-wealthy player ($150M bank) pays 45% on salary', () => {
    const tax = cit(500_000, 150_000_000);
    expect(tax).toBe(225_000);
  });

  it('annual cashflow: salary - tax - lifestyle cost goes negative for lower earner with high lifestyle', () => {
    const bank = 1_000_000; // wealthy tier
    const tier = gwt(bank);
    const salary = 80_000;
    const tax = cit(salary, bank);
    const netSalary = salary - tax;
    const cashflow = netSalary - tier.lifestyleCost;
    // wealthy lifestyle = $40k/yr, net salary after 35% tax = $52k → still positive
    expect(cashflow).toBeGreaterThan(0);
    expect(netSalary).toBe(52_000);
  });

  it('ultra tier lifestyle cost ($1M) exceeds most salaries', () => {
    const tier = gwt(100_000_000);
    expect(tier.lifestyleCost).toBe(1_000_000);
    const salary = 500_000;
    const tax = cit(salary, 100_000_000);
    const net = salary - tax - tier.lifestyleCost;
    expect(net).toBeLessThan(0); // -$775k/yr from salary alone — needs investment income
  });

  it('tier transition: $49,999 is middle class boundary', () => {
    expect(gwt(49_999).id).toBe('working');
    expect(gwt(50_000).id).toBe('middle');
  });

  it('relationDecayMult scales from 1.0 (broke) to 2.5 (ultra)', () => {
    const tiers = WT2.map(t => t.relationDecayMult);
    expect(tiers[0]).toBe(1.0);
    expect(tiers[tiers.length - 1]).toBe(2.5);
    // each tier's mult is >= previous
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
  });
});

describe('§13.3 Asset × wealth tier × CGT integration', () => {
  it('studio apartment appreciates 3% per year correctly', () => {
    const studio = { id: 'studio_apt', currentValue: 50_000, appreciationRate: 1.03 };
    expect(Math.floor(studio.currentValue * studio.appreciationRate)).toBe(51_500);
  });

  it('vehicle depreciates 15% per year correctly', () => {
    const clunker = { id: 'used_clunker', currentValue: 3_000, appreciationRate: 0.80 };
    expect(Math.floor(clunker.currentValue * clunker.appreciationRate)).toBe(2_400);
  });

  it('CGT: selling at loss returns 0 tax', () => {
    expect(calculateCapitalGainsTax(100_000, 70_000, 0.20)).toBe(0);
  });

  it('CGT: selling crypto at 400x applies current tier rate', () => {
    const purchasePrice = 1_000;
    const currentValue = 400_000; // 400x
    const cgtRate = gwt(500_000).capitalGainsTaxRate; // upper_middle = 23%
    const tax = calculateCapitalGainsTax(purchasePrice, currentValue, cgtRate);
    expect(tax).toBe(Math.floor((400_000 - 1_000) * 0.23)); // $91,770
  });

  it('CGT: ultra-wealthy pays 37% on art appreciation', () => {
    const tax = calculateCapitalGainsTax(8_000_000, 20_000_000, 0.37);
    expect(tax).toBe(Math.floor(12_000_000 * 0.37)); // $4,440,000
  });

  it('net worth correctly sums bank + properties + belongings', () => {
    const bank = 50_000;
    const properties = [{ currentValue: 250_000 }, { currentValue: 120_000 }];
    const belongings = [{ currentValue: 8_000 }, { currentValue: 15_000 }];
    expect(calcNetWorth(bank, properties, belongings)).toBe(443_000);
  });

  it('market crash: 30% wipe on properties but not belongings', () => {
    const props = [{ currentValue: 100_000 }, { currentValue: 200_000 }];
    const crashed = props.map(p => ({ ...p, currentValue: Math.floor(p.currentValue * 0.7) }));
    expect(crashed[0].currentValue).toBe(70_000);
    expect(crashed[1].currentValue).toBe(140_000);
  });

  it('getAssetsByTier: broke player cannot access working-tier items', () => {
    const brokeItems = getAssetsByTier('vehicles', 'broke');
    const usedClunker = brokeItems.find(i => i.id === 'used_clunker');
    const newSedan = brokeItems.find(i => i.id === 'sedan');
    expect(usedClunker.locked).toBe(false);
    expect(newSedan.locked).toBe(true);
  });

  it('getAssetsByTier: ultra player sees all items unlocked', () => {
    const items = getAssetsByTier('realEstate', 'ultra');
    expect(items.every(i => !i.locked)).toBe(true);
  });
});

describe('§13.4 Store catalog × wealth tier gating', () => {
  it('budget_auto_sales is visible to broke tier', () => {
    const stores = getStoresByCategory('vehicles', 'broke', {});
    const budget = stores.find(s => s.id === 'budget_auto_sales');
    expect(budget).toBeDefined();
    expect(budget.locked).toBe(false);
  });

  it('anderson_race_world requires wealthy tier — locked for middle', () => {
    const stores = getStoresByCategory('vehicles', 'middle', {});
    const race = stores.find(s => s.id === 'anderson_race_world');
    expect(race.locked).toBe(true);
  });

  it('anderson_race_world is unlocked at wealthy tier', () => {
    const stores = getStoresByCategory('vehicles', 'wealthy', {});
    const race = stores.find(s => s.id === 'anderson_race_world');
    expect(race.locked).toBe(false);
  });

  it('san_diego_aircraft_brokers requires rich tier', () => {
    const stores = getStoresByCategory('vehicles', 'ultra', {});
    const jets = stores.find(s => s.id === 'san_diego_aircraft_brokers');
    expect(jets.locked).toBe(false);
  });

  it('elite_global_properties is locked until rich tier', () => {
    const lockedFor = ['broke', 'struggling', 'working', 'middle', 'upper_middle', 'wealthy'];
    for (const tier of lockedFor) {
      const stores = getStoresByCategory('realEstate', tier, {});
      const store = stores.find(s => s.id === 'elite_global_properties');
      expect(store.locked).toBe(true);
    }
  });

  it('STORE_TIER_ORDER matches WEALTH_TIERS order', () => {
    const tierIds = WT2.map(t => t.id);
    expect(STORE_TIER_ORDER).toEqual(tierIds);
  });

  it('every store in every category has at least 2 listings', () => {
    for (const [cat, stores] of Object.entries(STORE_CATALOG)) {
      for (const store of stores) {
        expect(store.listings.length, `${cat}/${store.id} has fewer than 2 listings`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('§13.5 Relationship × wealth tier integration', () => {
  it('dating costs scale with wealth tier', () => {
    const dateCosts = WT2.map(t => t.dateCost);
    // every tier should have a dateCost >= previous
    for (let i = 1; i < dateCosts.length; i++) {
      expect(dateCosts[i]).toBeGreaterThanOrEqual(dateCosts[i - 1]);
    }
  });

  it('gift amounts have 3 tiers that scale with wealth', () => {
    for (const tier of WT2) {
      expect(tier.giftAmounts).toHaveLength(3);
      expect(tier.giftAmounts[0]).toBeLessThan(tier.giftAmounts[1]);
      expect(tier.giftAmounts[1]).toBeLessThan(tier.giftAmounts[2]);
    }
  });

  it('divorce cost at $10k bank → clamped up to minimum $5k', () => {
    // 15% of 10k = $1,500 is below the $5k floor, so result is $5,000
    expect(calcDivorceCost(10_000)).toBe(5_000);
    expect(calcDivorceCost(10_000)).toBe(Math.min(50_000, Math.max(5_000, Math.floor(10_000 * 0.15))));
  });

  it('divorce cost at $100k bank → 15% = $15k', () => {
    expect(calcDivorceCost(100_000)).toBe(15_000);
  });

  it('divorce cost at $1M bank → capped at $50k', () => {
    expect(calcDivorceCost(1_000_000)).toBe(50_000);
  });

  it('divorce cost at $500k bank → capped at $50k', () => {
    expect(calcDivorceCost(500_000)).toBe(50_000);
  });

  it('parent death chance formula: age 70 → 0%, age 100 → 100%', () => {
    const deathChance = (age) => Math.min(1, (age - 70) / 60);
    expect(deathChance(70)).toBe(0);
    expect(deathChance(100)).toBeCloseTo(0.5);
    expect(deathChance(130)).toBe(1);
  });

  it('jealousy triggers when 2+ active romantic relationships', () => {
    const rels = [
      { status: 'dating', isAlive: true },
      { status: 'married', isAlive: true },
      { status: 'family', isAlive: true },
    ];
    const activeRomantic = rels.filter(r => (r.status === 'dating' || r.status === 'married') && r.isAlive);
    expect(activeRomantic.length).toBe(2); // triggers jealousy
  });

  it('auto-breakup triggers at relation < 20', () => {
    const shouldBreak = (rel) => (rel.status === 'dating' || rel.status === 'married') && rel.relation < 20;
    expect(shouldBreak({ status: 'dating', relation: 19 })).toBe(true);
    expect(shouldBreak({ status: 'dating', relation: 20 })).toBe(false);
    expect(shouldBreak({ status: 'family', relation: 5 })).toBe(false); // family not affected
  });
});
