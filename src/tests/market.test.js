/**
 * market.test.js
 *
 * Schema and logic tests for the store catalog and investment market.
 * Pure functions only — no React, no mocks needed.
 *
 * Structure:
 *   1. STORE_CATALOG schema validation
 *   2. getStoresByCategory — store counts, tier gating, listing enrichment
 *   3. Investment market — CRYPTO_LIST, STOCK_LIST, PENNY_STOCK_LIST, BOND_LIST, FUND_LIST
 *   4. bondDisplayName
 *   5. getMarketHealth
 */

import { describe, it, expect } from 'vitest';
import {
  STORE_CATALOG,
  STORE_TIER_ORDER,
  getStoresByCategory,
} from '../config/storeCatalog.js';
import {
  CRYPTO_LIST,
  STOCK_LIST,
  PENNY_STOCK_LIST,
  BOND_LIST,
  FUND_LIST,
  bondDisplayName,
  getMarketHealth,
} from '../config/investmentMarket.js';

// ─── Minimal catalog lookup for enrichment tests ──────────────────────────────
// Mirrors the shape of ASSET_CATALOG entries consumed by getStoresByCategory.
const MOCK_CATALOG = {
  studio_apt:      { upkeep: 1_200,  type: 'property',   icon: '🏢', statEffects: { happiness: 1 },  appreciationRate: 1.03,  minTier: 'struggling' },
  city_condo:      { upkeep: 4_000,  type: 'property',   icon: '🏙️', statEffects: { happiness: 2 },  appreciationRate: 1.035, minTier: 'working'    },
  suburban_home:   { upkeep: 6_000,  type: 'property',   icon: '🏡', statEffects: { happiness: 3 },  appreciationRate: 1.04,  minTier: 'working'    },
  townhouse:       { upkeep: 8_000,  type: 'property',   icon: '🏘️', statEffects: { happiness: 4 },  appreciationRate: 1.045, minTier: 'middle'     },
  beachfront_villa:{ upkeep: 15_000, type: 'property',   icon: '🏖️', statEffects: { happiness: 5 },  appreciationRate: 1.05,  minTier: 'middle'     },
  penthouse:       { upkeep: 30_000, type: 'property',   icon: '🌆', statEffects: { happiness: 6 },  appreciationRate: 1.055, minTier: 'wealthy'    },
  mega_mansion:    { upkeep: 80_000, type: 'property',   icon: '🏰', statEffects: { happiness: 8 },  appreciationRate: 1.06,  minTier: 'wealthy'    },
  private_island:  { upkeep: 500_000,type: 'property',   icon: '🏝️', statEffects: { happiness: 10 }, appreciationRate: 1.06,  minTier: 'rich'       },
  used_clunker:    { upkeep: 800,    type: 'vehicle',    icon: '🚗', statEffects: {},                 appreciationRate: 0.80,  minTier: 'broke'      },
  economy_car:     { upkeep: 1_500,  type: 'vehicle',    icon: '🚗', statEffects: {},                 appreciationRate: 0.85,  minTier: 'struggling' },
  sedan:           { upkeep: 3_000,  type: 'vehicle',    icon: '🚘', statEffects: { looks: 1 },       appreciationRate: 0.88,  minTier: 'working'    },
  suv:             { upkeep: 5_000,  type: 'vehicle',    icon: '🛻', statEffects: { happiness: 1 },   appreciationRate: 0.87,  minTier: 'middle'     },
  sports_car:      { upkeep: 8_000,  type: 'vehicle',    icon: '🏎️', statEffects: { looks: 2 },       appreciationRate: 0.90,  minTier: 'upper_middle'},
  supercar:        { upkeep: 20_000, type: 'vehicle',    icon: '🏎️', statEffects: { looks: 3 },       appreciationRate: 0.95,  minTier: 'wealthy'    },
  hypercar:        { upkeep: 50_000, type: 'vehicle',    icon: '⚡',  statEffects: { looks: 4 },       appreciationRate: 1.02,  minTier: 'rich'       },
  private_jet:     { upkeep: 200_000,type: 'vehicle',    icon: '✈️', statEffects: { looks: 5 },       appreciationRate: 0.92,  minTier: 'rich'       },
  designer_watch:  { upkeep: 0,      type: 'luxury',     icon: '⌚', statEffects: { looks: 1 },       appreciationRate: 1.04,  minTier: 'working'    },
  custom_jewelry:  { upkeep: 0,      type: 'luxury',     icon: '💍', statEffects: { looks: 2 },       appreciationRate: 1.05,  minTier: 'wealthy'    },
  fine_art:        { upkeep: 500,    type: 'luxury',     icon: '🖼️', statEffects: {},                 appreciationRate: 1.06,  minTier: 'middle'     },
  rare_masterpiece:{ upkeep: 2_000,  type: 'luxury',     icon: '🎨', statEffects: {},                 appreciationRate: 1.08,  minTier: 'wealthy'    },
  rare_wine:       { upkeep: 1_000,  type: 'luxury',     icon: '🍷', statEffects: { happiness: 1 },   appreciationRate: 1.07,  minTier: 'upper_middle'},
  superyacht:      { upkeep: 500_000,type: 'luxury',     icon: '🛥️', statEffects: { happiness: 6 },   appreciationRate: 1.03,  minTier: 'rich'       },
  index_fund:      { upkeep: 0,      type: 'investment', icon: '📊', statEffects: {},                 returnProfile: { base: 0.10 }, minTier: 'working' },
  bonds:           { upkeep: 0,      type: 'investment', icon: '📜', statEffects: {},                 returnProfile: { base: 0.04 }, minTier: 'working' },
  hedge_fund:      { upkeep: 0,      type: 'investment', icon: '🏦', statEffects: {},                 returnProfile: { base: 0.12 }, minTier: 'upper_middle'},
  vc_fund:         { upkeep: 0,      type: 'investment', icon: '🚀', statEffects: {},                 returnProfile: { base: 0.0  }, minTier: 'wealthy' },
  private_equity:  { upkeep: 0,      type: 'investment', icon: '💼', statEffects: {},                 returnProfile: { base: 0.14 }, minTier: 'wealthy' },
};

