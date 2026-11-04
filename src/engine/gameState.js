import { useCloudAccount } from './cloud/useCloudAccount';
import { preparePendingEvent, restoreLifeContinuity } from './lifeContinuity';
import { advanceLifeYear } from './annual/advanceLifeYear';
import { checkCareerEligibility as evaluateCareerEligibility } from './mechanics/careers';
import { useState, useCallback, useRef, useEffect } from 'react';
import { generateDynamicEvent } from './llmService';
import { getWealthTier } from '../config/wealthTiers';
import { calculateCapitalGainsTax } from '../config/assetCatalog';
import { PET_CATALOG } from '../config/petCatalog.js';
import { getCityById } from '../config/cityData.js';
import { createDiagnosticId, diagnosticNow, emitDiagnostic, emitLlmDiagnostic, getErrorClass } from './diagnostics';

import staticCareers from './careers.json';
import { quoteCareerChange, resolveCareerChange } from './actions/careerActions';
import { quoteEducationEnrollment, resolveEducationEnrollment } from './actions/educationActions';
import { makeActionResult } from './actions/actionResult';

import { INITIAL_STATS, INITIAL_EDUCATION, INITIAL_CAREER_META, INITIAL_ECONOMY, buildLifeSave } from './lifeSave';
import { NAMES, pickParentName, markAsEx, normalizeRelationshipNpc, prepareWillDraft, giftRelationshipGain } from './mechanics/relationships';
import { HEADHUNTER_COST, STARTUP_COST, MILITARY_ENLIST_CAREER_ID, canAffordHeadhunter, computeStartupLaunch, pickHeadhunterPlacement } from './mechanics/careers';
import { prepareInvestmentPurchase, computeInvestmentSale } from './mechanics/investments';
import { yearlyActivityTrackId, canConsumeYearlyActivity, computeGambleResult, executeTradePure } from './mechanics/activities';
import { prepareCharacterName } from './mechanics/character';
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
  const careerCatalogRef = useRef(careersData);
  careerCatalogRef.current = careersData;

  const [character, setCharacter] = useState(null);
  const [age, setAge] = useState(0);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [flags, setFlags] = useState([]);
  const [isDead, setIsDead] = useState(false);
  const [career, setCareer] = useState(null);
  const [bank, setBank] = useState(0);
  const [history, setHistory] = useState([]);
  const [currentEvent, setCurrentEventState] = useState(null);
  const currentEventRef = useRef(null);
  const setCurrentEvent = useCallback((event) => {
    currentEventRef.current = event;
    lifeSnapshotRef.current = { ...lifeSnapshotRef.current, currentEvent: event };
    setCurrentEventState(event);
  }, []);
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
  const [lastCareerAction, setLastCareerAction] = useState(null);
  const [lastEducationAction, setLastEducationAction] = useState(null);
  const [lastContinuitySave, setLastContinuitySave] = useState(null);
  // Transient lifecycle identity: never persisted or sent to narration.
  const lifeRevisionRef = useRef(0);
  const careerFeedbackRef = useRef(null);
  const educationFeedbackRef = useRef(null);
  const agingInFlightRef = useRef(false);
  const continuityFeedbackRef = useRef(null);
  const activeEventRequestRef = useRef(null);
  const ownsEventRequest = useCallback(request => (
    activeEventRequestRef.current === request && lifeRevisionRef.current === request.revision
  ), []);
  const invalidateLifeFeedback = useCallback(() => {
    lifeRevisionRef.current += 1;
    careerFeedbackRef.current = null;
    setLastCareerAction(null);
    educationFeedbackRef.current = null;
    setLastEducationAction(null);
    continuityFeedbackRef.current = null;
    setLastContinuitySave(null);
    activeEventRequestRef.current = null;
    agingInFlightRef.current = false;
    setIsAging(false);
  }, []);
  useEffect(() => () => {
    lifeRevisionRef.current += 1;
    careerFeedbackRef.current = null;
    educationFeedbackRef.current = null;
    continuityFeedbackRef.current = null;
    activeEventRequestRef.current = null;
    agingInFlightRef.current = false;
  }, []);
  /** Ready-life start/reset boundaries suppress obsolete cloud hydration; unread destinations are guarded. */
  const ignoreCloudLoadRef = useRef(false);
  /** Latest persisted-life fields; updated every render and eagerly inside persistLife. */
  const lifeSnapshotRef = useRef(buildLifeSave());
  lifeSnapshotRef.current = {
    character, age, stats, bank, history, isDead, flags, currentEvent, activitiesThisYear, career, careerMeta,
    relationships, belongings, properties, education, networking, economyCycle, pets, will,
  };

  /** Apply a cloud save document to local state — used at boot and on account switch. */
  const hydrateFromSave = useCallback((data) => {
    invalidateLifeFeedback();
    const continuity = restoreLifeContinuity(data, { newEventId: createDiagnosticId('pending-event') });
    lifeSnapshotRef.current = buildLifeSave({
      ...lifeSnapshotRef.current, ...data,
      stats: data.stats ? { grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0, ...data.stats } : lifeSnapshotRef.current.stats,
      education: { ...INITIAL_EDUCATION, ...data.education },
      careerMeta: { ...INITIAL_CAREER_META, ...data.careerMeta },
      economyCycle: { ...INITIAL_ECONOMY, ...data.economyCycle },
      flags: continuity.flags,
      activitiesThisYear: continuity.activitiesThisYear,
      currentEvent: continuity.currentEvent,
    });
    setFlags(continuity.flags);
    setActivitiesThisYear(continuity.activitiesThisYear);
    setCurrentEvent(continuity.currentEvent);
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
  }, [invalidateLifeFeedback, setCurrentEvent]);

  /** Clear the in-memory life only — no cloud write. Shared by resetLife and account changes. */
  const clearLocalLife = useCallback(() => {
    invalidateLifeFeedback();
    lifeSnapshotRef.current = buildLifeSave();
    agingInFlightRef.current = false;
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
  }, [invalidateLifeFeedback, setCurrentEvent]);

  const { syncToCloud, authAccount, cloudLoadState, retryCloudLoad, canReplaceLife, signInWithGoogle, signInWithEmail, resetPassword, signOutAccount } = useCloudAccount({
    hydrateFromSave, clearLocalLife, ignoreCloudLoadRef, setCareersData, lifeRevisionRef,
  });

  /**
   * Mid-life persist: always write a full buildLifeSave payload (merge).
   * Pass every field you just mutated as overrides — React setState has not flushed yet.
   * Eagerly updates lifeSnapshotRef so chained persists in the same tick stay consistent.
   * See docs/architecture.md — mid-life sync.
   */
  const persistLife = useCallback((overrides = {}) => {
    // A newer write supersedes domain feedback even when it has no status UI.
    // Guard the setter: legacy callers can persist inside a React updater.
    if (continuityFeedbackRef.current !== null) {
      continuityFeedbackRef.current = null;
      setLastContinuitySave(null);
    }
    const next = { ...lifeSnapshotRef.current, ...overrides };
    lifeSnapshotRef.current = next;
    return syncToCloud(buildLifeSave(next));
  }, [syncToCloud]);

  /** Track only the latest continuity write in this life; transport owns acknowledgement. */
  const persistContinuity = useCallback((overrides, kind) => {
    const revision = lifeRevisionRef.current;
    const feedback = { id: createDiagnosticId('continuity-save'), kind, saveStatus: 'pending', operationId: null };
    const persistence = persistLife(overrides);
    continuityFeedbackRef.current = feedback;
    setLastContinuitySave(feedback);
    persistence.then(receipt => {
      if (lifeRevisionRef.current !== revision || continuityFeedbackRef.current !== feedback) return;
      const acknowledged = { ...feedback, saveStatus: receipt.status, operationId: receipt.operationId };
      continuityFeedbackRef.current = acknowledged;
      setLastContinuitySave(acknowledged);
    });
    return persistence;
  }, [persistLife]);

  const isActionLocked = () => lifeSnapshotRef.current.isDead || agingInFlightRef.current || !!currentEventRef.current;

  /**
   * Live Again: clear local + full-replace cloud so App shows CharacterCreation.
   * Must not use location.reload() — that reloads isDead:true from Firestore.
   * See docs/architecture.md#death-restart-flow.
   */
  const resetLife = () => {
    if (!canReplaceLife()) return { status: 'rejected', code: 'account_load_blocked', persistence: null };
    ignoreCloudLoadRef.current = true;
    clearLocalLife();
    syncToCloud(buildLifeSave({ character: null, isDead: false }), { replace: true });
  };

  const startLife = (rawName, gender, country, cityId) => {
    const prepared = prepareCharacterName(rawName);
    if (!prepared.ok) return { status: 'rejected', code: prepared.reason, persistence: null };
    if (!canReplaceLife()) return { status: 'rejected', code: 'account_load_blocked', persistence: null };
    const { name } = prepared;
    invalidateLifeFeedback();
    agingInFlightRef.current = false;
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

    const newborn = buildLifeSave({
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
    });
    lifeSnapshotRef.current = newborn;
    syncToCloud(newborn, { replace: true });
  };

  const checkDeath = useCallback((currentStats, currentAge) => (
    checkDeathPure(currentStats, currentAge, Math.random())
  ), []);

  const handleChoice = (eventId, choiceIndex) => {
    const snap = lifeSnapshotRef.current;
    const event = snap.currentEvent;
    if (!event) return { status: 'noop', code: 'no_pending_event', persistence: null };
    if (event.id !== eventId || event.age !== snap.age) {
      return { status: 'rejected', code: 'stale_event', persistence: null };
    }
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= event.choices.length) {
      return { status: 'rejected', code: 'invalid_choice', persistence: null };
    }
    const choice = event.choices[choiceIndex];
    const recovery = event.source === 'recovery';
    const applied = recovery ? { stats: snap.stats, bank: snap.bank, flags: snap.flags }
      : applyEffectsPure(snap.stats, snap.bank, snap.flags, choice.effects);
    let nextRelationships = snap.relationships;

    const historyLines = [];

    if (event.isCustodyBattle && choice.custodyOutcome) {
      const { exId, childIds } = event;
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

    historyLines.push(recovery
      ? 'Recovery: Cleared an unavailable saved choice without applying an outcome.'
      : `Event: ${event.description} -> You chose: ${choice.text}`);
    const updatedHistory = [...snap.history, ...historyLines.map(text => ({ age: snap.age, text }))];
    const patch = { ...applied, relationships: nextRelationships, history: updatedHistory, currentEvent: null };

    // Clear the eager event lock before another callback can resolve this identity.
    setCurrentEvent(null);
    setStats(applied.stats);
    setBank(applied.bank);
    setFlags(applied.flags);
    setRelationships(nextRelationships);
    setHistory(updatedHistory);
    const persistence = persistContinuity(patch, 'event_resolved');
    return { status: 'committed', code: recovery ? 'event_cleared' : 'event_resolved', persistence };
  };

  const ageUp = useCallback(async () => {
    const snap = lifeSnapshotRef.current;
    if (snap.isDead || currentEventRef.current || agingInFlightRef.current) return;

    const request = { revision: lifeRevisionRef.current };
    activeEventRequestRef.current = request;
    agingInFlightRef.current = true;
    setIsAging(true);
    const transitionOperationId = createDiagnosticId('age-transition');
    const transitionStartedAt = diagnosticNow();
    emitDiagnostic('age_transition', {
      operationId: transitionOperationId,
      status: 'started',
      durationMs: 0,
      fromAge: snap.age,
      toAge: snap.age + 1,
    });

    try {
      const annual = advanceLifeYear(snap, { careersData });
      const {
        age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer,
        careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy,
        education: nextEducation, relationships: nextRelationships,
        properties: nextProperties, belongings: nextBelongings, pets: petUpdates,
      } = annual.state;

      // Commit eagerly for same-tick readers, without a pre-inference cloud checkpoint.
      lifeSnapshotRef.current = { ...snap, ...annual.state, activitiesThisYear: {}, currentEvent: null };
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
      if (died) {
        const updatedHistory = [...snap.history, { age: nextAge, text: `You passed away peacefully at age ${nextAge}.` }];
        setIsDead(true);
        setHistory(updatedHistory);
        setCurrentEvent(null);
        persistContinuity({ ...annual.state, isDead: true, activitiesThisYear: {}, currentEvent: null, history: updatedHistory }, 'year');
        emitDiagnostic('age_transition', {
          operationId: transitionOperationId,
          status: 'death',
          durationMs: diagnosticNow() - transitionStartedAt,
          fromAge: snap.age,
          toAge: nextAge,
        });
        return;
      }

      const dynamicEvent = await generateDynamicEvent({
        character: snap.character, age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, history: snap.history,
        // Preserve the existing request timing: family/pets and history precede their annual tick.
        narrativeMode, relationships: snap.relationships, pets: snap.pets, city: getCityById(snap.character?.city)?.name ?? null, education: nextEducation,
        economyPhase: nextEconomy?.phase,
      });
      if (!ownsEventRequest(request)) return;

      const event = preparePendingEvent(dynamicEvent || {
        description: 'LLM ERROR: Dynamic event generation returned no event.',
        choices: [{ text: 'Understood', effects: {} }],
      }, { id: createDiagnosticId('pending-event'), age: nextAge, source: 'annual', relationships: nextRelationships });
      const updatedHistory = [...snap.history, ...annual.history];
      setCurrentEvent(event);
      setHistory(updatedHistory);
      persistContinuity({ ...annual.state, activitiesThisYear: {}, currentEvent: event, history: updatedHistory }, 'year');
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'completed',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: snap.age,
        toAge: nextAge,
      });
    } catch (error) {
      if (!ownsEventRequest(request)) return;
      emitDiagnostic('age_transition', {
        operationId: transitionOperationId,
        status: 'failed',
        durationMs: diagnosticNow() - transitionStartedAt,
        fromAge: snap.age,
        toAge: snap.age + 1,
        errorClass: getErrorClass(error),
      });
      throw error;
    } finally {
      if (ownsEventRequest(request)) {
        activeEventRequestRef.current = null;
        agingInFlightRef.current = false;
        setIsAging(false);
      }
    }
  }, [checkDeath, persistContinuity, careersData, narrativeMode, setCurrentEvent, ownsEventRequest]);

  // ─── Career expansion helpers ────────────────────────────────────────────────

  const checkCareerEligibility = useCallback((careerEntry) => {
    return evaluateCareerEligibility(careerEntry, education, stats, networking, age);
  }, [age, education, networking, stats]);

  const quoteEducation = (degreeType) => quoteEducationEnrollment(lifeSnapshotRef.current, degreeType);

  /** Commit enrollment locally once; only the transport receipt reports saved. */
  const enrollInDegree = (degreeType, { actionId = createDiagnosticId('education-action'), expectedBasis = null } = {}) => {
    const result = agingInFlightRef.current || currentEventRef.current
      ? makeActionResult({ status: 'rejected', actionId, actionType: 'education.enroll', targetId: degreeType, code: 'action_locked' })
      : resolveEducationEnrollment(lifeSnapshotRef.current, { actionId, targetId: degreeType, expectedBasis });
    const feedback = { actionId, result, saveStatus: result.status === 'committed' ? 'pending' : 'not_requested' };
    // A repeated command must leave its committed decision's pending receipt visible.
    if (result.status === 'noop' && educationFeedbackRef.current?.saveStatus === 'pending') return { result, persistence: null };
    educationFeedbackRef.current = feedback;
    setLastEducationAction(feedback);
    if (result.status !== 'committed') return { result, persistence: null };

    const revision = lifeRevisionRef.current;
    setBank(result.patch.bank);
    setEducation(result.patch.education);
    setHistory(result.patch.history);
    const persistence = persistLife(result.patch);
    persistence.then(receipt => {
      if (lifeRevisionRef.current !== revision || educationFeedbackRef.current !== feedback) return;
      const acknowledged = { ...feedback, saveStatus: receipt.status };
      educationFeedbackRef.current = acknowledged;
      setLastEducationAction(acknowledged);
    });
    return { result, persistence };
  };

  const quoteCareer = (jobId) => quoteCareerChange(lifeSnapshotRef.current, jobId, careerCatalogRef.current);

  /** Resolve once, commit once, and expose the independent storage acknowledgment. */
  const chooseCareer = (jobId, { actionId = createDiagnosticId('career-action'), expectedBasis = null } = {}) => {
    const result = agingInFlightRef.current || currentEventRef.current
      ? makeActionResult({ status: 'rejected', actionId, actionType: 'career.choose', targetId: jobId, code: 'action_locked' })
      : resolveCareerChange(lifeSnapshotRef.current, { actionId, targetId: jobId, expectedBasis }, careerCatalogRef.current);
    const feedback = { actionId, result, saveStatus: result.status === 'committed' ? 'pending' : 'not_requested' };
    // Repeated commands must not hide the receipt for the committed decision.
    if (result.status === 'noop' && careerFeedbackRef.current?.saveStatus === 'pending') return { result, persistence: null };
    careerFeedbackRef.current = feedback;
    setLastCareerAction(feedback);
    if (result.status !== 'committed') return { result, persistence: null };

    const revision = lifeRevisionRef.current;
    // Never put a write inside React updater callbacks (which may be replayed).
    setCareer(result.patch.career);
    setCareerMeta(result.patch.careerMeta);
    setHistory(result.patch.history);
    const persistence = persistLife(result.patch);
    persistence.then(receipt => {
      if (lifeRevisionRef.current !== revision || careerFeedbackRef.current !== feedback) return;
      const acknowledged = { ...feedback, saveStatus: receipt.status };
      careerFeedbackRef.current = acknowledged;
      setLastCareerAction(acknowledged);
    });
    return { result, persistence };
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
    const snap = lifeSnapshotRef.current;
    const trackId = yearlyActivityTrackId(categoryId, item.text);
    if (item.yearlyLimit && !canConsumeYearlyActivity(snap.activitiesThisYear, categoryId, item.text, item.yearlyLimit)) {
      return 'blocked_yearly';
    }
    if (item.statGuard) {
      const { stat, op, value } = item.statGuard;
      const actual = snap.stats[stat] ?? 0;
      if (op === 'gte' && actual < value) return 'blocked_guard';
      if (op === 'lte' && actual > value) return 'blocked_guard';
    }
    const cost = item.cost ?? 0;
    if (cost > 0 && snap.bank < cost) return 'blocked_cost';
    let nextBank = cost > 0 ? snap.bank - cost : snap.bank;
    let nextStats = snap.stats;
    let nextFlags = snap.flags;
    if (item.baseEffects) {
      const applied = applyEffectsPure(nextStats, nextBank, nextFlags, item.baseEffects);
      nextStats = applied.stats;
      nextBank = applied.bank;
      nextFlags = applied.flags;
    }
    if (nextBank !== snap.bank) setBank(nextBank);
    if (item.baseEffects) {
      setStats(nextStats);
      setFlags(nextFlags);
    }
    const nextActivities = item.yearlyLimit
      ? { ...snap.activitiesThisYear, [trackId]: (snap.activitiesThisYear[trackId] ?? 0) + 1 }
      : snap.activitiesThisYear;
    if (item.yearlyLimit) setActivitiesThisYear(nextActivities);
    if (nextBank !== snap.bank || item.baseEffects || item.yearlyLimit) {
      persistContinuity({ bank: nextBank, stats: nextStats, flags: nextFlags, activitiesThisYear: nextActivities }, 'activity');
    }
    triggerActivityEvent(item.context);
    return 'ok';
  };

  const modifyRelationship = (id, delta) => {
    if (isActionLocked()) return;
    const snap = lifeSnapshotRef.current;
    const next = snap.relationships.map(r => r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r);
    const nextActivities = delta > 0 ? { ...snap.activitiesThisYear, [`rel_interact__${id}`]: 1 } : snap.activitiesThisYear;
    setRelationships(next);
    if (delta > 0) setActivitiesThisYear(nextActivities);
    persistContinuity({ relationships: next, activitiesThisYear: nextActivities }, 'activity');
  };

  const modifyProperty = (id, valueDelta) => {
    if (isActionLocked()) return;
    setProperties(prev => {
      const next = prev.map(p => p.id === id ? { ...p, currentValue: p.currentValue + valueDelta } : p);
      persistLife({ properties: next });
      return next;
    });
  };

  /** Accepted training owns its complete base save before the event acquires the lock. */
  const performSkillTraining = (item, categoryId) => {
    if (isActionLocked()) return { status: 'blocked_busy' };
    const skills = {
      gym: ['athleticism', 'Athleticism', 0],
      run: ['athleticism', 'Athleticism', 0],
      act_lesson: ['acting', 'Acting Skill', 50],
      voice_lesson: ['voice', 'Vocal Skill', 50],
      model_lesson: ['modeling', 'Modeling Skill', 50],
    };
    const training = skills[item?.specialAction];
    if (!training) return { status: 'blocked_skill' };
    const snap = lifeSnapshotRef.current;
    if (item.yearlyLimit && !canConsumeYearlyActivity(snap.activitiesThisYear, categoryId, item.text, item.yearlyLimit)) {
      return { status: 'blocked_yearly' };
    }
    if (item.statGuard) {
      const { stat, op, value } = item.statGuard;
      const actual = snap.stats[stat] ?? 0;
      if ((op === 'gte' && actual < value) || (op === 'lte' && actual > value)) return { status: 'blocked_guard' };
    }
    const [skill, displayName, defaultCost] = training;
    const cost = item.cost ?? defaultCost;
    const nextActivities = item.yearlyLimit
      ? { ...snap.activitiesThisYear, [yearlyActivityTrackId(categoryId, item.text)]: (snap.activitiesThisYear[yearlyActivityTrackId(categoryId, item.text)] ?? 0) + 1 }
      : snap.activitiesThisYear;
    // Preserve the existing slot-before-affordability ordering and insufficient-funds event.
    if (snap.bank < cost) {
      if (item.yearlyLimit) {
        setActivitiesThisYear(nextActivities);
        persistContinuity({ activitiesThisYear: nextActivities }, 'activity');
      }
      triggerActivityEvent("Tried to train skills, but couldn't afford the lessons.");
      return { status: 'blocked_cost' };
    }
    const gain = Math.floor(Math.random() * 6) + 3;
    const previous = snap.stats[skill] || 0;
    const nextStats = { ...snap.stats, [skill]: Math.min(100, previous + gain) };
    const nextBank = snap.bank - cost;
    setStats(nextStats);
    setBank(nextBank);
    setActivitiesThisYear(nextActivities);
    persistContinuity({ stats: nextStats, bank: nextBank, activitiesThisYear: nextActivities }, 'activity');
    triggerActivityEvent(item.context);
    return { status: 'ok', gain, previous, skill, displayName };
  };

  const trainHiddenSkill = (skill) => {
    if (isActionLocked()) return 0;
    let gain = Math.floor(Math.random() * 6) + 3;
    const currentStats = lifeSnapshotRef.current.stats;
    const nextStats = { ...currentStats, [skill]: Math.min(100, (currentStats[skill] || 0) + gain) };
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
    const snap = lifeSnapshotRef.current;
    const normalized = normalizeRelationshipNpc(npc, { asDating: true });
    const updatedRels = [...snap.relationships, normalized];
    const updatedHistory = [...snap.history, { age: snap.age, text: `Relationships: You are now dating ${normalized.name}.` }];
    const nextActivities = { ...snap.activitiesThisYear, [`rel_interact__${normalized.id}`]: 1 };
    setRelationships(updatedRels);
    setHistory(updatedHistory);
    setActivitiesThisYear(nextActivities);
    persistContinuity({ relationships: updatedRels, history: updatedHistory, activitiesThisYear: nextActivities }, 'activity');
  };

  /** Returns false while locked or exhausted; unrestricted activities need no counter save. */
  const consumeYearlyActivity = (categoryId, itemText, yearlyLimit) => {
    if (isActionLocked()) return false;
    const snap = lifeSnapshotRef.current;
    if (!canConsumeYearlyActivity(snap.activitiesThisYear, categoryId, itemText, yearlyLimit)) return false;
    if (!yearlyLimit) return true;
    const trackId = yearlyActivityTrackId(categoryId, itemText);
    const nextActivities = { ...snap.activitiesThisYear, [trackId]: (snap.activitiesThisYear[trackId] ?? 0) + 1 };
    setActivitiesThisYear(nextActivities);
    persistContinuity({ activitiesThisYear: nextActivities }, 'activity');
    return true;
  };

  // ─── Relationship engine functions ───────────────────────────────────────────

  const markRelInteraction = (id, counters) => ({ ...counters, [`rel_interact__${id}`]: 1 });

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
    const snap = lifeSnapshotRef.current;
    const rel = snap.relationships.find(r => r.id === id);
    if (!rel || (rel.status !== 'dating' && rel.status !== 'married')) return 'blocked';
    const wasMarried = rel.status === 'married';
    let divorceCostAmount = 0;
    let newBank = snap.bank;
    if (wasMarried) {
      divorceCostAmount = Math.min(50000, Math.max(5000, Math.floor(snap.bank * 0.15)));
      newBank = snap.bank - divorceCostAmount;

      const playerChildren = snap.relationships.filter(r => r.isAlive && r.type === 'Child');
      if (playerChildren.length > 0) {
        const childNamesStr = playerChildren.map(c => c.name).join(', ');
        const nextRelationships = snap.relationships.map(r => r.id === rel.id ? markAsEx(r) : r);
        const event = preparePendingEvent({
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
        }, { id: createDiagnosticId('pending-event'), age: snap.age, source: 'custody', relationships: nextRelationships });
        if (event?.source !== 'custody') return 'blocked';
        const nextStats = { ...snap.stats, happiness: Math.max(0, snap.stats.happiness - 15) };
        const updatedHistory = [...snap.history, {
          age: snap.age,
          text: `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.`,
        }];
        setBank(newBank);
        setStats(nextStats);
        setRelationships(nextRelationships);
        setHistory(updatedHistory);
        setCurrentEvent(event);
        persistContinuity({ bank: newBank, stats: nextStats, relationships: nextRelationships, history: updatedHistory, currentEvent: event }, 'event_offered');
        return 'ok';
      }

    }
    const nextStats = { ...snap.stats, happiness: Math.max(0, snap.stats.happiness - 15) };
    const nextRelationships = snap.relationships.map(r => r.id === id ? markAsEx(r) : r);
    const msg = wasMarried
      ? `Relationships: You divorced ${rel.name}. It cost $${divorceCostAmount.toLocaleString()} and left you heartbroken.`
      : `Relationships: You broke up with ${rel.name}. -15 Happiness.`;
    const updatedHistory = [...snap.history, { age: snap.age, text: msg }];
    setBank(newBank);
    setStats(nextStats);
    setRelationships(nextRelationships);
    setHistory(updatedHistory);
    persistLife({ bank: newBank, stats: nextStats, relationships: nextRelationships, history: updatedHistory });
    return 'ok';
  };

  const haveChild = (partnerId) => {
    if (isActionLocked()) return 'blocked_busy';
    const snap = lifeSnapshotRef.current;
    const partner = snap.relationships.find(r => r.id === partnerId);
    if (!partner || (partner.status !== 'married' && partner.status !== 'dating')) return 'blocked_partner';
    if (snap.age < 18 || snap.age > 55) return 'blocked_age';
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
    const nextRelationships = [...snap.relationships, child];
    const nextStats = { ...snap.stats, happiness: Math.min(100, snap.stats.happiness + 20) };
    const updatedHistory = [...snap.history, { age: snap.age, text: `Relationships: You and ${partner.name} welcomed a child, ${childName}! +20 Happiness. 👶` }];
    setRelationships(nextRelationships);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ relationships: nextRelationships, stats: nextStats, history: updatedHistory, bank: snap.bank });
    return 'ok';
  };

  const giftRelationship = (id, amount) => {
    const relationGain = giftRelationshipGain(amount);
    if (!relationGain || isActionLocked()) return 'blocked';
    const snap = lifeSnapshotRef.current;
    const rel = snap.relationships.find(r => r.id === id);
    if (!rel || snap.bank < amount) return 'blocked';
    const newBank = snap.bank - amount;
    const nextRelationships = snap.relationships.map(r => r.id === id
      ? { ...r, relation: Math.min(100, r.relation + relationGain) } : r);
    const nextActivities = markRelInteraction(id, snap.activitiesThisYear);
    const updatedHistory = [...snap.history, { age: snap.age, text: `Relationships: You gifted ${rel.name} $${amount.toLocaleString()}. +${relationGain} Relation.` }];
    setBank(newBank);
    setRelationships(nextRelationships);
    setActivitiesThisYear(nextActivities);
    setHistory(updatedHistory);
    persistContinuity({ relationships: nextRelationships, bank: newBank, activitiesThisYear: nextActivities, history: updatedHistory }, 'activity');
    return 'ok';
  };

  const meetFriend = () => {
    if (isActionLocked()) return;
    const snap = lifeSnapshotRef.current;
    const friendNames = ['Jordan', 'Casey', 'Morgan', 'Alex', 'Riley', 'Taylor', 'Sam', 'Drew', 'Quinn', 'Blake'];
    const friendName = friendNames[Math.floor(Math.random() * friendNames.length)];
    const friend = {
      id: `rel_${Date.now()}_friend`,
      type: 'Friend',
      name: friendName,
      age: snap.age + Math.floor(Math.random() * 10) - 5,
      relation: 40 + Math.floor(Math.random() * 30),
      status: 'friend',
      isAlive: true,
    };
    const nextRelationships = [...snap.relationships, friend];
    const nextStats = { ...snap.stats, happiness: Math.min(100, snap.stats.happiness + 5) };
    const updatedHistory = [...snap.history, { age: snap.age, text: `Relationships: You met a new friend, ${friendName}. +5 Happiness.` }];
    setRelationships(nextRelationships);
    setStats(nextStats);
    setHistory(updatedHistory);
    persistLife({ relationships: nextRelationships, stats: nextStats, history: updatedHistory, bank: snap.bank });
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
    if (isActionLocked()) return;
    const request = { revision: lifeRevisionRef.current };
    activeEventRequestRef.current = request;
    agingInFlightRef.current = true;
    setIsAging(true);
    const installOffer = raw => {
      const snap = lifeSnapshotRef.current;
      const event = preparePendingEvent(raw, {
        id: createDiagnosticId('pending-event'), age: snap.age, source: 'activity', relationships: snap.relationships,
      });
      setCurrentEvent(event);
      persistContinuity({ currentEvent: event }, 'event_offered');
    };
    try {
      const snap = lifeSnapshotRef.current;
      const stateDump = {
        character: snap.character, age: snap.age, bank: snap.bank, stats: snap.stats,
        career: snap.career, history: snap.history, narrativeMode, relationships: snap.relationships,
        pets: snap.pets, city: getCityById(snap.character?.city)?.name ?? null, education: snap.education, economyPhase: snap.economyCycle?.phase,
      };
      const parsed = await generateDynamicEvent(stateDump, context);
      if (!ownsEventRequest(request)) return;

      installOffer(parsed || {
        description: 'LLM ERROR: Dynamic activity event generation returned no event.',
        choices: [{ text: 'Understood', effects: {} }],
      });
    } catch {
      if (!ownsEventRequest(request)) return;
      emitLlmDiagnostic({ type: 'failure', code: 'service' });
      installOffer({
        description: 'LLM ERROR: Dynamic activity event generation failed. Please try again.',
        choices: [{ text: 'Understood', effects: {} }],
      });
    } finally {
      if (ownsEventRequest(request)) {
        activeEventRequestRef.current = null;
        agingInFlightRef.current = false;
        setIsAging(false);
      }
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
    const snap = lifeSnapshotRef.current;
    if (snap.bank < item.cost) return;
    const newBank = snap.bank - item.cost;
    const newAsset = {
      ...item,
      id: `${category}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      catalogId: item.id,       // retain reference for catalog lookups in ageUp
      currentValue: item.cost,
      purchasePrice: item.cost,
      yearsOwned: 0
    };
    const isProperty = category === 'property';
    const field = isProperty ? 'properties' : 'belongings';
    const nextAssets = [...snap[field], newAsset];
    const text = isProperty
      ? `Real Estate: Purchased a ${item.name} for $${item.cost.toLocaleString()}.`
      : `Shopping: Bought a ${item.name} for $${item.cost.toLocaleString()}.`;
    const updatedHistory = [...snap.history, { age: snap.age, text }];
    setBank(newBank);
    if (isProperty) setProperties(nextAssets);
    else setBelongings(nextAssets);
    setHistory(updatedHistory);
    persistLife({ bank: newBank, [field]: nextAssets, history: updatedHistory });
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
    cloudLoadState,
    retryCloudLoad,
    signInWithGoogle,
    signInWithEmail,
    resetPassword,
    signOutAccount,
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
    quoteCareer,
    lastCareerAction,
    quoteEducation,
    lastEducationAction,
    lastContinuitySave,
    checkCareerEligibility,
    enrollInDegree,
    attendNetworkingEvent,
    emigrate,
    performActivity,
    modifyRelationship,
    modifyProperty,
    trainHiddenSkill,
    performSkillTraining,
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
