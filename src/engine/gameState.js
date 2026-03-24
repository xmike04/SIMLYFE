import { useState, useCallback, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { generateDynamicEvent } from './llmService';

import staticEvents from './events.json';
import staticCareers from './careers.json';

const INITIAL_STATS = { health: 80, happiness: 80, smarts: 50, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 };
const NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];

export const DEGREE_CONFIG = {
  highSchool: { years: 0,  annualCost: 0,     requires: null,         happinessEffect: 0   },
  associate:  { years: 2,  annualCost: 10000,  requires: 'highSchool', happinessEffect: 0   },
  bachelor:   { years: 4,  annualCost: 20000,  requires: 'highSchool', happinessEffect: 0   },
  master:     { years: 2,  annualCost: 30000,  requires: 'bachelor',   happinessEffect: 0   },
  phd:        { years: 4,  annualCost: 0,      requires: 'master',     happinessEffect: -20 },
};

export const DEGREE_LABELS = {
  highSchool: 'HS Diploma',
  associate:  "Associate's Degree",
  bachelor:   "Bachelor's Degree",
  master:     "Master's Degree",
  phd:        'PhD',
};

const INITIAL_EDUCATION = { highSchool: false, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };
const INITIAL_CAREER_META = { yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 };
const INITIAL_ECONOMY = { year: 0, phase: 'normal', yearsInPhase: 0 };

