import { estimateInvestmentReturn } from '../../config/assetCatalog';
import { normalizeInvestmentSubType, applyPaperInvestmentReturn } from '../mechanics/investments';

/** Annual holdings: paper returns stay in value; bonds pay cash and return principal once. */
export function advanceBelongingsYear(belongings, stats, { phase = 'normal', catalogMap = {}, randomFn = Math.random } = {}) {
  const nextStats = { ...stats };
  let totalUpkeep = 0;
  let investmentIncome = 0;
  const bondMaturities = []; // collect bond principal returns
  const nextBelongings = belongings.map(item => {
    let newValue = item.currentValue;
    const subType = item.type === 'investment' ? normalizeInvestmentSubType(item.subType) : null;
    if (item.type === 'investment') {
      if (subType === 'bond') {
        // Annual coupon income, then principal back at maturity
        const couponIncome = Math.floor((item.purchasePrice ?? 0) * (item.couponRate ?? 0.04));
        investmentIncome += couponIncome;
        const newYTM = (item.yearsToMaturity ?? 1) - 1;
        if (newYTM <= 0) {
          // Bond matures: principal returned, bond removed
          bondMaturities.push({ name: item.name, principal: item.purchasePrice ?? item.currentValue });
          return null; // will be filtered out below
        }
        return { ...item, subType, currentValue: item.purchasePrice ?? item.currentValue, yearsOwned: item.yearsOwned + 1, yearsToMaturity: newYTM };

      } else if (subType === 'crypto') {
        const vol = item.volatility ?? 0.60;
        const trend = ((item.trendiness ?? 0.5) - 0.5) * 0.30;
        const crashRoll = randomFn();
        const moonRoll  = randomFn();
        // Moonshot: small chance of insane multi (higher chance for ultra-volatile coins)
        if (vol >= 1.5 && moonRoll < 0.02) {
          const mult = 50 + randomFn() * 950; // 50x–1000x
          newValue = Math.floor(item.currentValue * mult);
        } else if (vol >= 0.80 && moonRoll < 0.015) {
          const mult = 5 + randomFn() * 95;   // 5x–100x
          newValue = Math.floor(item.currentValue * mult);
        // Crash: small chance of near-total wipe
        } else if (crashRoll < 0.05 + (vol - 0.6) * 0.1) {
          const survive = 0.02 + randomFn() * 0.18; // lose 80–98%
          newValue = Math.max(0, Math.floor(item.currentValue * survive));
        } else {
          let swing = (randomFn() * 2 - 1) * vol;
          if (phase === 'boom') swing += 0.20 + trend;
          if (phase === 'recession') swing -= 0.30;
          else swing += trend;
          newValue = Math.max(0, Math.floor(item.currentValue * (1 + swing)));
        }

      } else if (subType === 'stock') {
        let swing = (randomFn() * 2 - 1) * (item.volatility ?? 0.25);
        let rate = swing + (item.baseReturn ?? 0.08);
        if (phase === 'boom') rate += 0.10;
        if (phase === 'recession') rate -= 0.15;
        newValue = Math.max(0, Math.floor(item.currentValue * (1 + rate)));

      } else if (subType === 'penny_stock') {
        const roll = randomFn();
        if (roll < 0.12) {
          newValue = 0; // bankrupt
        } else if (roll < 0.22) {
          newValue = Math.floor(item.currentValue * (2 + randomFn() * 4)); // 2x–6x
        } else {
          const swing = (randomFn() - 0.45) * 0.70;
          newValue = Math.max(0, Math.floor(item.currentValue * (1 + swing)));
        }

      } else if (subType === 'fund' || item.returnProfile) {
        const ret = estimateInvestmentReturn({ ...item }, phase, randomFn);
        // Paper gain/loss only — do not also add to bank (net-worth double-count)
        newValue = applyPaperInvestmentReturn(item.currentValue, ret).newValue;

      } else {
        // Legacy catalog-based investment — same mark-to-market treatment
        const ret = estimateInvestmentReturn({ ...item }, phase, randomFn);
        newValue = applyPaperInvestmentReturn(item.currentValue, ret).newValue;
      }
    } else {
      // Non-investment belongings: use catalog appreciation rate
      const rate = catalogMap[item.catalogId]?.appreciationRate;
      if (rate) {
        newValue = Math.floor(item.currentValue * rate);
      } else if (item.type === 'luxury' || item.type === 'heirloom' || item.type === 'jewelry') {
        newValue = Math.floor(item.currentValue * 1.025);
      } else {
        newValue = Math.floor(item.currentValue * 0.85);
      }
    }
    totalUpkeep += item.upkeep || 0;
    const fx = catalogMap[item.catalogId]?.statEffects ?? {};
    for (const [stat, delta] of Object.entries(fx)) {
      if (nextStats[stat] !== undefined) nextStats[stat] = Math.min(100, Math.max(0, nextStats[stat] + delta));
    }
    return { ...item, subType: subType ?? item.subType, currentValue: Math.max(0, newValue), yearsOwned: item.yearsOwned + 1 };
  }).filter(Boolean); // remove matured bonds


  return { belongings: nextBelongings, stats: nextStats, totalUpkeep, investmentIncome, bondMaturities };
}