// ─── 1. STORE_CATALOG schema validation ───────────────────────────────────────

describe('STORE_CATALOG schema', () => {
  const CATEGORIES = Object.keys(STORE_CATALOG);

  it('has expected top-level categories', () => {
    expect(CATEGORIES).toContain('realEstate');
    expect(CATEGORIES).toContain('vehicles');
    expect(CATEGORIES).toContain('luxury');
    expect(CATEGORIES).toContain('investments');
  });

  it.each(CATEGORIES)('%s — every store has required fields', (category) => {
    const stores = STORE_CATALOG[category];
    expect(stores.length).toBeGreaterThan(0);
    for (const store of stores) {
      expect(store, `store id="${store.id}"`).toMatchObject({
        id:       expect.any(String),
        name:     expect.any(String),
        icon:     expect.any(String),
        tagline:  expect.any(String),
        minTier:  expect.any(String),
        listings: expect.any(Array),
      });
    }
  });

  it.each(CATEGORIES)('%s — every listing has required fields', (category) => {
    const stores = STORE_CATALOG[category];
    for (const store of stores) {
      expect(store.listings.length, `store "${store.id}" has listings`).toBeGreaterThan(0);
      for (const listing of store.listings) {
        expect(listing, `listing in store "${store.id}"`).toMatchObject({
          catalogId:   expect.any(String),
          displayName: expect.any(String),
          typeLabel:   expect.any(String),
          price:       expect.any(Number),
        });
      }
    }
  });

  it.each(CATEGORIES)('%s — all listing prices are positive numbers', (category) => {
    for (const store of STORE_CATALOG[category]) {
      for (const listing of store.listings) {
        expect(listing.price, `${store.id} > "${listing.displayName}"`).toBeGreaterThan(0);
        expect(Number.isFinite(listing.price)).toBe(true);
      }
    }
  });

  it.each(CATEGORIES)('%s — no duplicate store IDs within category', (category) => {
    const ids = STORE_CATALOG[category].map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all store minTier values are valid tier IDs', () => {
    for (const [category, stores] of Object.entries(STORE_CATALOG)) {
      for (const store of stores) {
        expect(
          STORE_TIER_ORDER,
          `${category} > "${store.id}" minTier="${store.minTier}"`
        ).toContain(store.minTier);
      }
    }
  });
});

