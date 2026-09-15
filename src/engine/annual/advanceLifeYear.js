import { getAllAssets } from '../../config/assetCatalog';
import { getCityById } from '../../config/cityData';
import { advanceDegreeYear, computeGradesDrift } from '../mechanics/education';
import { applyAgeUpDegradation } from '../mechanics/life';
import { applyStartupYear, computeCareerYearIncome, runPerformanceReview } from '../mechanics/careers';
import { computeLifestyleCost, processEconomyCycle } from '../mechanics/economy';
import { applyPropertyMarketTick } from '../mechanics/investments';
import { advanceBelongingsYear } from './belongings';
import { advancePetsYear } from './pets';
import { advanceRelationshipsYear } from './relationships';

/**
 * Calculate one year without React, persistence, or network calls.
 * The ordered domain passes and RNG consumption are part of the gameplay contract.
 * The hook owns death detection, event generation, committing state, and saving.
 */
export function advanceLifeYear(state, { careersData = [], randomFn = Math.random } = {}) {
  const { age, stats, bank, career, economyCycle, education, character, careerMeta, networking, belongings, properties, relationships, pets, activitiesThisYear } = state;
  const nextAge = age + 1;
  let nextStats = { ...stats };
  if (nextAge >= 5 && nextAge <= 22) {
    nextStats.grades = computeGradesDrift(nextStats.grades, nextStats.smarts);
  }
  let nextBank = bank;
  let nextCareer = career;
  let businessHistory = null;
  let educationHistory = null;

  // ── Economy cycle ─────────────────────────────────────────────────────────
  const nextEconomy = processEconomyCycle(economyCycle);

  // ── Auto high-school diploma at 18 ────────────────────────────────────────
  let nextEducation = { ...education };
  if (nextAge >= 18 && !nextEducation.highSchool) {
    nextEducation = { ...nextEducation, highSchool: true };
    educationHistory = `Education: You earned your High School Diploma!`;
  }

  // ── Process in-progress degree ────────────────────────────────────────────
  if (nextEducation.currentDegree) {
    const advanced = advanceDegreeYear(nextEducation, nextStats, nextBank);
    nextEducation = advanced.education;
    nextStats = advanced.stats;
    nextBank = advanced.bank;
    if (advanced.history) educationHistory = advanced.history;
  }

  nextStats = applyAgeUpDegradation(nextStats, nextAge);

  if (nextCareer) {
    if (nextCareer.id === 'founder') {
      const startupYear = applyStartupYear(nextCareer, randomFn());
      businessHistory = {
        bankrupt: "Your startup went bankrupt. You lost everything.",
        downturn: "Your startup had a tough year.",
        steady: "Your startup grew steadily.",
        moonshot: "Your startup valuation skyrocketed!",
      }[startupYear.outcome];

      if (!startupYear.career) {
        nextStats.happiness = Math.max(0, nextStats.happiness - 30);
        nextCareer = null;
      } else {
        nextCareer = startupYear.career;
        nextBank += startupYear.dividend;
        businessHistory += ` Valuation: $${startupYear.career.equity}. Dividend: $${startupYear.dividend}.`;
      }
    } else {
      const salaryMultiplier = getCityById(character?.city)?.salaryMultiplier ?? 1.0;
      const income = computeCareerYearIncome(nextCareer, nextStats, nextBank, salaryMultiplier);
      nextStats = income.stats;
      nextBank = income.bank;
      if (income.tax > 0) businessHistory = (businessHistory ? businessHistory + ' ' : '') + `Paid $${income.tax.toLocaleString()} in income tax (${Math.round(income.tax / income.grossSalary * 100)}% bracket).`;
    }
  }

  // ── Lifestyle cost (wealth tier expectation) ──────────────────────────────
  const colMultiplier = getCityById(character?.city)?.colMultiplier ?? 1.0;
  const lifestyle = computeLifestyleCost(nextBank, nextStats, colMultiplier);
  nextBank = lifestyle.bank;
  nextStats = lifestyle.stats;
  let lifestyleHistoryStr = null;
  if (lifestyle.cost > 0) {
    lifestyleHistoryStr = lifestyle.inDebt
      ? `Lifestyle: You can't maintain your ${lifestyle.tier.label} status. Went into debt paying $${lifestyle.cost.toLocaleString()} in lifestyle costs. −${lifestyle.tier.happinessPenalty} Happiness.`
      : `Lifestyle: Spent $${lifestyle.cost.toLocaleString()} maintaining your ${lifestyle.tier.label} lifestyle.`;
  }

  // ── Performance review & networking gain ──────────────────────────────────
  let nextCareerMeta = { ...careerMeta };
  let nextNetworking = networking;
  let reviewHistory  = null;

  if (nextCareer && nextCareer.id !== 'founder') {
    nextCareerMeta = { ...nextCareerMeta, yearsInRole: nextCareerMeta.yearsInRole + 1 };
    // Networking gain from job
    nextNetworking = Math.min(100, nextNetworking + (nextCareer.networking_gain ?? 0));

    const review = runPerformanceReview(nextStats, nextCareer, nextCareerMeta, nextNetworking, nextEconomy);
    reviewHistory = review.historyText;
    nextStats.happiness = Math.min(100, Math.max(0, nextStats.happiness + review.statEffects.happiness));
    nextCareerMeta = { ...nextCareerMeta, isOnPIP: review.setIsOnPIP, financialStressFlag: review.newFinancialStressFlag, unemploymentYearsLeft: review.unemploymentYears };

    if (review.outcome === 'promoted' && review.newCareer?.nextTierId) {
      // Resolve the promotion to the actual next-tier career object
      const promoted = careersData.find(c => c.id === nextCareer.nextTierId);
      if (promoted) {
        nextCareer = promoted;
        nextCareerMeta = { ...nextCareerMeta, yearsInRole: 0 };
      }
    } else if (review.outcome === 'raise' || review.outcome === 'no_change') {
      nextCareer = review.newCareer;
    } else if (review.outcome === 'fired') {
      nextCareer = null;
      nextCareerMeta = { ...nextCareerMeta, yearsInRole: 0 };
    }
  } else if (!nextCareer && nextCareerMeta.unemploymentYearsLeft > 0) {
    // Unemployment stipend
    const stipend = 4000;
    nextBank += stipend;
    nextCareerMeta = { ...nextCareerMeta, unemploymentYearsLeft: nextCareerMeta.unemploymentYearsLeft - 1 };
    reviewHistory = nextCareerMeta.unemploymentYearsLeft > 0
      ? `Unemployment: Received $${stipend.toLocaleString()} in benefits.`
      : `Unemployment: Benefits expired. Time to find work.`;
  }

  // Financial stress flag: unemployed and broke
  if (!nextCareer && nextBank < 0) nextCareerMeta = { ...nextCareerMeta, financialStressFlag: true };

  const marketCrash = randomFn() < 0.05;
  const marketBoom = !marketCrash && randomFn() < 0.10;

  // Resolve catalog appreciation rates for all owned assets
  const catalogMap = Object.fromEntries(getAllAssets().map(a => [a.id, a]));

  let investmentHistoryStr = null;

  const propertyTick = applyPropertyMarketTick(properties, nextStats, {
    phase: nextEconomy.phase,
    catalogMap,
    marketCrash,
    marketBoom,
    randomFn,
  });
  const nextProperties = propertyTick.properties;
  nextStats = propertyTick.stats;
  let totalUpkeep = propertyTick.totalUpkeep;
  let investmentIncome = propertyTick.investmentIncome;

  const holdings = advanceBelongingsYear(belongings, nextStats, { phase: nextEconomy.phase, catalogMap, randomFn });
  const nextBelongings = holdings.belongings;
  nextStats = holdings.stats;
  totalUpkeep += holdings.totalUpkeep;
  investmentIncome += holdings.investmentIncome;
  const bondMaturities = holdings.bondMaturities;

  // Add matured bond principals to bank + history
  for (const bond of bondMaturities) {
    nextBank += bond.principal;
    investmentHistoryStr = (investmentHistoryStr ? investmentHistoryStr + ' ' : '') + `Bond Maturity: ${bond.name} matured — principal of $${bond.principal.toLocaleString()} returned.`;
  }

  if (investmentIncome !== 0) {
    nextBank += investmentIncome;
    const incomeMsg = investmentIncome > 0
      ? `Investments: Your portfolio returned $${investmentIncome.toLocaleString()} this year.`
      : `Investments: Your portfolio lost $${Math.abs(investmentIncome).toLocaleString()} this year.`;
    investmentHistoryStr = investmentHistoryStr
      ? `${investmentHistoryStr} | ${incomeMsg}`
      : incomeMsg;
  }

  nextBank -= totalUpkeep;
  let upkeepHistoryStr = null;
  let marketHistoryStr = null;

  if (totalUpkeep > 0) {
    if (nextBank < 0) {
       nextStats.happiness = Math.max(0, nextStats.happiness - 20);
       upkeepHistoryStr = `Economy: You went into debt paying $${totalUpkeep.toLocaleString()} in maintenance fees!`;
    } else {
       upkeepHistoryStr = `Economy: Paid $${totalUpkeep.toLocaleString()} in property taxes and maintenance.`;
    }
  }

  if (marketCrash && properties.length > 0) marketHistoryStr = "Economy: The housing market crashed! Real estate shed 30% of its value.";
  if (marketBoom && properties.length > 0) marketHistoryStr = "Economy: A booming housing market skyrocketed your property values!";

  // ── Child support obligations ─────────────────────────────────────────────
  let childSupportTotal = 0;
  let childSupportHistoryStr = null;
  relationships.forEach(r => {
    if (r.childSupport && r.childSupport > 0) childSupportTotal += r.childSupport;
  });
  if (childSupportTotal > 0) {
    nextBank -= childSupportTotal;
    childSupportHistoryStr = `Family: Child support payments: -$${childSupportTotal.toLocaleString()}`;
  }

  // ── Pet lifecycle ─────────────────────────────────────────────────────────
  const petYear = advancePetsYear(pets, { randomFn });
  const { pets: petUpdates, maintenanceCost: petMaintenanceCost, happinessBonus: petHappinessBonus, deathMessages: petDeathMessages } = petYear;

  nextBank -= petMaintenanceCost;
  if (petHappinessBonus > 0) {
    nextStats.happiness = Math.min(100, nextStats.happiness + petHappinessBonus);
  }
  nextStats.happiness = Math.max(0, nextStats.happiness - petDeathMessages.length * 5);

  // ── Relationship passive decay, auto-breakup, parent death, jealousy ────────
  const relationshipYear = advanceRelationshipsYear(relationships, nextStats, { bank: nextBank, activitiesThisYear, randomFn });
  const nextRelationships = relationshipYear.relationships;
  nextStats = relationshipYear.stats;
  const relationshipEvents = relationshipYear.events;

  const updatedHistory = [];
  if (businessHistory) updatedHistory.push({ age: nextAge, text: `Business: ${businessHistory}` });
  if (investmentHistoryStr) updatedHistory.push({ age: nextAge, text: investmentHistoryStr });
  if (lifestyleHistoryStr) updatedHistory.push({ age: nextAge, text: lifestyleHistoryStr });
  if (educationHistory) updatedHistory.push({ age: nextAge, text: educationHistory });
  if (reviewHistory)   updatedHistory.push({ age: nextAge, text: reviewHistory });
  if (upkeepHistoryStr) updatedHistory.push({ age: nextAge, text: upkeepHistoryStr });
  if (marketHistoryStr) updatedHistory.push({ age: nextAge, text: marketHistoryStr });
  if (childSupportHistoryStr) updatedHistory.push({ age: nextAge, text: childSupportHistoryStr });
  for (const relEvent of relationshipEvents) {
    updatedHistory.push({ age: nextAge, text: relEvent });
  }
  for (const petMsg of petDeathMessages) {
    updatedHistory.push({ age: nextAge, text: petMsg });
  }
  if (petMaintenanceCost > 0) {
    updatedHistory.push({ age: nextAge, text: `Pets: Spent $${petMaintenanceCost.toLocaleString()} on pet care this year.` });
  }

  return {
    state: { age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy, education: nextEducation, relationships: nextRelationships, properties: nextProperties, belongings: nextBelongings, pets: petUpdates },
    history: updatedHistory,
  };
}
