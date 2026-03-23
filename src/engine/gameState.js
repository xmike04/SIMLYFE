import { useState, useCallback, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { generateDynamicEvent } from './llmService';

import staticEvents from './events.json';
import staticCareers from './careers.json';

const INITIAL_STATS = { health: 80, happiness: 80, smarts: 50, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 };
const NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];

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
    
    const lastName = name.split(' ').pop();
    const initialFamily = [
      { id: `rel_${Date.now()}_m`, type: "Mother", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 70 + Math.floor(Math.random() * 30) },
      { id: `rel_${Date.now()}_f`, type: "Father", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: 20 + Math.floor(Math.random() * 15), relation: 60 + Math.floor(Math.random() * 40) }
    ];
    const numSiblings = Math.floor(Math.random() * 4);
    for (let i=0; i<numSiblings; i++) {
       initialFamily.push({ id: `rel_${Date.now()}_s${i}`, type: "Sibling", name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${lastName}`, age: Math.floor(Math.random() * 15), relation: 40 + Math.floor(Math.random() * 60) });
    }
    setRelationships(initialFamily);
    
    const initialHistory = [{ age: 0, text: `You were born in ${country}. You are a ${gender} named ${name}.` }];
    setHistory(initialHistory);
    setCurrentEvent(null);

    syncToCloud({ character: newChar, age: 0, stats: initialStats, bank: 0, history: initialHistory, isDead: false, relationships: initialFamily, belongings: [], properties: [] });
  };

  const checkDeath = useCallback((currentStats, currentAge) => {
    if (currentStats.health <= 0) return true;
    if (currentAge >= 60) {
      const chance = (currentAge - 50) * 0.02; 
      if (Math.random() < chance) return true;
    }
    return false;
  }, []);

  const applyEffects = (effects) => {
    setStats((prevStats) => {
      const newStats = { ...prevStats };
      if (effects.health) newStats.health = Math.min(100, Math.max(0, newStats.health + effects.health));
      if (effects.happiness) newStats.happiness = Math.min(100, Math.max(0, newStats.happiness + effects.happiness));
      if (effects.smarts) newStats.smarts = Math.min(100, Math.max(0, newStats.smarts + effects.smarts));
      if (effects.looks) newStats.looks = Math.min(100, Math.max(0, newStats.looks + effects.looks));
      if (effects.bank) setBank(prev => prev + effects.bank);
      return newStats;
    });

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
    
    if (nextAge > 30) nextStats.health -= 1;
    if (nextAge > 50) {
      nextStats.health -= 2;
      nextStats.looks -= 1;
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
        nextStats.happiness = Math.min(100, Math.max(0, nextStats.happiness + nextCareer.happinessEffect));
      }
    }

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
      syncToCloud({ age: nextAge, stats: nextStats, bank: nextBank, isDead: true, history: updatedHistory, belongings: nextBelongings, properties: nextProperties });
      setIsAging(false);
      return;
    }

    let eventTriggered = false;
    const dynamicEvent = await generateDynamicEvent({
      character, age: nextAge, stats: nextStats, bank: nextBank, career, history: updatedHistory
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
    
    if (businessHistory) {
      updatedHistory.push({ age: nextAge, text: `Business: ${businessHistory}` });
    }
    
    if (upkeepHistoryStr) updatedHistory.push({ age: nextAge, text: upkeepHistoryStr });
    if (marketHistoryStr) updatedHistory.push({ age: nextAge, text: marketHistoryStr });
    
    setHistory(updatedHistory);
    
    syncToCloud({ age: nextAge, stats: nextStats, bank: nextBank, career: nextCareer, history: updatedHistory, relationships: nextRelationships, properties: nextProperties, belongings: nextBelongings });
    setIsAging(false);
  }, [age, stats, bank, isDead, currentEvent, career, history, triggerRandomEvent, checkDeath, syncToCloud, isAging, character, relationships, properties, belongings]);

  const chooseCareer = (jobId) => {
    if (jobId === null) {
      setCareer(null);
      setHistory(prev => {
        const updated = [...prev, { age, text: `You quit your current occupation.` }];
        syncToCloud({ history: updated, career: null });
        return updated;
      });
      return;
    }
    const selected = careersData.find(c => c.id === jobId);
    if (selected) {
      setCareer(selected);
      setHistory(prev => {
        const updated = [...prev, { age, text: `You got a job as a ${selected.title}.` }];
        syncToCloud({ history: updated, career: selected });
        return updated;
      });
    }
  };

  const performActivity = (activityId, name, effects) => {
    if (activitiesThisYear[activityId]) return false;

    applyEffects(effects);
    setActivitiesThisYear(prev => ({ ...prev, [activityId]: true }));
    
    setHistory(prev => {
      const updated = [...prev, { age, text: `Activity: You decided to ${name}.` }];
      syncToCloud({ history: updated });
      return updated;
    });
    return true;
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

  const playLottery = () => {
    if (bank < 5) return;
    setBank(prev => prev - 5);
    const won = Math.random() < 0.00001;
    let msg = `Lottery: You bought a $5 ticket and lost.`;
    if (won) {
      setBank(prev => prev + 10000000);
      msg = `Lottery: HOLY MOLY! You bought a $5 ticket and WON $10,000,000!`;
    }
    setHistory(prev => {
      const updated = [...prev, { age, text: msg }];
      syncToCloud({ history: updated, bank: won ? bank + 10000000 : bank - 5 });
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
    const win = Math.random() < 0.45;
    let msg = `Casino: You gambled $${amount} and lost it all.`;
    if (win) {
      setBank(prev => prev + amount * 2);
      msg = `Casino: You gambled $${amount} and WON $${amount * 2}!`;
    }
    setHistory(prev => {
      const updated = [...prev, { age, text: msg }];
      syncToCloud({ history: updated, bank: win ? bank + amount : bank - amount });
      return updated;
    });
  };

  const visitDoctor = () => {
    if (bank < 100) return;
    setBank(prev => prev - 100);
    setStats(prev => ({ ...prev, health: Math.min(100, prev.health + 20), happiness: Math.min(100, prev.happiness + 5) }));
    setHistory(prev => {
      const updated = [...prev, { age, text: `Doctor: You paid $100 for a checkup. You feel healthier.` }];
      syncToCloud({ history: updated, bank: bank - 100 });
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
    const max = { health: 100, happiness: 100, smarts: 100, looks: 100 };
    setStats(max);
    syncToCloud({ stats: max });
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
    startLife,
    ageUp,
    handleChoice,
    chooseCareer,
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