export function useGameState() {
  const [userId, setUserId] = useState(null);
  const [eventsData, setEventsData] = useState(staticEvents);
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

  // 1. Initialize anonymous auth and load cloud datastores if configured
  useEffect(() => {
    if (auth && db) {
      signInAnonymously(auth)
        .then(async cred => {
          setUserId(cred.user.uid);
          try {
            const saveRef = doc(db, 'users', cred.user.uid, 'saves', 'currentLife');
            const saveSnap = await getDoc(saveRef);
            if (saveSnap.exists()) {
              const data = saveSnap.data();
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
            }
          } catch (e) {
            console.error("Failed to load save:", e);
          }
        })
        .catch(err => console.error("Firebase Auth Error:", err));

      // Attempt to load remote events & careers instead of static
      getDocs(collection(db, 'events')).then(snapshot => {
        if (!snapshot.empty) setEventsData(snapshot.docs.map(skip => skip.data()));
      }).catch(console.error);

      getDocs(collection(db, 'careers')).then(snapshot => {
        if (!snapshot.empty) setCareersData(snapshot.docs.map(skip => skip.data()));
      }).catch(console.error);
    }
  }, []);

  // 2. Sync to Cloud
  const syncToCloud = useCallback(async (stateData) => {
    if (!db || !userId) return;
    try {
      const saveRef = doc(db, 'users', userId, 'saves', 'currentLife');
      await setDoc(saveRef, stateData, { merge: true });
    } catch (e) {
      console.error("Cloud sync failed:", e);
    }
  }, [userId]);

  const startLife = (name, gender, country) => {
    const newChar = { name, gender, country };
    const initialStats = {
      health: 80 + Math.floor(Math.random() * 20),
      happiness: 80 + Math.floor(Math.random() * 20),
      smarts: 40 + Math.floor(Math.random() * 40),
      looks: 40 + Math.floor(Math.random() * 40),
      grades: 70 + Math.floor(Math.random() * 20),
      athleticism: 30 + Math.floor(Math.random() * 60),
      karma: 50,
      acting: 0,
      voice: 0,
      modeling: 0
    };

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
    setEducation(INITIAL_EDUCATION);
    setCareerMeta(INITIAL_CAREER_META);
    setNetworking(0);
    setEconomyCycle(INITIAL_ECONOMY);
    
    const lastName = name.split(' ').pop();
    const initialFamily = [
      { id: `rel_${Date.now()}_m`, type: "Mother", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 70 + Math.floor(Math.random() * 30) },
      { id: `rel_${Date.now()}_f`, type: "Father", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 60 + Math.floor(Math.random() * 40) }
    ];
    const numSiblings = Math.floor(Math.random() * 4);
    for (let i=0; i<numSiblings; i++) {
       initialFamily.push({ id: `rel_${Date.now()}_s${i}_${Math.floor(Math.random() * 1000000)}`, type: "Sibling", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: Math.floor(Math.random() * 15), relation: 40 + Math.floor(Math.random() * 60) });
    }
    setRelationships(initialFamily);
    
    const initialHistory = [{ age: 0, text: `You were born in ${country}. You are a ${gender} named ${name}.` }];
    setHistory(initialHistory);
    setCurrentEvent(null);

    syncToCloud({ character: newChar, age: 0, stats: initialStats, bank: 0, history: initialHistory, isDead: false, relationships: initialFamily, belongings: [], properties: [], education: INITIAL_EDUCATION, careerMeta: INITIAL_CAREER_META, networking: 0, economyCycle: INITIAL_ECONOMY });
  };

  const checkDeath = useCallback((currentStats, currentAge) => {
    if (currentStats.health <= 0) return true;
    if (currentAge >= 60) {
      const chance = (currentAge - 60) / 40; // 0% at 60, 100% at 100
      if (Math.random() < chance) return true;
    }
    return false;
  }, []);

  const applyEffects = (effects) => {
    setStats((prevStats) => {
      const newStats = { ...prevStats };
      const statKeys = ['health', 'happiness', 'smarts', 'looks', 'athleticism', 'karma', 'acting', 'voice', 'modeling', 'grades'];
      for (const key of statKeys) {
        if (effects[key] != null) {
          newStats[key] = Math.min(100, Math.max(0, (newStats[key] ?? 0) + effects[key]));
        }
      }
      return newStats;
    });

    if (effects.bank) setBank(prev => prev + effects.bank);

    if (effects.flags) {
      setFlags((prev) => [...new Set([...prev, ...effects.flags])]);
    }
  };

  const handleChoice = (choice) => {
    if (choice.effects) applyEffects(choice.effects);
    
    setHistory((prev) => {
      const updated = [...prev, { age, text: `Event: ${currentEvent.description} -> You chose: ${choice.text}` }];
      syncToCloud({ history: updated }); // sync incremental choice
      return updated;
    });
    setCurrentEvent(null);
  };

  const triggerRandomEvent = useCallback((nextAge) => {
    const possibleEvents = eventsData.filter(e => nextAge >= e.minAge && nextAge <= e.maxAge);
    if (possibleEvents.length > 0) {
      if (Math.random() > 0.4 || nextAge < 4) {
        const evt = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
        setCurrentEvent(evt);
        return true;
      }
    }
    return false;
  }, [eventsData]);

  const ageUp = useCallback(async () => {
    if (isDead || currentEvent || isAging) return;

    setIsAging(true);
    const nextAge = age + 1;
    let nextStats = { ...stats };
    if (nextAge >= 5 && nextAge <= 22) {
      if (nextStats.smarts > 70) nextStats.grades = Math.min(100, (nextStats.grades || 70) + 2);
      else if (nextStats.smarts < 40) nextStats.grades = Math.max(0, (nextStats.grades || 70) - 5);
      else nextStats.grades = Math.max(0, (nextStats.grades || 70) - 1);
    }
    let nextBank = bank;
    let nextCareer = career;
    let businessHistory = null;
    let educationHistory = null;

    // ── Economy cycle ─────────────────────────────────────────────────────────
    const PHASE_DURATIONS = { normal: 3, boom: 2, recession: 2 };
    const phaseTransitions = { normal: 'boom', boom: 'recession', recession: 'normal' };
    const newYearsInPhase = economyCycle.yearsInPhase + 1;
    const nextEconomy = newYearsInPhase >= PHASE_DURATIONS[economyCycle.phase]
      ? { year: economyCycle.year + 1, phase: phaseTransitions[economyCycle.phase], yearsInPhase: 0 }
      : { year: economyCycle.year + 1, phase: economyCycle.phase, yearsInPhase: newYearsInPhase };

    // ── Auto high-school diploma at 18 ────────────────────────────────────────
    let nextEducation = { ...education };
    if (nextAge >= 18 && !nextEducation.highSchool) {
      nextEducation = { ...nextEducation, highSchool: true };
      educationHistory = `Education: You earned your High School Diploma!`;
    }

    // ── Process in-progress degree ────────────────────────────────────────────
    if (nextEducation.currentDegree) {
      const deg = nextEducation.currentDegree;
      const cfg = DEGREE_CONFIG[deg.type];
      nextBank -= deg.annualCost;
      if (cfg.happinessEffect) nextStats.happiness = Math.max(0, nextStats.happiness + cfg.happinessEffect);
      const newYearsInProgram = deg.yearsInProgram + 1;
      if (newYearsInProgram >= deg.totalYears) {
        const bonuses = { associate: 3, bachelor: 10, master: 5, phd: 3 };
        nextStats.smarts = Math.min(100, nextStats.smarts + (bonuses[deg.type] ?? 0));
        nextStats.happiness = Math.min(100, nextStats.happiness + 3);
        nextEducation = { ...nextEducation, [deg.type]: true, currentDegree: null };
        educationHistory = `Education: You earned your ${DEGREE_LABELS[deg.type]}! +${bonuses[deg.type] ?? 0} Smarts.`;
      } else {
        nextEducation = { ...nextEducation, currentDegree: { ...deg, yearsInProgram: newYearsInProgram } };
        educationHistory = `Education: Year ${newYearsInProgram}/${deg.totalYears} of your ${DEGREE_LABELS[deg.type]}. ($${deg.annualCost.toLocaleString()} paid)`;
      }
    }

    if (nextAge > 30) nextStats.health = Math.max(0, nextStats.health - 1);
    if (nextAge > 50) {
      nextStats.health = Math.max(0, nextStats.health - 2);
      nextStats.looks = Math.max(0, nextStats.looks - 1);
    }

    if (nextCareer) {
      if (nextCareer.id === 'founder') {
        const growthChance = Math.random();
        let newEquity = nextCareer.equity;
        
        if (growthChance < 0.2) {
          newEquity = 0;
          businessHistory = "Your startup went bankrupt. You lost everything.";
        } else if (growthChance < 0.5) {
          newEquity = Math.floor(newEquity * 0.8);
          businessHistory = "Your startup had a tough year.";
        } else if (growthChance < 0.8) {
          newEquity = Math.floor(newEquity * 1.5);
          businessHistory = "Your startup grew steadily.";
        } else {
          newEquity = Math.floor(newEquity * 3);
          businessHistory = "Your startup valuation skyrocketed!";
        }

        if (newEquity === 0) {
          nextStats.happiness = Math.max(0, nextStats.happiness - 30);
          nextCareer = null;
        } else {
          nextCareer = { ...nextCareer, equity: newEquity, salary: Math.floor(newEquity * 0.1) };
          nextBank += Math.floor(newEquity * 0.1);
          businessHistory += ` Valuation: $${newEquity}. Dividend: $${Math.floor(newEquity * 0.1)}.`;
        }
      } else {
        nextBank += nextCareer.salary;
        nextStats.happiness = Math.min(100, Math.max(0, nextStats.happiness + (nextCareer.happinessEffect ?? 0)));
        nextStats.health = Math.min(100, Math.max(0, nextStats.health + (nextCareer.healthEffect ?? 0)));
        // Apply annual skill gains from job
        if (nextCareer.smarts_gain)    nextStats.smarts    = Math.min(100, nextStats.smarts + nextCareer.smarts_gain);
      }
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

    let nextProperties = [...properties];
    let nextBelongings = [...belongings];
    let totalUpkeep = 0;
    
    const marketCrash = Math.random() < 0.05; 
    const marketBoom = !marketCrash && Math.random() < 0.10; 

    nextProperties = nextProperties.map(prop => {
      let newValue = prop.currentValue;
      if (marketCrash) { newValue = Math.floor(newValue * 0.7); }
      else if (marketBoom) { newValue = Math.floor(newValue * 1.3); }
      else { newValue = Math.floor(newValue * (1 + (Math.random() * 0.03 + 0.02))); }
      totalUpkeep += prop.upkeep || 0;
      return { ...prop, currentValue: newValue, yearsOwned: prop.yearsOwned + 1 };
    });

    nextBelongings = nextBelongings.map(item => {
      let newValue = item.currentValue;
      if (item.type === 'heirloom' || item.type === 'jewelry') { newValue = Math.floor(newValue * 1.02); }
      else { newValue = Math.floor(newValue * 0.85); }
      totalUpkeep += item.upkeep || 0;
      return { ...item, currentValue: Math.max(0, newValue), yearsOwned: item.yearsOwned + 1 };
    });

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
    
    const nextRelationships = relationships.map(rel => ({ ...rel, age: rel.age + 1 }));
    setRelationships(nextRelationships);

    const died = checkDeath(nextStats, nextAge);
    
    let updatedHistory = [...history];
    if (died) {
      setIsDead(true);
      updatedHistory.push({ age: nextAge, text: `You passed away peacefully at age ${nextAge}.` });
      setHistory(updatedHistory);
      syncToCloud({ age: nextAge, stats: nextStats, bank: nextBank, isDead: true, history: updatedHistory, belongings: nextBelongings, properties: nextProperties, careerMeta: nextCareerMeta, economyCycle: nextEconomy, education: nextEducation });
      setIsAging(false);
      return;
    }

    let eventTriggered = false;
    const dynamicEvent = await generateDynamicEvent({
      character, age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, history: updatedHistory
    });

    if (dynamicEvent && dynamicEvent.description && dynamicEvent.choices) {
      // Re-map format if necessary to ensure stability with UI
      const safeEvent = {
        description: dynamicEvent.description,
        choices: dynamicEvent.choices.map(c => ({
          text: c.text || "Continue",
          effects: c.effects || {}
        }))
      };
      setCurrentEvent(safeEvent);
      eventTriggered = true;
    } else {
      eventTriggered = triggerRandomEvent(nextAge);
    }

    if (!eventTriggered) {
      updatedHistory.push({ age: nextAge, text: `Age ${nextAge}: An uneventful year passed.` });
    }
    
    if (businessHistory) updatedHistory.push({ age: nextAge, text: `Business: ${businessHistory}` });
    if (educationHistory) updatedHistory.push({ age: nextAge, text: educationHistory });
    if (reviewHistory)   updatedHistory.push({ age: nextAge, text: reviewHistory });
    if (upkeepHistoryStr) updatedHistory.push({ age: nextAge, text: upkeepHistoryStr });
    if (marketHistoryStr) updatedHistory.push({ age: nextAge, text: marketHistoryStr });

    setHistory(updatedHistory);

    syncToCloud({ age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, careerMeta: nextCareerMeta, networking: nextNetworking, economyCycle: nextEconomy, education: nextEducation, history: updatedHistory, relationships: nextRelationships, properties: nextProperties, belongings: nextBelongings });
    setIsAging(false);
  }, [age, stats, bank, isDead, currentEvent, career, careerMeta, networking, economyCycle, education, history, triggerRandomEvent, checkDeath, syncToCloud, isAging, character, relationships, properties, belongings, runPerformanceReview, careersData]);

  // ─── Career expansion helpers ────────────────────────────────────────────────

  const checkCareerEligibility = useCallback((careerEntry) => {
    if (age < careerEntry.minAge) return { eligible: false, reason: `Requires age ${careerEntry.minAge}+` };
    if (careerEntry.requiresDegree && !education[careerEntry.requiresDegree]) {
      return { eligible: false, reason: `Requires ${DEGREE_LABELS[careerEntry.requiresDegree]}` };
    }
    const netReq = careerEntry.requiresNetworking ?? 0;
    if (networking < netReq) return { eligible: false, reason: `Requires Networking ${netReq}+` };
    for (const [stat, min] of Object.entries(careerEntry.statRequirements ?? {})) {
      if ((stats[stat] ?? 0) < min) return { eligible: false, reason: `Requires ${stat} ${min}+` };
    }
    return { eligible: true, reason: '' };
  }, [age, education, networking, stats]);

  const enrollInDegree = (degreeType) => {
    const cfg = DEGREE_CONFIG[degreeType];
    if (!cfg) return;
    if (education.currentDegree !== null) {
      setHistory(prev => [...prev, { age, text: `Education: You're already enrolled in a program.` }]);
      return;
    }
    if (cfg.requires && !education[cfg.requires]) {
      setHistory(prev => [...prev, { age, text: `Education: You need a ${DEGREE_LABELS[cfg.requires]} first.` }]);
      return;
    }
    if (bank < cfg.annualCost) {
      setHistory(prev => [...prev, { age, text: `Education: You can't afford the first year's tuition ($${cfg.annualCost.toLocaleString()}).` }]);
      return;
    }
    setBank(prev => prev - cfg.annualCost);
    const newEdu = { ...education, currentDegree: { type: degreeType, yearsInProgram: 0, totalYears: cfg.years, annualCost: cfg.annualCost } };
    setEducation(newEdu);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Education: You enrolled in a ${DEGREE_LABELS[degreeType]} program (Year 1/${cfg.years}).` }];
      syncToCloud({ education: newEdu, history: updated });
      return updated;
    });
  };

  const runPerformanceReview = useCallback((currentStats, currentCareer, currentMeta, currentNetworking, currentEconomy) => {
    let roll = 0.5;
    roll += Math.min(0.10, ((currentStats.smarts  - 50) / 10) * 0.02);
    roll += Math.min(0.06, ((currentStats.health  - 50) / 10) * 0.02);
    roll += Math.min(0.05, ((currentStats.karma   - 50) / 10) * 0.01);
    roll += Math.min(0.10, (currentNetworking / 20) * 0.02);
    if (currentMeta.isOnPIP)             roll -= 0.05;
    if (currentMeta.financialStressFlag) roll -= 0.10;
    if (currentEconomy?.phase === 'boom')      roll += 0.05;
    if (currentEconomy?.phase === 'recession') roll -= 0.05;

    let outcome;
    if (roll < 0.10)      outcome = 'fired';
    else if (roll < 0.25) outcome = 'pip';
    else if (roll < 0.55) outcome = 'no_change';
    else if (roll < 0.85) outcome = 'raise';
    else                  outcome = 'promoted';

    if (currentEconomy?.phase === 'recession' && roll < 0.15) outcome = 'fired';
    if (currentEconomy?.phase === 'boom' && outcome === 'fired' && roll >= 0.12) outcome = 'pip';

    let newCareer = { ...currentCareer };
    let setIsOnPIP = false;
    let unemploymentYears = 0;
    let newFinancialStressFlag = currentMeta.financialStressFlag ?? false;

    if (outcome === 'promoted') {
      if (!currentCareer.nextTierId) {
        outcome = 'raise';
      } else {
        const reqs = currentCareer.promotionRequirements ?? {};
        const meetsReqs = (
          (currentMeta.yearsInRole >= (reqs.minYearsInRole ?? 0)) &&
          (currentStats.smarts >= (reqs.minSmarts ?? 0)) &&
          (currentStats.health >= (reqs.minHealth ?? 0)) &&
          (currentStats.karma  >= (reqs.minKarma  ?? 0))
        );
        if (!meetsReqs) outcome = 'raise';
      }
    }

    if (outcome === 'raise') {
      newCareer = { ...currentCareer, salary: Math.round(currentCareer.salary * 1.05) };
    } else if (outcome === 'pip') {
      setIsOnPIP = true;
      newCareer = { ...currentCareer };
    } else if (outcome === 'fired') {
      newCareer = null;
      unemploymentYears = 2;
      newFinancialStressFlag = true;
    }

    const texts = {
      promoted:  `Career: Outstanding performance — you've been promoted! Your manager wants to discuss next steps.`,
      raise:     `Career: Good performance. You received a 5% salary raise ($${Math.round(currentCareer.salary * 0.05).toLocaleString()}).`,
      no_change: `Career: Satisfactory year. No change in compensation.`,
      pip:       `Career: Your manager placed you on a Performance Improvement Plan. Shape up.`,
      fired:     `Career: You were let go. Your position has been eliminated. Unemployment benefits activated.`,
    };

    return { outcome, newCareer, setIsOnPIP, unemploymentYears, newFinancialStressFlag, historyText: texts[outcome],
      statEffects: { happiness: outcome === 'pip' ? -10 : outcome === 'fired' ? -30 : 0 } };
  }, []);

  const chooseCareer = (jobId) => {
    if (jobId === null) {
      setCareer(null);
      const newMeta = { ...INITIAL_CAREER_META, financialStressFlag: careerMeta.financialStressFlag };
      setCareerMeta(newMeta);
      setHistory(prev => {
        const updated = [...prev, { age, text: `You quit your current occupation.` }];
        syncToCloud({ history: updated, career: null, careerMeta: newMeta });
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
      syncToCloud({ history: updated, career: selected, careerMeta: newMeta });
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
    const trackId = `${categoryId}__${item.text}`;

    // 1. Per-year limit gate
    if (item.yearlyLimit) {
      const count = activitiesThisYear[trackId] ?? 0;
      if (count >= item.yearlyLimit) return 'blocked_yearly';
    }

    // 2. Stat guard
    if (item.statGuard) {
      const { stat, op, value } = item.statGuard;
      const actual = stats[stat] ?? 0;
      if (op === 'gte' && actual < value) return 'blocked_guard';
      if (op === 'lte' && actual > value) return 'blocked_guard';
    }

    // 3. Cost deduction
    const cost = item.cost ?? 0;
    if (cost > 0) {
      if (bank < cost) return 'blocked_cost';
      setBank(prev => prev - cost);
    }

    // 4. Apply guaranteed base effects
    if (item.baseEffects) applyEffects(item.baseEffects);

    // 5. Track usage
    if (item.yearlyLimit) {
      setActivitiesThisYear(prev => ({ ...prev, [trackId]: (prev[trackId] ?? 0) + 1 }));
    }

    // 6. Fire LLM event
    triggerActivityEvent(item.context);
    return 'ok';
  };

  const modifyRelationship = (id, delta) => {
    setRelationships(prev => {
      const next = prev.map(r => r.id === id ? { ...r, relation: Math.max(0, Math.min(100, r.relation + delta)) } : r);
      syncToCloud({ relationships: next });
      return next;
    });
  };

  const modifyProperty = (id, valueDelta) => {
    setProperties(prev => {
      const next = prev.map(p => p.id === id ? { ...p, currentValue: p.currentValue + valueDelta } : p);
      syncToCloud({ properties: next });
      return next;
    });
  };

  const trainHiddenSkill = (skill) => {
    let gain = Math.floor(Math.random() * 6) + 3;
    setStats(prev => ({ ...prev, [skill]: Math.min(100, (prev[skill] || 0) + gain) }));
    return gain;
  };

  const performGig = (name, payout) => {
    setBank(prev => prev + payout);
    setHistory(prev => {
      const updated = [...prev, { age, text: `Gig: You earned $${payout} from ${name}.` }];
      syncToCloud({ history: updated, bank: bank + payout });
      return updated;
    });
  };

  const executeTrade = (percentage) => {
    if (bank <= 0) return;
    const wager = Math.floor(bank * (percentage / 100));
    const chance = Math.random();
    let multiplier = 0;
    
    if (chance < 0.4) multiplier = 0;
    else if (chance < 0.6) multiplier = 0.5;
    else if (chance < 0.8) multiplier = 1.5;
    else if (chance < 0.95) multiplier = 2;
    else multiplier = 5;

    const payout = Math.floor(wager * multiplier);
    const profit = payout - wager;
    
    setBank(prev => prev + profit);
    setHistory(prev => {
      let msg = profit > 0 ? `Day Trade: Risked $${wager}, walked away with $${payout} (+$${profit}).` : `Day Trade: Risked $${wager} and lost $${Math.abs(profit)}.`;
      if (multiplier === 0) msg = `Day Trade: You risked $${wager} and got wiped out completely!`;

      const updated = [...prev, { age, text: msg }];
      syncToCloud({ history: updated, bank: bank + profit });
      return updated;
    });
  };

  const startStartup = () => {
    if (bank < 500) return;
    setBank(prev => prev - 500);
    const founderCareer = { id: 'founder', title: 'Startup Founder', salary: 0, happinessEffect: -15, type: 'business', equity: 500 };
    setCareer(founderCareer);
    setHistory(prev => {
      const updated = [...prev, { age, text: `You invested $500 and launched your own startup.` }];
      syncToCloud({ history: updated, bank: bank - 500, career: founderCareer });
      return updated;
    });
  };

  const playLottery = (ticketCount = 1) => {
    const cost = 5 * ticketCount;
    if (bank < cost) return;
    setBank(prev => prev - cost);
    let won = false;
    for (let i = 0; i < ticketCount; i++) { if (Math.random() < 0.00001) { won = true; break; } }
    let msg = `Lottery: You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} ($${cost}) and lost.`;
    if (won) {
      setBank(prev => prev + 10000000);
      msg = `Lottery: HOLY MOLY! You bought ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} and WON $10,000,000!`;
    }
    setHistory(prev => {
      const updated = [...prev, { age, text: msg }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const studyHard = () => {
    if (isDead) return;
    setStats(prev => ({
      ...prev,
      happiness: Math.max(0, prev.happiness - 10),
      smarts: Math.min(100, prev.smarts + 2),
      grades: Math.min(100, prev.grades !== undefined ? prev.grades + 5 : 75)
    }));
    setHistory(prev => {
      const updated = [...prev, { age, text: "You studied extremely hard for your classes." }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const goGamble = (amount) => {
    if (bank < amount || amount <= 0) return;
    setBank(prev => prev - amount);
    const roll = Math.random();
    let msg, bankDelta;
    if (roll < 0.45) {
      const winnings = amount * 2;
      setBank(prev => prev + winnings);
      bankDelta = amount; // net +amount
      msg = `Casino: You gambled $${amount.toLocaleString()} and WON $${winnings.toLocaleString()}!`;
    } else if (roll < 0.70) {
      const partial = Math.floor(amount * 0.5);
      setBank(prev => prev + partial);
      bankDelta = -(amount - partial);
      msg = `Casino: You gambled $${amount.toLocaleString()} and got half back ($${partial.toLocaleString()}).`;
    } else {
      bankDelta = -amount;
      msg = `Casino: You gambled $${amount.toLocaleString()} and lost it all.`;
    }
    setStats(prev => ({ ...prev, happiness: Math.max(0, prev.happiness + (bankDelta > 0 ? 5 : -5)) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: msg }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const visitDoctor = (visitType = 'checkup') => {
    const DOCTOR_VISITS = {
      checkup:   { cost: 100,  health: 15, happiness: 3,  label: 'General Checkup' },
      specialist: { cost: 500,  health: 25, happiness: 5,  label: 'Specialist Visit' },
      surgery:   { cost: 5000, health: 40, happiness: -5, label: 'Minor Surgery' },
      therapy:   { cost: 200,  health: 5,  happiness: 20, label: 'Therapy Session' },
    };
    const visit = DOCTOR_VISITS[visitType] ?? DOCTOR_VISITS.checkup;
    if (bank < visit.cost) return;
    setBank(prev => prev - visit.cost);
    setStats(prev => ({
      ...prev,
      health:    Math.min(100, prev.health    + visit.health),
      happiness: Math.min(100, Math.max(0, prev.happiness + visit.happiness)),
    }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Doctor: Paid $${visit.cost.toLocaleString()} for a ${visit.label}. (+${visit.health} Health)` }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const addRelationship = (npc) => {
    if (isDead) return;
    setRelationships(prev => {
      const updated = [...prev, npc];
      syncToCloud({ relationships: updated });
      return updated;
    });
    setHistory(prev => {
      const updated = [...prev, { age, text: `Relationships: You are now dating ${npc.name}.` }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const surrender = () => {
    setStats(prev => ({ ...prev, health: 0 }));
    setIsDead(true);
    setHistory(prev => {
      const updated = [...prev, { age, text: `You surrendered to the void.` }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const triggerActivityEvent = async (context) => {
    if (isDead || currentEvent || isAging) return;
    setIsAging(true);
    try {
      const stateDump = { character, age, bank, stats, career, history };
      const parsed = await generateDynamicEvent(stateDump, context);
      
      if (parsed && parsed.choices && parsed.description) {
         setCurrentEvent(parsed);
      } else {
         throw new Error("Invalid schema");
      }
    } catch (e) {
      console.error(e);
      setHistory(prev => [...prev, { age, text: `Activity (${context}): Nothing interesting happened.` }]);
    }
    setIsAging(false);
  };

  const buyAsset = (category, item) => {
    if (bank < item.cost) return;
    setBank(prev => prev - item.cost);
    
    const newAsset = {
      ...item,
      id: `${category}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      currentValue: item.cost,
      purchasePrice: item.cost,
      yearsOwned: 0
    };

    if (category === 'property') {
      setProperties(prev => {
        const next = [...prev, newAsset];
        syncToCloud({ properties: next, bank: bank - item.cost });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Real Estate: Purchased a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    } else {
      setBelongings(prev => {
        const next = [...prev, newAsset];
        syncToCloud({ belongings: next, bank: bank - item.cost });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Shopping: Bought a ${item.name} for $${item.cost.toLocaleString()}.` }]);
    }
  };

  const sellAsset = (category, id) => {
    if (category === 'property') {
      const asset = properties.find(p => p.id === id);
      if (!asset) return;
      setBank(prev => prev + asset.currentValue);
      setProperties(prev => {
        const next = prev.filter(p => p.id !== id);
        syncToCloud({ properties: next, bank: bank + asset.currentValue });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Real Estate: Sold your ${asset.name} for $${Math.floor(asset.currentValue).toLocaleString()}.` }]);
    } else {
      const asset = belongings.find(b => b.id === id);
      if (!asset) return;
      setBank(prev => prev + asset.currentValue);
      setBelongings(prev => {
        const next = prev.filter(b => b.id !== id);
        syncToCloud({ belongings: next, bank: bank + asset.currentValue });
        return next;
      });
      setHistory(prev => [...prev, { age, text: `Belongings: Sold your ${asset.name} for $${Math.floor(asset.currentValue).toLocaleString()}.` }]);
    }
  };

  const attendNetworkingEvent = () => {
    if (bank < 200) return;
    setBank(prev => prev - 200);
    setNetworking(prev => Math.min(100, prev + 5));
    setStats(prev => ({ ...prev, happiness: Math.min(100, prev.happiness + 2) }));
    triggerActivityEvent('Attended a professional networking mixer to meet industry contacts.');
    setHistory(prev => {
      const updated = [...prev, { age, text: `Career: Attended a networking event (+5 Networking). Cost $200.` }];
      syncToCloud({ history: updated });
      return updated;
    });
  };

  const debugGrantDegree = (degreeType) => {
    setEducation(prev => {
      const next = { ...prev, [degreeType]: true };
      syncToCloud({ education: next });
      return next;
    });
  };

  const debugSetEconomy = (phase) => {
    const next = { year: economyCycle.year, phase, yearsInPhase: 0 };
    setEconomyCycle(next);
    syncToCloud({ economyCycle: next });
  };

  const debugAddNetworking = (amount) => {
    setNetworking(prev => {
      const next = Math.min(100, prev + amount);
      syncToCloud({ networking: next });
      return next;
    });
  };

  const debugModifyBank = (amount) => {
    setBank(prev => prev + amount);
    syncToCloud({ bank: bank + amount });
  };

  const debugAddAge = (years) => {
    setAge(prev => prev + years);
    setProperties(prev => prev.map(p => ({ ...p, yearsOwned: p.yearsOwned + years })));
    setBelongings(prev => prev.map(b => ({ ...b, yearsOwned: b.yearsOwned + years })));
    syncToCloud({ age: age + years });
    setHistory(prev => [...prev, { age: age+years, text: `[DEV] Fast-forwarded time by ${years} years.` }]);
  };

  const debugMaxStats = () => {
    setStats(prev => {
      const max = { ...prev, health: 100, happiness: 100, smarts: 100, looks: 100, athleticism: 100, karma: 100 };
      syncToCloud({ stats: max });
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
    buyAsset,
    sellAsset,
    debugModifyBank,
    debugAddAge,
    debugMaxStats,
    debugGrantDegree,
    debugSetEconomy,
    debugAddNetworking,
    startLife,
    ageUp,
    handleChoice,
    chooseCareer,
    checkCareerEligibility,
    enrollInDegree,
    attendNetworkingEvent,
    performActivity,
    modifyRelationship,
    modifyProperty,
    trainHiddenSkill,
    performGig,
    executeTrade,
    startStartup,
    playLottery,
    studyHard,
    goGamble,
    visitDoctor,
    surrender,
    addRelationship,
    triggerActivityEvent
  };
}