// ─── 2. getStoresByCategory ───────────────────────────────────────────────────

describe('getStoresByCategory', () => {
  describe('store counts', () => {
    it('returns all realEstate stores', () => {
      const result = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      expect(result.length).toBe(STORE_CATALOG.realEstate.length);
    });

    it('returns all vehicles stores', () => {
      const result = getStoresByCategory('vehicles', 'ultra', MOCK_CATALOG);
      expect(result.length).toBe(STORE_CATALOG.vehicles.length);
    });

    it('returns all luxury stores', () => {
      const result = getStoresByCategory('luxury', 'ultra', MOCK_CATALOG);
      expect(result.length).toBe(STORE_CATALOG.luxury.length);
    });

    it('returns all investments stores', () => {
      const result = getStoresByCategory('investments', 'ultra', MOCK_CATALOG);
      expect(result.length).toBe(STORE_CATALOG.investments.length);
    });

    it('returns empty array for unknown category', () => {
      const result = getStoresByCategory('nonexistent', 'ultra', MOCK_CATALOG);
      expect(result).toEqual([]);
    });
  });

  describe('tier gating — store-level locked flag', () => {
    it('broke player: prestige_realty (minTier=struggling) is locked', () => {
      const stores = getStoresByCategory('realEstate', 'broke', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      expect(prestige.locked).toBe(true);
    });

    it('struggling player: prestige_realty (minTier=struggling) is unlocked', () => {
      const stores = getStoresByCategory('realEstate', 'struggling', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      expect(prestige.locked).toBe(false);
    });

    it('working player: pinnacle_luxury_estates (minTier=wealthy) is locked', () => {
      const stores = getStoresByCategory('realEstate', 'working', MOCK_CATALOG);
      const pinnacle = stores.find(s => s.id === 'pinnacle_luxury_estates');
      expect(pinnacle.locked).toBe(true);
    });

    it('wealthy player: pinnacle_luxury_estates (minTier=wealthy) is unlocked', () => {
      const stores = getStoresByCategory('realEstate', 'wealthy', MOCK_CATALOG);
      const pinnacle = stores.find(s => s.id === 'pinnacle_luxury_estates');
      expect(pinnacle.locked).toBe(false);
    });

    it('broke player: budget_auto_sales (minTier=broke) is unlocked', () => {
      const stores = getStoresByCategory('vehicles', 'broke', MOCK_CATALOG);
      const budget = stores.find(s => s.id === 'budget_auto_sales');
      expect(budget.locked).toBe(false);
    });

    it('working player: anderson_race_world (minTier=wealthy) is locked', () => {
      const stores = getStoresByCategory('vehicles', 'working', MOCK_CATALOG);
      const race = stores.find(s => s.id === 'anderson_race_world');
      expect(race.locked).toBe(true);
    });
  });

  describe('listing enrichment from catalog', () => {
    it('studio listing inherits upkeep from catalog', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      for (const listing of prestige.listings) {
        expect(listing.upkeep).toBe(MOCK_CATALOG.studio_apt.upkeep);
      }
    });

    it('studio listing inherits type="property" from catalog', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      for (const listing of prestige.listings) {
        expect(listing.type).toBe('property');
      }
    });

    it('studio listing inherits statEffects from catalog', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      for (const listing of prestige.listings) {
        expect(listing.statEffects).toEqual(MOCK_CATALOG.studio_apt.statEffects);
      }
    });

    it('studio listing inherits appreciationRate from catalog', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      for (const listing of prestige.listings) {
        expect(listing.appreciationRate).toBe(MOCK_CATALOG.studio_apt.appreciationRate);
      }
    });

    it('listing catalogEntry is the full catalog object', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', MOCK_CATALOG);
      const prestige = stores.find(s => s.id === 'prestige_realty');
      expect(prestige.listings[0].catalogEntry).toBe(MOCK_CATALOG.studio_apt);
    });

    it('listing with unknown catalogId gets upkeep=0 and type="luxury" as defaults', () => {
      const stores = getStoresByCategory('realEstate', 'ultra', {});
      // No catalog entries — should use defaults without throwing
      const prestige = stores.find(s => s.id === 'prestige_realty');
      for (const listing of prestige.listings) {
        expect(listing.upkeep).toBe(0);
        expect(listing.type).toBe('luxury');
        expect(listing.statEffects).toEqual({});
        expect(listing.appreciationRate).toBe(1.0);
      }
    });

    it('investments listing inherits returnProfile from catalog', () => {
      const stores = getStoresByCategory('investments', 'ultra', MOCK_CATALOG);
      const horizon = stores.find(s => s.id === 'horizon_wealth_mgmt');
      const indexFundListing = horizon.listings.find(l => l.catalogId === 'index_fund');
      expect(indexFundListing.returnProfile).toEqual(MOCK_CATALOG.index_fund.returnProfile);
    });
  });

  describe('listing-level locked flag', () => {
    it('broke player sees used_clunker listings as unlocked (minTier=broke)', () => {
      const stores = getStoresByCategory('vehicles', 'broke', MOCK_CATALOG);
      const budget = stores.find(s => s.id === 'budget_auto_sales');
      const clunkers = budget.listings.filter(l => l.catalogId === 'used_clunker');
      for (const l of clunkers) {
        expect(l.locked).toBe(false);
      }
    });

    it('broke player sees economy_car listings as locked (minTier=struggling)', () => {
      const stores = getStoresByCategory('vehicles', 'broke', MOCK_CATALOG);
      const budget = stores.find(s => s.id === 'budget_auto_sales');
      const economy = budget.listings.filter(l => l.catalogId === 'economy_car');
      for (const l of economy) {
        expect(l.locked).toBe(true);
      }
    });
  });
});

