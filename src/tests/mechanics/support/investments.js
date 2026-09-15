/** Investment test adapters. Only the explicitly marked net-worth mirror remains. */
import { advanceBelongingsYear } from '../../../engine/annual/belongings';


// Legacy mirror: the UI/estate net-worth aggregation is not yet a shared export.
export function calcNetWorth(bank, properties, belongings) {
  return Math.floor(bank
    + properties.reduce((s, p) => s + p.currentValue, 0)
    + belongings.reduce((s, b) => s + b.currentValue, 0));
}

/** Map a single owned instrument into the annual production batch API. */
export function processInvestmentYear(item, phase, randomFn = Math.random) {
  const year = advanceBelongingsYear([{ type: 'investment', yearsOwned: 0, ...item }], {}, { phase, randomFn });
  const holding = year.belongings[0];
  return {
    newValue: holding?.currentValue ?? 0,
    income: year.investmentIncome,
    matured: year.bondMaturities.length > 0,
    principal: year.bondMaturities[0]?.principal ?? 0,
    yearsToMaturity: holding?.yearsToMaturity,
  };
}

/** Preserve the historical explicit-roll signature with production RNG order. */
export function calcCryptoYear(item, phase, moonshotRoll, crashRoll, swingRoll) {
  const rolls = [crashRoll, moonshotRoll, swingRoll];
  return processInvestmentYear(item, phase, () => rolls.shift()).newValue;
}
