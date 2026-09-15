/** Game rules extracted from the state owner; keep runtime behavior here testable. */
import { calculateCapitalGainsTax, estimateInvestmentReturn } from '../../config/assetCatalog';

/** Mark-to-market only — do not also credit bank (avoids double-counting net worth). */
export function applyPaperInvestmentReturn(currentValue, ret) {
  return {
    newValue: Math.max(0, (currentValue ?? 0) + (ret ?? 0)),
    cashDelta: 0,
  };
}

export const INVESTMENT_SUBTYPE_ALIASES = {
  crypto: 'crypto',
  stock: 'stock',
  stocks: 'stock',
  penny: 'penny_stock',
  penny_stock: 'penny_stock',
  bond: 'bond',
  bonds: 'bond',
  fund: 'fund',
  funds: 'fund',
};

export function normalizeInvestmentSubType(subType) {
  return INVESTMENT_SUBTYPE_ALIASES[subType] ?? null;
}

export function prepareInvestmentPurchase(instrument, amountDollars, subType, bank) {
  if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument) || !instrument.id || !instrument.name) {
    return { ok: false, reason: 'invalid_instrument' };
  }
  const normalizedSubType = normalizeInvestmentSubType(subType);
  if (!normalizedSubType) return { ok: false, reason: 'invalid_subtype' };
  const amount = Math.floor(Number(amountDollars));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'invalid_amount' };
  if (!Number.isFinite(bank) || bank < amount) return { ok: false, reason: 'insufficient_funds' };

  const basePrice = Number(instrument.basePrice ?? 1);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return { ok: false, reason: 'invalid_instrument' };
  const minimum = Number(instrument.minInvestment ?? (instrument.basePrice ? Math.ceil(basePrice) : 1));
  if (!Number.isFinite(minimum) || minimum <= 0 || amount < minimum) {
    return { ok: false, reason: 'below_minimum' };
  }

  const units = normalizedSubType === 'bond' ? amount : Math.floor(amount / basePrice);
  if (!Number.isFinite(units) || units <= 0) return { ok: false, reason: 'below_minimum' };
  const pricePerUnit = normalizedSubType === 'bond' ? 1 : basePrice;
  const actualCost = normalizedSubType === 'bond' ? amount : units * pricePerUnit;
  if (!Number.isFinite(actualCost) || actualCost <= 0 || actualCost > bank) {
    return { ok: false, reason: 'insufficient_funds' };
  }
  return { ok: true, subType: normalizedSubType, amount, units, pricePerUnit, actualCost };
}

/** Investment sale settlement: bonds recover par early; others net CGT on realized gains. */
export function computeInvestmentSale(item, bank, cgtRate) {
  if (normalizeInvestmentSubType(item.subType) === 'bond') {
    const proceeds = Math.floor(item.purchasePrice ?? item.currentValue);
    return { isBond: true, proceeds, gain: 0, cgt: 0, newBank: bank + proceeds };
  }
  const gain = Math.floor(item.currentValue) - (item.purchasePrice ?? 0);
  const cgt = gain > 0 ? calculateCapitalGainsTax(item.purchasePrice ?? 0, item.currentValue, cgtRate) : 0;
  const proceeds = Math.floor(item.currentValue) - cgt;
  return { isBond: false, proceeds, gain, cgt, newBank: bank + proceeds };
}

/**
 * One market year for owned properties: investment holdings mark to market via
 * their return profile, real estate follows crash/boom/catalog appreciation,
 * and owned assets apply their passive stat effects. Randomness is injected
 * (marketCrash / marketBoom / randomFn) so the tick is testable.
 */
export function applyPropertyMarketTick(properties, stats, options = {}) {
  const {
    phase = 'normal',
    catalogMap = {},
    marketCrash = false,
    marketBoom = false,
    randomFn = Math.random,
  } = options;

  const nextStats = { ...stats };
  let totalUpkeep = 0;
  let investmentIncome = 0;

  const nextProperties = (properties ?? []).map(prop => {
    let newValue = prop.currentValue;
    if (prop.type === 'investment') {
      // Investments use returnProfile for annual gains/losses
      const ret = estimateInvestmentReturn({ ...prop }, phase, randomFn);
      newValue = Math.max(0, prop.currentValue + ret);
      investmentIncome += ret;
    } else if (marketCrash) {
      newValue = Math.floor(newValue * 0.7);
    } else if (marketBoom) {
      newValue = Math.floor(newValue * 1.3);
    } else {
      // Use catalog appreciation rate if available, else default +2–5%
      const rate = catalogMap[prop.catalogId]?.appreciationRate ?? (1 + (randomFn() * 0.03 + 0.02));
      newValue = Math.floor(newValue * rate);
    }
    totalUpkeep += prop.upkeep || 0;
    // Apply passive stat effects from owned assets
    const fx = catalogMap[prop.catalogId]?.statEffects ?? {};
    for (const [stat, delta] of Object.entries(fx)) {
      if (nextStats[stat] !== undefined) nextStats[stat] = Math.min(100, Math.max(0, nextStats[stat] + delta));
    }
    return { ...prop, currentValue: Math.max(0, newValue), yearsOwned: prop.yearsOwned + 1 };
  });

  return { properties: nextProperties, stats: nextStats, totalUpkeep, investmentIncome };
}