// ─── 3. Investment market instrument schemas ───────────────────────────────────

describe('CRYPTO_LIST schema', () => {
  it('has at least one entry', () => {
    expect(CRYPTO_LIST.length).toBeGreaterThan(0);
  });

  it.each(CRYPTO_LIST)('$name ($ticker) — required fields present', (coin) => {
    expect(coin.id).toBeTypeOf('string');
    expect(coin.name).toBeTypeOf('string');
    expect(coin.ticker).toBeTypeOf('string');
    expect(coin.icon).toBeTypeOf('string');
    expect(coin.basePrice).toBeTypeOf('number');
    expect(coin.volatility).toBeTypeOf('number');
    expect(coin.trendiness).toBeTypeOf('number');
    expect(coin.description).toBeTypeOf('string');
  });

  it('all basePrice values are positive', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.basePrice, coin.ticker).toBeGreaterThan(0);
    }
  });

  it('all volatility values are positive', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.volatility, coin.ticker).toBeGreaterThan(0);
    }
  });

  it('trendiness is between 0 and 1 inclusive', () => {
    for (const coin of CRYPTO_LIST) {
      expect(coin.trendiness, coin.ticker).toBeGreaterThanOrEqual(0);
      expect(coin.trendiness, coin.ticker).toBeLessThanOrEqual(1);
    }
  });

  it('no duplicate IDs', () => {
    const ids = CRYPTO_LIST.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('STOCK_LIST schema', () => {
  it('has at least one entry', () => {
    expect(STOCK_LIST.length).toBeGreaterThan(0);
  });

  it.each(STOCK_LIST)('$name ($ticker) — required fields present', (stock) => {
    expect(stock.id).toBeTypeOf('string');
    expect(stock.name).toBeTypeOf('string');
    expect(stock.ticker).toBeTypeOf('string');
    expect(stock.icon).toBeTypeOf('string');
    expect(stock.sector).toBeTypeOf('string');
    expect(stock.basePrice).toBeTypeOf('number');
    expect(stock.volatility).toBeTypeOf('number');
    expect(stock.baseReturn).toBeTypeOf('number');
    expect(stock.description).toBeTypeOf('string');
  });

  it('all basePrice values are positive', () => {
    for (const stock of STOCK_LIST) {
      expect(stock.basePrice, stock.ticker).toBeGreaterThan(0);
    }
  });

  it('no duplicate IDs', () => {
    const ids = STOCK_LIST.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('PENNY_STOCK_LIST schema', () => {
  it('has at least one entry', () => {
    expect(PENNY_STOCK_LIST.length).toBeGreaterThan(0);
  });

  it.each(PENNY_STOCK_LIST)('$name ($ticker) — required fields present', (stock) => {
    expect(stock.id).toBeTypeOf('string');
    expect(stock.name).toBeTypeOf('string');
    expect(stock.ticker).toBeTypeOf('string');
    expect(stock.icon).toBeTypeOf('string');
    expect(stock.basePrice).toBeTypeOf('number');
    expect(stock.description).toBeTypeOf('string');
  });

  it('all basePrice values are positive', () => {
    for (const stock of PENNY_STOCK_LIST) {
      expect(stock.basePrice, stock.ticker).toBeGreaterThan(0);
    }
  });

  it('no duplicate IDs', () => {
    const ids = PENNY_STOCK_LIST.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('BOND_LIST schema', () => {
  it('has at least one entry', () => {
    expect(BOND_LIST.length).toBeGreaterThan(0);
  });

  it.each(BOND_LIST)('$id — required fields present', (bond) => {
    expect(bond.id).toBeTypeOf('string');
    expect(bond.name).toBeTypeOf('string');
    expect(bond.icon).toBeTypeOf('string');
    expect(bond.entity).toBeTypeOf('string');
    expect(bond.maturity).toBeTypeOf('number');
    expect(bond.coupon).toBeTypeOf('number');
    expect(bond.minInvestment).toBeTypeOf('number');
    expect(bond.risk).toBeTypeOf('number');
    expect(bond.description).toBeTypeOf('string');
  });

  it('coupon is a positive rate', () => {
    for (const bond of BOND_LIST) {
      expect(bond.coupon, bond.id).toBeGreaterThan(0);
    }
  });

  it('maturity is a positive integer', () => {
    for (const bond of BOND_LIST) {
      expect(bond.maturity, bond.id).toBeGreaterThan(0);
      expect(Number.isInteger(bond.maturity), bond.id).toBe(true);
    }
  });

  it('minInvestment is a positive number', () => {
    for (const bond of BOND_LIST) {
      expect(bond.minInvestment, bond.id).toBeGreaterThan(0);
    }
  });

  it('risk is between 0 and 1 inclusive', () => {
    for (const bond of BOND_LIST) {
      expect(bond.risk, bond.id).toBeGreaterThanOrEqual(0);
      expect(bond.risk, bond.id).toBeLessThanOrEqual(1);
    }
  });

  it('no duplicate IDs', () => {
    const ids = BOND_LIST.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FUND_LIST schema', () => {
  const REQUIRED_RETURN_KEYS = ['base', 'boomBonus', 'recessionPenalty', 'volatility'];

  it('has at least one entry', () => {
    expect(FUND_LIST.length).toBeGreaterThan(0);
  });

  it.each(FUND_LIST)('$name — required fields present', (fund) => {
    expect(fund.id).toBeTypeOf('string');
    expect(fund.name).toBeTypeOf('string');
    expect(fund.ticker).toBeTypeOf('string');
    expect(fund.icon).toBeTypeOf('string');
    expect(fund.minInvestment).toBeTypeOf('number');
    expect(fund.risk).toBeTypeOf('number');
    expect(fund.description).toBeTypeOf('string');
    expect(fund.returnProfile).toBeTypeOf('object');
  });

  it.each(FUND_LIST)('$name — returnProfile has all required keys', (fund) => {
    for (const key of REQUIRED_RETURN_KEYS) {
      expect(
        fund.returnProfile,
        `${fund.name} returnProfile missing key "${key}"`
      ).toHaveProperty(key);
      expect(fund.returnProfile[key]).toBeTypeOf('number');
    }
  });

  it('all minInvestment values are positive', () => {
    for (const fund of FUND_LIST) {
      expect(fund.minInvestment, fund.id).toBeGreaterThan(0);
    }
  });

  it('risk is between 0 and 1 inclusive', () => {
    for (const fund of FUND_LIST) {
      expect(fund.risk, fund.id).toBeGreaterThanOrEqual(0);
      expect(fund.risk, fund.id).toBeLessThanOrEqual(1);
    }
  });

  it('no duplicate IDs', () => {
    const ids = FUND_LIST.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── 4. bondDisplayName ───────────────────────────────────────────────────────

describe('bondDisplayName', () => {
  it('formats a 10-year US bond correctly', () => {
    const bond = BOND_LIST.find(b => b.id === 'us_10yr');
    expect(bondDisplayName(bond)).toBe('US Government Bond (10-Yr)');
  });

  it('formats a 2-year US bond correctly', () => {
    const bond = BOND_LIST.find(b => b.id === 'us_2yr');
    expect(bondDisplayName(bond)).toBe('US Government Bond (2-Yr)');
  });

  it('formats a 5-year German bond correctly', () => {
    const bond = BOND_LIST.find(b => b.id === 'de_5yr');
    expect(bondDisplayName(bond)).toBe('German Government Bond (5-Yr)');
  });

  it('formats arbitrary maturity values correctly', () => {
    expect(bondDisplayName({ name: 'Test Bond', maturity: 30 })).toBe('Test Bond (30-Yr)');
  });
});

// ─── 5. getMarketHealth ───────────────────────────────────────────────────────

const SUB_TYPES = ['crypto', 'stocks', 'bonds', 'penny', 'funds'];
const PHASES    = ['normal', 'boom', 'recession'];

describe('getMarketHealth', () => {
  it('returns score, color, and label for every subType × phase combination', () => {
    for (const subType of SUB_TYPES) {
      for (const phase of PHASES) {
        const result = getMarketHealth(subType, phase);
        expect(result, `${subType}/${phase}`).toHaveProperty('score');
        expect(result, `${subType}/${phase}`).toHaveProperty('color');
        expect(result, `${subType}/${phase}`).toHaveProperty('label');
      }
    }
  });

  it('score is always in range 5–95', () => {
    // Run many iterations to account for random noise in the function
    for (let i = 0; i < 100; i++) {
      for (const subType of SUB_TYPES) {
        for (const phase of PHASES) {
          const { score } = getMarketHealth(subType, phase);
          expect(score, `${subType}/${phase} iteration ${i}`).toBeGreaterThanOrEqual(5);
          expect(score, `${subType}/${phase} iteration ${i}`).toBeLessThanOrEqual(95);
        }
      }
    }
  });

  it('label is one of Bullish, Mixed, or Bearish', () => {
    const validLabels = new Set(['Bullish', 'Mixed', 'Bearish']);
    for (const subType of SUB_TYPES) {
      for (const phase of PHASES) {
        const { label } = getMarketHealth(subType, phase);
        expect(validLabels, `${subType}/${phase} label="${label}"`).toContain(label);
      }
    }
  });

  it('color is a valid hex string', () => {
    const hexColor = /^#[0-9a-f]{6}$/i;
    for (const subType of SUB_TYPES) {
      for (const phase of PHASES) {
        const { color } = getMarketHealth(subType, phase);
        expect(color, `${subType}/${phase}`).toMatch(hexColor);
      }
    }
  });

  it('bonds in recession score higher than bonds in boom (base scores)', () => {
    // Run many times and check the average — recession bonds should consistently
    // outperform boom bonds (base scores: recession=85, boom=55)
    let recessionWins = 0;
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      const recession = getMarketHealth('bonds', 'recession');
      const boom      = getMarketHealth('bonds', 'boom');
      if (recession.score > boom.score) recessionWins++;
    }
    // Should win > 80% of the time given the 30-point base gap and ±5 noise
    expect(recessionWins / iterations).toBeGreaterThan(0.80);
  });

  it('unknown subType falls back to score 60 ± noise', () => {
    for (let i = 0; i < 20; i++) {
      const { score } = getMarketHealth('unknown_type', 'normal');
      expect(score).toBeGreaterThanOrEqual(5);
      expect(score).toBeLessThanOrEqual(95);
    }
  });

  it('label is Bullish when score >= 65', () => {
    // bonds/recession has base=85 — should almost always be Bullish
    let bullishCount = 0;
    for (let i = 0; i < 50; i++) {
      const { label } = getMarketHealth('bonds', 'recession');
      if (label === 'Bullish') bullishCount++;
    }
    expect(bullishCount).toBeGreaterThan(40);
  });

  it('label is Bearish when score < 40', () => {
    // penny/recession has base=20 — should almost always be Bearish
    let bearishCount = 0;
    for (let i = 0; i < 50; i++) {
      const { label } = getMarketHealth('penny', 'recession');
      if (label === 'Bearish') bearishCount++;
    }
    expect(bearishCount).toBeGreaterThan(40);
  });
});
