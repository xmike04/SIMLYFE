import { useCloudAccount } from './cloud/useCloudAccount';
import { advanceLifeYear } from './annual/advanceLifeYear';
import { checkCareerEligibility as evaluateCareerEligibility } from './mechanics/careers';
import { useState, useCallback, useRef } from 'react';
import { generateDynamicEvent } from './llmService';
import { getWealthTier } from '../config/wealthTiers';
import { calculateCapitalGainsTax } from '../config/assetCatalog';
import { PET_CATALOG } from '../config/petCatalog.js';
import { getCityById } from '../config/cityData.js';
import { createDiagnosticId, diagnosticNow, emitDiagnostic, emitLlmDiagnostic, getErrorClass } from './diagnostics';

import staticCareers from './careers.json';

import { INITIAL_STATS, INITIAL_EDUCATION, INITIAL_CAREER_META, INITIAL_ECONOMY, buildLifeSave } from './lifeSave';
import { DEGREE_CONFIG, DEGREE_LABELS, enrollDegree } from './mechanics/education';
import { NAMES, pickParentName, markAsEx, normalizeRelationshipNpc, prepareWillDraft } from './mechanics/relationships';
import { HEADHUNTER_COST, STARTUP_COST, MILITARY_ENLIST_CAREER_ID, canAffordHeadhunter, computeStartupLaunch, pickHeadhunterPlacement } from './mechanics/careers';
import { prepareInvestmentPurchase, computeInvestmentSale } from './mechanics/investments';
import { yearlyActivityTrackId, canConsumeYearlyActivity, computeGambleResult, executeTradePure } from './mechanics/activities';
import { applyEffectsPure, checkDeathPure, generateInitialStats } from './mechanics/life';

// Historical named exports remain available; new callers should import their domain directly.
export { DEGREE_CONFIG, DEGREE_LABELS, hasRequiredDegree, enrollDegree, advanceDegreeYear, computeGradesDrift } from './mechanics/education';
export { pickParentName, findSpouse, markAsEx, normalizeRelationshipNpc, prepareWillDraft, computeEstateDistribution } from './mechanics/relationships';
export { LIFE_SAVE_KEYS, buildLifeSave } from './lifeSave';
export { applyPaperInvestmentReturn, normalizeInvestmentSubType, prepareInvestmentPurchase, computeInvestmentSale, applyPropertyMarketTick } from './mechanics/investments';
export { HEADHUNTER_COST, STARTUP_COST, MILITARY_ENLIST_CAREER_ID, canAffordHeadhunter, computeStartupLaunch, normalizeCareerEffect, applyCareerYearEffects, pickHeadhunterPlacement, applyStartupYear, computeCareerYearIncome } from './mechanics/careers';
export { yearlyActivityTrackId, canConsumeYearlyActivity, computeGambleResult, executeTradePure } from './mechanics/activities';
export { applyEffectsPure, checkDeathPure, applyAgeUpDegradation, generateInitialStats } from './mechanics/life';
export { summarizeAuthUser, prepareEmailCredential } from './cloud/authHelpers';
export { computeLifestyleCost } from './mechanics/economy';

export function useGameState() {
  const [careersData, setCareersData] = useState(staticCareers);

  const [character, setCharacter] = useState(null);
  const [age, setAge] = useState(0);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [flags, setFlags] = useState([]);
  const [isDead, setIsDead] = useState(false);
  const [career, setCareer] = useState(null);
  const [bank, setBank] = useState(0);
  const [history, setHistory] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [activitiesThisYear, setActivitiesThisYear] = useState({});
  const [relationships, setRelationships] = useState([]);
  const [belongings, setBelongings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [isAging, setIsAging] = useState(false);
  const [education, setEducation] = useState(INITIAL_EDUCATION);
  const [careerMeta, setCareerMeta] = useState(INITIAL_CAREER_META);
  const [networking, setNetworking] = useState(0);
  const [economyCycle, setEconomyCycle] = useState(INITIAL_ECONOMY);
  const [narrativeMode, setNarrativeMode] = useState(false);
  const [pets, setPets] = useState([]);
  const [will, setWill] = useState(null);
  /** When true, ignore a late cloud getDoc so startLife/resetLife win the race. */
  const ignoreCloudLoadRef = useRef(false);
  /** Latest persisted-life fields; updated every render and eagerly inside persistLife. */
  const lifeSnapshotRef = useRef(buildLifeSave());
  lifeSnapshotRef.current = {
    character, age, stats, bank, history, isDead, flags, career, careerMeta,
    relationships, belongings, properties, education, networking, economyCycle, pets, will,
  };

  /** Apply a cloud save document to local state — used at boot and on account switch. */
  const hydrateFromSave = useCallback((data) => {
    if (data.character) setCharacter(data.character);
    if (data.age !== undefined) setAge(data.age);
    if (data.stats) setStats({ grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, ...data.stats });
    if (data.bank !== undefined) setBank(data.bank);
    if (data.history) setHistory(data.history);
    if (data.isDead !== undefined) setIsDead(data.isDead);
    if (data.career !== undefined) setCareer(data.career);
    if (data.relationships) setRelationships(data.relationships);
    if (data.belongings) setBelongings(data.belongings);
    if (data.properties) setProperties(data.properties);
    if (data.education) setEducation({ ...INITIAL_EDUCATION, ...data.education });
    if (data.careerMeta) setCareerMeta({ ...INITIAL_CAREER_META, ...data.careerMeta });
    if (data.networking !== undefined) setNetworking(data.networking);
    if (data.economyCycle) setEconomyCycle({ ...INITIAL_ECONOMY, ...data.economyCycle });
    if (data.pets) setPets(data.pets);
    if (data.will !== undefined) setWill(data.will);
  }, []);

  /** Clear the in-memory life only — no cloud write. Shared by resetLife and account changes. */
  const clearLocalLife = useCallback(() => {
    setCharacter(null);
    setAge(0);
    setStats({ ...INITIAL_STATS });
    setFlags([]);
    setIsDead(false);
    setCareer(null);
    setBank(0);
    setHistory([]);
    setCurrentEvent(null);
    setActivitiesThisYear({});
    setRelationships([]);
    setBelongings([]);
    setProperties([]);
    setIsAging(false);
    setEducation({ ...INITIAL_EDUCATION });
    setCareerMeta({ ...INITIAL_CAREER_META });
    setNetworking(0);
    setEconomyCycle({ ...INITIAL_ECONOMY });
    setPets([]);
    setWill(null);
  }, []);

  const { syncToCloud, authAccount, signInWithGoogle, signInWithEmail, resetPassword, signOutAccount, requestAccountDeletion, reportGeneratedEvent } = useCloudAccount({
    hydrateFromSave, clearLocalLife, ignoreCloudLoadRef, setCareersData,
  });

  /**
   * Mid-life persist: always write a full buildLifeSave payload (merge).
   * Pass every field you just mutated as overrides — React setState has not flushed yet.
   * Eagerly updates lifeSnapshotRef so chained persists in the same tick stay consistent.
   * See docs/architecture.md — mid-life sync.
   */
  const persistLife = useCallback((overrides = {}) => {
    const next = { ...lifeSnapshotRef.current, ...overrides };
    lifeSnapshotRef.current = next;
    syncToCloud(buildLifeSave(next));
  }, [syncToCloud]);

  const isActionLocked = () => isDead || isAging || !!currentEvent;

  /**
   * Live Again: clear local + full-replace cloud so App shows CharacterCreation.
   * Must not use location.reload() — that reloads isDead:true from Firestore.
   * See docs/architecture.md#death-restart-flow.
   */
  const resetLife = () => {
    ignoreCloudLoadRef.current = true;
    clearLocalLife();
    syncToCloud(buildLifeSave({ character: null, isDead: false }), { replace: true });
  };

  const startLife = (name, gender, country, cityId) => {
    ignoreCloudLoadRef.current = true;
    const city = getCityById(cityId);
    const newChar = { name, gender, country, city: cityId ?? null };
    const initialStats = generateInitialStats();

    setCharacter(newChar);
    setAge(0);
    setStats(initialStats);
    setFlags([]);
    setIsDead(false);
    setCareer(null);
    setBank(0);
    setActivitiesThisYear({});
    setBelongings([]);
    setProperties([]);
    setEducation({ ...INITIAL_EDUCATION });
    setCareerMeta({ ...INITIAL_CAREER_META });
    setNetworking(0);
    setEconomyCycle({ ...INITIAL_ECONOMY });
    setPets([]);
    setWill(null);
    setIsAging(false);

    const lastName = name.split(' ').pop();
    const initialFamily = [
      { id: `rel_${Date.now()}_m`, type: "Mother", name: `${pickParentName('Mother')} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 70 + Math.floor(Math.random() * 30), status: 'family', isAlive: true },
      { id: `rel_${Date.now()}_f`, type: "Father", name: `${pickParentName('Father')} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 60 + Math.floor(Math.random() * 40), status: 'family', isAlive: true }
    ];
    const numSiblings = Math.floor(Math.random() * 4);
    for (let i=0; i<numSiblings; i++) {
       initialFamily.push({ id: `rel_${Date.now()}_s${i}_${Math.floor(Math.random() * 1000000)}`, type: "Sibling", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: Math.floor(Math.random() * 15), relation: 40 + Math.floor(Math.random() * 60), status: 'family', isAlive: true });
    }
    setRelationships(initialFamily);

    const cityLabel = city ? `${city.name}, ${country}` : country;
    const initialHistory = [{ age: 0, text: `You were born in ${cityLabel}. You are a ${gender} named ${name}.` }];
    setHistory(initialHistory);
    setCurrentEvent(null);

    syncToCloud(buildLifeSave({
      character: newChar,
      age: 0,
      stats: initialStats,
      bank: 0,
      history: initialHistory,
      isDead: false,
      flags: [],
      career: null,
      careerMeta: INITIAL_CAREER_META,
      relationships: initialFamily,
      belongings: [],
      properties: [],
      education: INITIAL_EDUCATION,
      networking: 0,
      economyCycle: INITIAL_ECONOMY,
      pets: [],
      will: null,
    }), { replace: true });
  };

  const checkDeath = useCallback((currentStats, currentAge) => (
    checkDeathPure(currentStats, currentAge, Math.random())
  ), []);

  const applyEffects = (effects) => {
    const applied = applyEffectsPure(stats, bank, flags, effects);
    setStats(applied.stats);
    setBank(applied.bank);
    setFlags(applied.flags);
    return applied;
  };

  const handleChoice = (choice) => {
    let nextStats = stats;
    let nextBank = bank;
    let nextFlags = flags;
    let nextRelationships = relationships;

    if (choice.effects) {
      const applied = applyEffects(choice.effects);
      nextStats = applied.stats;
      nextBank = applied.bank;
      nextFlags = applied.flags;
    }

    const historyLines = [];

    if (currentEvent?.isCustodyBattle && choice.custodyOutcome) {
      const { exId, childIds } = currentEvent;
      const childLabel = childIds.length > 1 ? 'children' : 'child';

      if (choice.custodyOutcome === 'fight') {
        const won = Math.random() < 0.8;
        if (won) {
          historyLines.push(`Legal: You won full custody of your ${childLabel}. The judge ruled in your favor.`);
        } else {
          historyLines.push(`Legal: You lost the custody battle. The judge awarded full custody to your ex.`);
          nextRelationships = nextRelationships.map(r => childIds.includes(r.id) ? { ...r, custodyWith: 'ex' } : r);
        }
      } else if (choice.custodyOutcome === 'negotiate') {
        historyLines.push(`Legal: Joint custody agreed. You pay $2,400/yr in child support.`);
        nextRelationships = nextRelationships.map(r => r.id === exId ? { ...r, childSupport: 2400 } : r);
      } else if (choice.custodyOutcome === 'surrender') {
        historyLines.push(`Legal: You signed away custody. You may see them on holidays.`);
        nextRelationships = nextRelationships.map(r => childIds.includes(r.id) ? { ...r, custodyWith: 'ex' } : r);
      }
    }

    historyLines.push(`Event: ${currentEvent.description} -> You chose: ${choice.text}`);
    const updatedHistory = [...history, ...historyLines.map(text => ({ age, text }))];

    if (nextRelationships !== relationships) setRelationships(nextRelationships);
    setHistory(updatedHistory);
    setCurrentEvent(null);
    persistLife({
      history: updatedHistory,
      stats: nextStats,
      bank: nextBank,
      flags: nextFlags,
      relationships: nextRelationships,
    });
  };

  const ageUp = useCallback(async () => {
    if (isDead || currentEvent || isAging) return;

    setIsAging(true);
    const transitionOperationId = createDiagnosticId('age-transition');
    const transitionStartedAt = diagnosticNow();
    emitDiagnostic('age_transition', {
      operationId: transitionOperationId,
      status: 'started',
      durationMs: 0,
      fromAge: age,
      toAge: age + 1,
    });

    try {
      const annual = advanceLifeYear({
        age, stats, bank, career, economyCycle, education, character, careerMeta,
        networking, belongings, properties, relationships, pets, activitiesThisYear,
      }, { careersData });
      const {
        age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer,
        careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy,
        education: nextEducation, relationships: nextRelationships,
        properties: nextProperties, belongings: nextBelongings, pets: petUpdates,
      } = annual.state;

      setAge(nextAge);
      setStats(nextStats);
      setBank(nextBank);
      setCareer(nextCareer);
      setCareerMeta(nextCareerMeta);
      setNetworking(nextNetworking);
      setEconomyCycle(nextEconomy);
      setEducation(nextEducation);
      setActivitiesThisYear({});
      setProperties(nextProperties);
      setBelongings(nextBelongings);
      setPets(petUpdates);
      setRelationships(nextRelationships);

      const died = checkDeath(nextStats, nextAge);

      let updatedHistory = [...history];
      if (died) {
        setIsDead(true);
        updatedHistory.push({ age: nextAge, text: `You passed away peacefully at age ${nextAge}.` });
        setHistory(updatedHistory);
        persistLife({
          age: nextAge,
          stats: nextStats,
          bank: nextBank,
          isDead: true,
          history: updatedHistory,
          belongings: nextBelongings,
          properties: nextProperties,
          career: nextCareer,
          careerMeta: nextCareerMeta,
          networking: nextNetworking,
          economyCycle: nextEconomy,
          education: nextEducation,
          relationships: nextRelationships,
          pets: petUpdates,
        });
        emitDiagnostic('age_transition', {
          operationId: transitionOperationId,
          status: 'death',
          durationMs: diagnosticNow() - transitionStartedAt,
          fromAge: age,
          toAge: nextAge,
        });
        return;
      }

      let eventTriggered = false;
      const dynamicEvent = await generateDynamicEvent({
        character, age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, history: updatedHistory,
        narrativeMode, relationships, pets, city: getCityById(character?.city)?.name ?? null, education: nextEducation,
        economyPhase: nextEconomy?.phase,
      });

      if (dynamicEvent && dynamicEvent.description && dynamicEvent.choices) {
        // Re-map format if necessary to ensure stability with UI
        const safeEvent = {
          description: dynamicEvent.description,
          meta: dynamicEvent.meta,
          choices: dynamicEvent.choices.map(c => ({
            text: c.text || "Continue",
            effects: c.effects || {}
          }))
        };
        setCurrentEvent(safeEvent);
        eventTriggered = true;
      } else {
        setCurrentEvent({
          description: 'LLM ERROR: Dynamic event generation returned no event.',
          choices: [{ text: 'Understood', effects: {} }],
        });
        eventTriggered = true;
      }

      if (!eventTriggered) {
        updatedHistory.push({ age: nextAge, text: `Age ${nextAge}: An uneventful year passed.` });
      }

      updatedHistory.push(...annual.history);

      setHistory(updatedHistory);

      persistLife({ age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy, education: nextEducation, history: updatedHistory, relationships: nextRelationships, properties: nextProperties, belongings: nextBelongings, pets: petUpdates });
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'completed',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: age,
        toAge: nextAge,
      });
    } catch (error) {
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'failed',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: age,
        toAge: age + 1,
        errorClass: getErrorClass(error),
      });
      throw error;
    } finally {
      setIsAging(false);
    }
  }, [age, stats, bank, isDead, currentEvent, career, careerMeta, networking, economyCycle, education, history, checkDeath, persistLife, isAging, character, relationships, properties, belongings, careersData, pets, activitiesThisYear, narrativeMode]);

  // ─── Career expansion helpers ────────────────────────────────────────────────

  const checkCareerEligibility = useCallback((careerEntry) => {
    return evaluateCareerEligibility(careerEntry, education, stats, networking, age);
  }, [age, education, networking, stats]);

  const enrollInDegree = (degreeType) => {
    if (isActionLocked()) return;
    const result = enrollDegree(degreeType, education, bank);
    if (result.error) {
      setHistory(prev => [...prev, { age, text: `Education: ${result.error}.` }]);
      return;
    }
    setBank(result.newBank);
    setEducation(result.newEducation);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Education: You enrolled in a ${DEGREE_LABELS[degreeType]} program (Year 1/${DEGREE_CONFIG[degreeType].years}).` }];
      persistLife({ education: result.newEducation, history: updated, bank: result.newBank });
      return updated;
    });
  };

  const chooseCareer = (jobId) => {
    if (isActionLocked()) return;
    if (jobId === null) {
      setCareer(null);
      const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: careerMeta.financialStressFlag };
      setCareerMeta(newMeta);
      setHistory(prev => {
        const updated = [...prev, { age, text: `You quit your current occupation.` }];
        persistLife({ history: updated, career: null, careerMeta: newMeta });
        return updated;
      });
      return;
    }
    const selected = careersData.find(c => c.id === jobId);
    if (!selected) return;
    const { eligible, reason } = checkCareerEligibility(selected);
    if (!eligible) {
      setHistory(prev => [...prev, { age, text: `Career: Can't apply — ${reason}.` }]);
      return;
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    setCareer(selected);
    setCareerMeta(newMeta);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Career: You got a job as a ${selected.title} ($${selected.salary.toLocaleString()}/yr).` }];
      persistLife({ history: updated, career: selected, careerMeta: newMeta });
      return updated;
    });
  };

  /**
   * performActivity — unified activity dispatcher.
   * @param {object} item  — the full ACTIVITY_MENUS item object
   * @param {string} categoryId — the parent category id (used as namespace for yearlyLimit tracking)
   * Handles: yearlyLimit gating, cost deduction, statGuard check, baseEffects, then LLM event.
   * Returns: 'blocked_yearly' | 'blocked_guard' | 'blocked_cost' | 'ok'
   */
  const performActivity = (item, categoryId) => {
    if (isActionLocked()) return 'blocked_busy';
    const trackId = yearlyActivityTrackId(categoryId, item.text);

    // 1. Per-year limit gate
    if (item.yearlyLimit && !canConsumeYearlyActivity(activitiesThisYear, categoryId, item.text, item.yearlyLimit)) {
      return 'blocked_yearly';
    }

    // 2. Stat guard
    if (item.statGuard) {
      const { stat, op, value } = item.statGuard;
      const actual = stats[stat] ?? 0;
      if (op === 'gte' && actual < value) return 'blocked_guard';
      if (op === 'lte' && actual > value) return 'blocked_guard';
    }

    // 3. Cost deduction + base effects (compute synchronously for cloud persist)
    const cost = item.cost ?? 0;
    if (cost > 0 && bank < cost) return 'blocked_cost';

    let nextBank = bank;
    let nextStats = stats;
    let nextFlags = flags;
    if (cost > 0) nextBank = bank - cost;
    if (item.baseEffects) {
      const applied = applyEffectsPure(nextStats, nextBank, nextFlags, item.baseEffects);
      nextStats = applied.stats;
      nextBank = applied.bank;
      nextFlags = applied.flags;
    }
    if (nextBank !== bank) setBank(nextBank);
    if (item.baseEffects) {
      setStats(nextStats);
      setFlags(nextFlags);
    }

    // 5. Track usage
    if (item.yearlyLimit) {
      setActivitiesThisYear(prev => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
    }

    if (nextBank !== bank || item.baseEffects) {
      persistLife({ bank: nextBank, stats: nextStats, flags: nextFlags });
    }

    // 6. Fire LLM event
    triggerActivityEvent(item.context);
    return 'ok';
  };

  const modifyRelationship = (id, delta) => {
    if (isActionLocked()) return;
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r);
      persistLife({ relationships: next });
      return next;
    });
    if (delta > 0) setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${id}`]: 1 }));
  };

  const modifyProperty = (id, valueDelta) => {
    if (isActionLocked()) return;
    setProperties(prev => {
      const next = prev.map(p => p.id === id ? { ...p, currentValue: p.currentValue + valueDelta } : p);
      persistLife({ properties: next });
      return next;
    });
  };

  const trainHiddenSkill = (skill) => {
    if (isActionLocked()) return 0;
    let gain = Math.floor(Math.random() * 6) + 3;
    const nextStats = { ...stats, [skill]: Math.min(100, (stats[skill] || 0) + gain) };
    setStats(nextStats);
    persistLife({ stats: nextStats });
    return gain;
  };

  const performGig = (name, payout) => {
    if (isActionLocked()) return;
    const newBank = bank + payout;
    const updatedHistory = [...history, { age, text: `Gig: You earned $${payout} from ${name}.` }];
    setBank(newBank);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const executeTrade = (percentage) => {
    if (isActionLocked()) return;
    const trade = executeTradePure(bank, percentage, Math.random());
    if (!trade.ok) return;
    const { wager, payout, profit, multiplier, bank: newBank } = trade;
    let msg = profit > 0 ? `Day Trade: Risked $${wager}, walked away with $${payout} (+$${profit}).` : `Day Trade: Risked $${wager} and lost $${Math.abs(profit)}.`;
    if (multiplier === 0) msg = `Day Trade: You risked $${wager} and got wiped out completely!`;
    const updatedHistory = [...history, { age, text: msg }];
    setBank(newBank);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const startStartup = () => {
    if (isActionLocked()) return 'blocked';
    const launch = computeStartupLaunch(bank, career);
    if (!launch.ok) return launch.reason;
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `You invested $${STARTUP_COST} and launched your own startup.` }];
    setBank(launch.newBank);
    setCareer(launch.career);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: launch.newBank, career: launch.career, careerMeta: newMeta });
    return 'ok';
  };

  /** Enlist via Military menu — places into soldier career track (branch is flavor in history). */
  const enlistMilitary = (branch = 'Army') => {
    if (isActionLocked()) return 'blocked';
    const soldier = careersData.find((c) => c.id === MILITARY_ENLIST_CAREER_ID);
    if (!soldier) return 'missing';
    const { eligible, reason } = checkCareerEligibility(soldier);
    if (!eligible) {
      const updatedHistory = [...history, { age, text: `Military: Couldn't enlist in the ${branch} — ${reason}.` }];
      setHistory(updatedHistory);
      persistLife({ history: updatedHistory });
      return 'ineligible';
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `Military: You enlisted in the ${branch} as a ${soldier.title}.` }];
    setCareer(soldier);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ career: soldier, careerMeta: newMeta, history: updatedHistory });
    triggerActivityEvent(`Enlisted in the ${branch} and began basic training as a ${soldier.title}.`);
    return 'ok';
  };

  /** Pay headhunter fee and take the highest-salary eligible full-time job. */
  const hireViaHeadhunter = () => {
    if (isActionLocked()) return 'blocked';
    if (!canAffordHeadhunter(bank)) return 'broke';
    const pick = pickHeadhunterPlacement(careersData, { age, education, stats, networking });
    const newBank = bank - HEADHUNTER_COST;
    if (!pick) {
      const updatedHistory = [...history, { age, text: `Career: Paid a headhunter $${HEADHUNTER_COST.toLocaleString()} but they found no roles you qualify for.` }];
      setBank(newBank);
      setHistory(updatedHistory);
      persistLife({ bank: newBank, history: updatedHistory });
      return 'no_match';
    }
    const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: false };
    const updatedHistory = [...history, { age, text: `Career: Headhunter placed you as a ${pick.title} (−$${HEADHUNTER_COST.toLocaleString()}).` }];
    setBank(newBank);
    setCareer(pick);
    setCareerMeta(newMeta);
    setHistory(updatedHistory);
    persistLife({ bank: newBank, career: pick, careerMeta: newMeta, history: updatedHistory });
    triggerActivityEvent(`Paid a headhunter $${HEADHUNTER_COST} who placed you in an executive-track role as a ${pick.title}.`);
    return 'ok';
  };

  const playLottery = (ticketCount = 1) => {
    if (isActionLocked()) return;
    const cost = 5 * ticketCount;
    if (bank < cost) return;
    let won = false;
    for (let i = 0; i < ticketCount; i++) { if (Math.random() < 0.00001) { won = true; break; } }
    const newBank = won ? bank - cost + 10000000 : bank - cost;
    const msg = won
      ? `Lottery: HOLY MOLY! You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} and WON $10,000,000!`
      : `Lottery: You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} ($${cost}) and lost.`;
    setBank(newBank);
    const updatedHistory = [...history, { age, text: msg }];
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank });
  };

  const studyHard = () => {
    if (isActionLocked()) return;
    const nextStats = {
      ...stats,
      happiness: Math.max(0, stats.happiness - 10),
      smarts: Math.min(100, stats.smarts + 2),
      grades: Math.min(100, stats.grades !== undefined ? stats.grades + 5 : 75),
    };
    const updatedHistory = [...history, { age, text: "You studied extremely hard for your classes." }];
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, stats: nextStats });
  };

  const goGamble = (amount) => {
    if (isActionLocked()) return 'blocked';
    const result = computeGambleResult(bank, amount, Math.random());
    if (!result.ok) return result.reason;
    let msg;
    if (result.outcome === 'win') {
      msg = `Casino: You gambled $${amount.toLocaleString()} and WON $${result.payout.toLocaleString()}!`;
    } else if (result.outcome === 'partial') {
      msg = `Casino: You gambled $${amount.toLocaleString()} and got half back ($${result.payout.toLocaleString()}).`;
    } else {
      msg = `Casino: You gambled $${amount.toLocaleString()} and lost it all.`;
    }
    const nextStats = { ...stats, happiness: Math.max(0, stats.happiness + result.happinessDelta) };
    const updatedHistory = [...history, { age, text: msg }];
    setBank(result.newBank);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: result.newBank, stats: nextStats });
    return result.outcome;
  };

  const visitDoctor = (visitType = 'checkup') => {
    if (isActionLocked()) return;
    const DOCTOR_VISITS = {
      checkup:   { cost: 100,  health: 15, happiness: 3,  label: 'General Checkup' },
      specialist: { cost: 500,  health: 25, happiness: 5,  label: 'Specialist Visit' },
      surgery:   { cost: 5000, health: 40, happiness: -5, label: 'Minor Surgery' },
      therapy:   { cost: 200,  health: 5,  happiness: 20, label: 'Therapy Session' },
    };
    const visit = DOCTOR_VISITS[visitType] ?? DOCTOR_VISITS.checkup;
    if (bank < visit.cost) return;
    const newBank = bank - visit.cost;
    const nextStats = {
      ...stats,
      health:    Math.min(100, stats.health    + visit.health),
      happiness: Math.min(100, Math.max(0, stats.happiness + visit.happiness)),
    };
    const updatedHistory = [...history, { age, text: `Doctor: Paid $${visit.cost.toLocaleString()} for a ${visit.label}. (+${visit.health} Health)` }];
    setBank(newBank);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank, stats: nextStats });
  };

  const addRelationship = (npc) => {
    if (isActionLocked()) return;
    const normalized = normalizeRelationshipNpc(npc, { asDating: true });
    const updatedRels = [...relationships, normalized];
    const updatedHistory = [...history, { age, text: `Relationships: You are now dating ${normalized.name}.` }];
    setRelationships(updatedRels);
    setHistory(updatedHistory);
    setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${normalized.id}`]: 1 }));
    persistLife({ relationships: updatedRels, history: updatedHistory });
  };

  /** Returns false if yearlyLimit already reached; otherwise increments the slot. */
  const consumeYearlyActivity = (categoryId, itemText, yearlyLimit) => {
    if (!canConsumeYearlyActivity(activitiesThisYear, categoryId, itemText, yearlyLimit)) return false;
    if (!yearlyLimit) return true;
    const trackId = yearlyActivityTrackId(categoryId, itemText);
    setActivitiesThisYear(prev => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
    return true;
  };

  // ─── Relationship engine functions ───────────────────────────────────────────

  const markRelInteraction = (id) => {
    setActivitiesThisYear(prev => ({ ...prev, [`rel_interact__${id}`]: 1 }));
  };

  const proposeMarriage = (id) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || rel.status !== 'dating' || rel.relation < 80 || age < 18) return 'blocked';
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: 'married', type: 'Spouse' } : r);
      persistLife({ relationships: next });
      return next;
    });
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You proposed to ${rel.name} and got married! 💍` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const breakUp = (id) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || (rel.status !== 'dating' && rel.status !== 'married')) return 'blocked';
    const wasMarried = rel.status === 'married';
    let divorceCostAmount = 0;
    let newBank = bank;
    if (wasMarried) {
      divorceCostAmount = Math.min(50000, Math.max(5000, Math.floor(bank * 0.15)));
      newBank = bank - divorceCostAmount;

      const playerChildren = relationships.filter(r => r.isAlive && r.type === 'Child');
      if (playerChildren.length > 0) {
        const childNamesStr = playerChildren.map(c => c.name).join(', ');
        setCurrentEvent({
          id: 'custody_battle',
          isCustodyBattle: true,
          exId: rel.id,
          childIds: playerChildren.map(c => c.id),
          description: `Your divorce from ${rel.name} has turned contentious. They're fighting for full custody of ${childNamesStr}. How do you respond?`,
          choices: [
            {
              text: 'Fight for full custody (hire lawyer, -$10,000)',
              effects: { bank: -10000 },
              custodyOutcome: 'fight',
            },
            {
              text: 'Negotiate joint custody (-$3,000, $2,400/yr child support)',
              effects: { bank: -3000 },
              custodyOutcome: 'negotiate',
            },
            {
              text: 'Let them have the kids',
              effects: { happiness: -20 },
              custodyOutcome: 'surrender',
            },
          ],
        });
        setBank(newBank);
        setStats(prev => ({ ...prev, happiness: Math.max(0, prev.happiness - 15) }));
        setRelationships(prev => {
          const next = prev.map(r => r.id === rel.id ? markAsEx(r) : r);
          persistLife({ relationships: next, bank: newBank });
          return next;
        });
        setHistory(prev => {
          const updated = [...prev, { age, text: `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.` }];
          persistLife({ history: updated });
          return updated;
        });
        return 'ok';
      }

      setBank(newBank);
    }
    setStats(prev => ({ ...prev, happiness: Math.max(0, prev.happiness - 15) }));
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? markAsEx(r) : r);
      persistLife({ relationships: next, ...(wasMarried ? { bank: newBank } : {}) });
      return next;
    });
    setHistory(prev => {
      const msg = wasMarried
        ? `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.`
        : `Relationships: You broke up with ${rel.name}. -15 Happiness.`;
      const updated = [...prev, { age, text: msg }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const haveChild = (partnerId) => {
    if (isActionLocked()) return 'blocked_busy';
    const partner = relationships.find(r => r.id === partnerId);
    if (!partner || (partner.status !== 'married' && partner.status !== 'dating')) return 'blocked_partner';
    if (age < 18 || age > 55) return 'blocked_age';
    const childNames = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Luna', 'Leo', 'Isla', 'Owen'];
    const childName = childNames[Math.floor(Math.random() * childNames.length)];
    const child = {
      id: `rel_${Date.now()}_child`,
      type: 'Child',
      name: childName,
      age: 0,
      relation: 90 + Math.floor(Math.random() * 10),
      status: 'family',
      isAlive: true,
    };
    setRelationships(prev => {
      const next = [...prev, child];
      persistLife({ relationships: next });
      return next;
    });
    setStats(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 20) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You and ${partner.name} welcomed a child, ${childName}! +20 Happiness. 👶` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const giftRelationship = (id, amount) => {
    if (isActionLocked()) return 'blocked';
    const rel = relationships.find(r => r.id === id);
    if (!rel || bank < amount) return 'blocked';
    const relationGain = amount >= 1000 ? 20 : amount >= 200 ? 10 : 5;
    const newBank = bank - amount;
    setBank(newBank);
    setRelationships(prev => {
      const next = prev.map(r => r.id === id
        ? { ...r, relation: Math.min(100, r.relation + relationGain) }
        : r
      );
      persistLife({ relationships: next, bank: newBank });
      return next;
    });
    markRelInteraction(id);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You gifted ${rel.name} $${amount.toLocaleString()}. +${relationGain} Relation.` }];
      persistLife({ history: updated });
      return updated;
    });
    return 'ok';
  };

  const meetFriend = () => {
    if (isActionLocked()) return;
    const friendNames = ['Jordan', 'Casey', 'Morgan', 'Alex', 'Riley', 'Taylor', 'Sam', 'Drew', 'Quinn', 'Blake'];
    const friendName = friendNames[Math.floor(Math.random() * friendNames.length)];
    const friend = {
      id: `rel_${Date.now()}_friend`,
      type: 'Friend',
      name: friendName,
      age: age + Math.floor(Math.random() * 10) - 5,
      relation: 40 + Math.floor(Math.random() * 30),
      status: 'friend',
      isAlive: true,
    };
    setRelationships(prev => {
      const next = [...prev, friend];
      persistLife({ relationships: next });
      return next;
    });
    setStats(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 5) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You met a new friend, ${friendName}. +5 Happiness.` }];
      persistLife({ history: updated });
      return updated;
    });
  };

  const surrender = () => {
    if (isAging) return;
    const nextStats = { ...stats, health: 0 };
    const updatedHistory = [...history, { age, text: `You surrendered to the void.` }];
    setStats(nextStats);
    setIsDead(true);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, stats: nextStats, isDead: true });
  };

  /**
   * Draft (or replace) the will. Empty allocations = standard even-split will.
   * DeathScreen settles the estate from this via computeEstateDistribution.
   */
  const draftWill = (allocations) => {
    if (isActionLocked()) return 'locked';
    const draft = prepareWillDraft(allocations, relationships);
    if (!draft.ok) return draft.reason;
    const nextWill = { allocations: draft.allocations, draftedAtAge: age };
    setWill(nextWill);
    persistLife({ will: nextWill });
    return 'ok';
  };

  const triggerActivityEvent = async (context) => {
    if (isDead || currentEvent || isAging) return;
    setIsAging(true);
    try {
      const cityName = getCityById(character?.city)?.name ?? null;
      const snap = lifeSnapshotRef.current;
      const stateDump = {
        character: snap.character, age: snap.age, bank: snap.bank, stats: snap.stats,
        career: snap.career, history: snap.history, narrativeMode, relationships: snap.relationships,
        pets: snap.pets, city: cityName, education: snap.education, economyPhase: snap.economyCycle?.phase,
      };
      const parsed = await generateDynamicEvent(stateDump, context);

      if (parsed && parsed.choices && parsed.description) {
        setCurrentEvent(parsed);
      } else {
        setCurrentEvent({
          description: 'LLM ERROR: Dynamic activity event generation returned no event.',
          choices: [{ text: 'Understood', effects: {} }],
        });
      }
    } catch {
      emitLlmDiagnostic({ type: 'failure', code: 'service' });
      setCurrentEvent({
        description: 'LLM ERROR: Dynamic activity event generation failed. Please try again.',
        choices: [{ text: 'Understood', effects: {} }],
      });
    } finally {
      setIsAging(false);
    }
  };

  const adoptPet = (speciesId) => {
    if (isActionLocked()) return;
    const petDef = PET_CATALOG[speciesId];
    if (!petDef) return;
    if (bank < petDef.adoptCost) {
      setHistory(prev => [...prev, { age, text: `Pets: You can't afford to adopt a ${petDef.species} ($${petDef.adoptCost.toLocaleString()}).` }]);
      return;
    }
    const petName = petDef.namePool[Math.floor(Math.random() * petDef.namePool.length)];
    const newPet = {
      id: Date.now().toString(),
      speciesId,
      name: petName,
      age: 0,
      health: 80,
      isAlive: true,
    };
    const nextPets = [...pets, newPet];
    const newBank = bank - petDef.adoptCost;
    const updatedHistory = [...history, { age, text: `Pets: You adopted a ${petDef.species} named ${petName}! 🐾` }];
    setBank(newBank);
    setPets(nextPets);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, pets: nextPets, bank: newBank });
  };

  const visitVet = (petId) => {
    if (isActionLocked()) return;
    const vetCost = 150;
    if (bank < vetCost) {
      setHistory(prev => [...prev, { age, text: `Pets: You can't afford the vet visit ($${vetCost}).` }]);
      return;
    }
    const newBank = bank - vetCost;
    const nextPets = pets.map(p => p.id === petId ? { ...p, health: Math.min(100, p.health + 20) } : p);
    const updatedHistory = [...history, { age, text: `Pets: Vet visit — +20 health. Cost: $${vetCost}.` }];
    setBank(newBank);
    setPets(nextPets);
    setHistory(updatedHistory);
    persistLife({ pets: nextPets, history: updatedHistory, bank: newBank });
  };

  const buyAsset = (category, item) => {
    if (isActionLocked()) return;
    if (bank < item.cost) return;
    const newBank = bank - item.cost;
    setBank(newBank);

    const newAsset = {
      ...item,
      id: `${category}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      catalogId: item.id,       // retain reference for catalog lookups in ageUp
      currentValue: item.cost,
      purchasePrice: item.cost,
      yearsOwned: 0
    };

    if (category === 'property') {
      setProperties(prev => {
        const next = [...prev, newAsset];
        persistLife({ properties: next, bank: newBank });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Real Estate: Purchased a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    } else {
      setBelongings(prev => {
        const next = [...prev, newAsset];
        persistLife({ belongings: next, bank: newBank });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Shopping: Bought a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    }
  };

  const sellAsset = (category, id) => {
    if (isActionLocked()) return;
    const isProperty = category === 'property';
    const asset = isProperty ? properties.find(p => p.id === id) : belongings.find(b => b.id === id);
    if (!asset) return;

    const tier = getWealthTier(bank);
    const cgt = calculateCapitalGainsTax(asset.purchasePrice ?? asset.cost ?? 0, asset.currentValue, tier.capitalGainsTaxRate ?? 0);
    const proceeds = Math.floor(asset.currentValue) - cgt;
    const gain = Math.floor(asset.currentValue) - (asset.purchasePrice ?? asset.cost ?? 0);

    const newBank = bank + proceeds;
    const gainStr = gain > 0 ? ` (+$${gain.toLocaleString()} gain, $${cgt.toLocaleString()} CGT)` : gain < 0 ? ` (loss of $${Math.abs(gain).toLocaleString()})` : '';
    const msg = `${isProperty ? 'Real Estate' : 'Assets'}: Sold ${asset.name} for $${Math.floor(asset.currentValue).toLocaleString()}${gainStr}. Net proceeds: $${proceeds.toLocaleString()}.`;
    const updatedHistory = [...history, { age, text: msg }];

    setBank(newBank);
    if (isProperty) {
      const next = properties.filter(p => p.id !== id);
      setProperties(next);
      setHistory(updatedHistory);
      persistLife({ properties: next, bank: newBank, history: updatedHistory });
    } else {
      const next = belongings.filter(b => b.id !== id);
      setBelongings(next);
      setHistory(updatedHistory);
      persistLife({ belongings: next, bank: newBank, history: updatedHistory });
    }
  };

  /**
   * Buy a variable-amount investment from the investments hub.
   * subType: 'crypto' | 'stock' | 'penny_stock' | 'bond' | 'fund'
   * instrument: one of the objects from investmentMarket.js
   * amountDollars: how much the player wants to invest
   */
  const buyInvestment = (instrument, amountDollars, subType) => {
    if (isActionLocked()) return 'blocked';
    const purchase = prepareInvestmentPurchase(instrument, amountDollars, subType, bank);
    if (!purchase.ok) return purchase.reason;
    const { subType: normalizedSubType, units, pricePerUnit, actualCost } = purchase;
    const newBank = bank - actualCost;

    const displayName = normalizedSubType === 'bond'
      ? `${instrument.name} (${instrument.maturity}-Yr)`
      : instrument.ticker
        ? `${instrument.name} (${instrument.ticker})`
        : instrument.name;

    const newInv = {
      id: `inv_${normalizedSubType}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      type: 'investment',
      subType: normalizedSubType,
      instrumentId: instrument.id,
      catalogId: instrument.id,
      name: displayName,
      icon: instrument.icon ?? '📊',
      units,
      pricePerUnit,
      currentPricePerUnit: pricePerUnit,
      purchasePrice: actualCost,
      currentValue: actualCost,
      yearsOwned: 0,
      upkeep: 0,
      couponRate: instrument.coupon ?? null,
      maturityYears: instrument.maturity ?? null,
      yearsToMaturity: instrument.maturity ?? null,
      entity: instrument.entity ?? null,
      volatility: instrument.volatility ?? 0,
      trendiness: instrument.trendiness ?? 0,
      baseReturn: instrument.baseReturn ?? 0,
      returnProfile: instrument.returnProfile ?? null,
      sector: instrument.sector ?? null,
    };

    const nextBelongings = [...belongings, newInv];
    const unitsLabel = normalizedSubType === 'bond'
      ? `$${actualCost.toLocaleString()} principal`
      : `${units.toLocaleString()} units @ $${pricePerUnit.toLocaleString()}`;
    const updatedHistory = [...history, { age, text: `Investing: Bought ${displayName} — ${unitsLabel}.` }];
    setBank(newBank);
    setBelongings(nextBelongings);
    setHistory(updatedHistory);
    persistLife({ belongings: nextBelongings, bank: newBank, history: updatedHistory });
    return 'ok';
  };

  const sellInvestment = (belongingId) => {
    if (isActionLocked()) return;
    const item = belongings.find(b => b.id === belongingId);
    if (!item) return;

    const tier = getWealthTier(bank);
    const sale = computeInvestmentSale(item, bank, tier.capitalGainsTaxRate ?? 0);
    let historyNote;

    if (sale.isBond) {
      historyNote = `Sold ${item.name} early — recovered $${sale.proceeds.toLocaleString()} principal.`;
    } else {
      const gainStr = sale.gain > 0 ? ` (+$${sale.gain.toLocaleString()} gain, $${sale.cgt.toLocaleString()} CGT)` : sale.gain < 0 ? ` (loss of $${Math.abs(sale.gain).toLocaleString()})` : '';
      historyNote = `Sold ${item.name} for $${Math.floor(item.currentValue).toLocaleString()}${gainStr}. Net: $${sale.proceeds.toLocaleString()}.`;
    }

    const newBank = sale.newBank;
    const nextBelongings = belongings.filter(b => b.id !== belongingId);
    const updatedHistory = [...history, { age, text: `Investing: ${historyNote}` }];
    setBank(newBank);
    setBelongings(nextBelongings);
    setHistory(updatedHistory);
    persistLife({ belongings: nextBelongings, bank: newBank, history: updatedHistory });
  };

  const attendNetworkingEvent = () => {
    if (isActionLocked()) return;
    if (bank < 200) return;
    const newBank = bank - 200;
    const nextNetworking = Math.min(100, networking + 5);
    const nextStats = { ...stats, happiness: Math.min(100, stats.happiness + 2) };
    const updatedHistory = [...history, { age, text: `Career: Attended a networking event (+5 Networking). Cost $200.` }];
    setBank(newBank);
    setNetworking(nextNetworking);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ history: updatedHistory, bank: newBank, networking: nextNetworking, stats: nextStats });
    triggerActivityEvent('Attended a professional networking mixer to meet industry contacts.');
  };

  const emigrate = (cityId) => {
    if (isActionLocked()) return;
    const city = getCityById(cityId);
    if (!city) return;
    if (bank < city.moveCost) {
      setHistory(prev => [...prev, { age, text: `You can't afford to move to ${city.name} (costs $${city.moveCost.toLocaleString()}).` }]);
      return;
    }
    const newBank = bank - city.moveCost;
    const nextChar = { ...character, city: cityId, country: city.country };
    const updatedHistory = [...history, { age, text: `✈️ You moved to ${city.name}, ${city.country}. New chapter begins.` }];
    setBank(newBank);
    setCharacter(nextChar);
    setHistory(updatedHistory);
    persistLife({ character: nextChar, bank: newBank, history: updatedHistory });
  };

  const debugGrantDegree = (degreeType) => {
    setEducation(prev => {
      const next = { ...prev, [degreeType]: true };
      persistLife({ education: next });
      return next;
    });
  };

  const debugSetEconomy = (phase) => {
    const next = { year: economyCycle.year, phase, yearsInPhase: 0 };
    setEconomyCycle(next);
    persistLife({ economyCycle: next });
  };

  const debugAddNetworking = (amount) => {
    setNetworking(prev => {
      const next = Math.min(100, prev + amount);
      persistLife({ networking: next });
      return next;
    });
  };

  const debugModifyBank = (amount) => {
    setBank(prev => prev + amount);
    persistLife({ bank: bank + amount });
  };

  const debugAddAge = (years) => {
    setAge(prev => prev + years);
    setProperties(prev => prev.map(p => ({ ...p, yearsOwned: p.yearsOwned + years })));
    setBelongings(prev => prev.map(b => ({ ...b, yearsOwned: b.yearsOwned + years })));
    persistLife({ age: age + years });
    setHistory(prev => [...prev, { age: age+years, text: `[DEV] Fast-forwarded time by ${years} years.` }]);
  };

  const debugMaxStats = () => {
    setStats(prev => {
      const max = { ...prev, health: 100, happiness: 100, smarts: 100, looks: 100, grades: 100, athleticism: 100, karma: 100, acting: 100, voice: 100, modeling: 100 };
      persistLife({ stats: max });
      return max;
    });
  };

  return {
    character,
    age,
    stats,
    bank,
    flags,
    isDead,
    career,
    careersData,
    careerMeta,
    networking,
    economyCycle,
    education,
    history,
    currentEvent,
    activitiesThisYear,
    isAging,
    relationships,
    belongings,
    properties,
    pets,
    will,
    draftWill,
    authAccount,
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    signOutAccount,
    requestAccountDeletion,
    reportGeneratedEvent,
    adoptPet,
    visitVet,
    buyAsset,
    sellAsset,
    debugModifyBank,
    debugAddAge,
    debugMaxStats,
    debugGrantDegree,
    debugSetEconomy,
    debugAddNetworking,
    startLife,
    resetLife,
    ageUp,
    handleChoice,
    chooseCareer,
    checkCareerEligibility,
    enrollInDegree,
    attendNetworkingEvent,
    emigrate,
    performActivity,
    modifyRelationship,
    modifyProperty,
    trainHiddenSkill,
    performGig,
    executeTrade,
    startStartup,
    enlistMilitary,
    hireViaHeadhunter,
    playLottery,
    studyHard,
    goGamble,
    visitDoctor,
    surrender,
    addRelationship,
    proposeMarriage,
    breakUp,
    haveChild,
    giftRelationship,
    meetFriend,
    consumeYearlyActivity,
    buyInvestment,
    sellInvestment,
    triggerActivityEvent,
    narrativeMode,
    setNarrativeMode,
  };
}
