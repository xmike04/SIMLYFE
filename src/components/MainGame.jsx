import React, { useRef, useEffect, useState } from 'react';
import ActionSheet from './ActionSheet';
import { ACTIVITY_CATEGORIES, ACTIVITY_MENUS } from '../config/activities';
import { getWealthTier } from '../config/wealthTiers';
import { getCityById } from '../config/cityData.js';
import { yearlyActivityTrackId } from '../engine/gameState';
import AssetsSheet from './sheets/AssetsSheet';
import RelationshipsSheet from './sheets/RelationshipsSheet';
import JobSheet from './sheets/JobSheet';
import DoctorSheet from './sheets/DoctorSheet';
import LotterySheet from './sheets/LotterySheet';
import CasinoSheet from './sheets/CasinoSheet';
import DatingSheet from './sheets/DatingSheet';
import WillsSheet from './sheets/WillsSheet';
import PetsSheet from './sheets/PetsSheet';
import AccountSheet from './sheets/AccountSheet';

const SECTOR_META = {
  tech:          { icon: '💻', label: 'Tech' },
  trades:        { icon: '🔧', label: 'Trades' },
  healthcare:    { icon: '🏥', label: 'Healthcare' },
  education:     { icon: '📚', label: 'Education' },
  finance:       { icon: '💰', label: 'Finance' },
  law:           { icon: '⚖️', label: 'Law' },
  law_enforcement:{ icon: '🚔', label: 'Law Enforcement' },
  military:      { icon: '🎖️', label: 'Military' },
  government:    { icon: '🏛️', label: 'Government' },
  creative:      { icon: '🎨', label: 'Creative' },
  fitness:       { icon: '💪', label: 'Fitness' },
  service:       { icon: '🛎️', label: 'Service' },
};

const ENABLE_DEV_TOOLS = import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';

const StatBar = ({ label, value, color }) => (
  <div style={{ marginBottom: '6px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
      <span>{label}</span>
      <span>{value}%</span>
    </div>
    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </div>
  </div>
);

export default function MainGame({ engine }) {
  const { character, age, bank, stats, history, career, careersData, chooseCareer, ageUp, activitiesThisYear, performActivity, isAging, currentEvent, relationships, modifyRelationship, modifyProperty, performGig, startStartup, enlistMilitary, hireViaHeadhunter, playLottery, goGamble, visitDoctor, surrender, addRelationship, proposeMarriage, breakUp, haveChild, giftRelationship, meetFriend, triggerActivityEvent, belongings, properties, buyAsset, sellAsset, buyInvestment, sellInvestment, debugModifyBank, debugAddAge, debugMaxStats, studyHard, trainHiddenSkill, careerMeta, networking, economyCycle, education, checkCareerEligibility, enrollInDegree, attendNetworkingEvent, emigrate, debugGrantDegree, debugSetEconomy, debugAddNetworking, narrativeMode, setNarrativeMode, pets, adoptPet, visitVet, consumeYearlyActivity, will, draftWill, authAccount, signInWithGoogle, signOutAccount } = engine;
  const historyEndRef = useRef(null);
  
  const [activeSheet, setActiveSheet] = useState(null);
  const [skillToast, setSkillToast] = useState(null);
  const uiFrozen = isAging || !!currentEvent;
  /** Sheets stay in state but are not shown while aging/event — avoids setState-in-effect. */
  const visibleSheet = uiFrozen ? null : activeSheet;

  const openSheet = (sheet) => {
    if (uiFrozen) return;
    setActiveSheet(sheet);
  };

  const handleSpecialSkill = (action, context, opt, categoryId) => {
    if (uiFrozen) return;
    let cost = 0;
    let skillName = "";
    let displayName = "";
    
    if (action === 'gym' || action === 'run') { skillName = 'athleticism'; displayName = 'Athleticism'; }
    if (action === 'act_lesson') { skillName = 'acting'; cost = 50; displayName = 'Acting Skill'; }
    if (action === 'voice_lesson') { skillName = 'voice'; cost = 50; displayName = 'Vocal Skill'; }
    if (action === 'model_lesson') { skillName = 'modeling'; cost = 50; displayName = 'Modeling Skill'; }

    // Prefer catalog cost when present (lessons); gym/run have no cost
    if (opt?.cost != null) cost = opt.cost;

    if (opt?.yearlyLimit && !consumeYearlyActivity(categoryId, opt.text, opt.yearlyLimit)) {
      return;
    }

    if (bank < cost) {
      triggerActivityEvent("Tried to train skills, but couldn't afford the lessons.");
      closeSheet();
      return;
    }

    if (cost > 0) debugModifyBank(-cost);
    triggerActivityEvent(context);
    
    const gain = trainHiddenSkill(skillName);
    if (action !== 'gym' && action !== 'run') {
      setSkillToast({ name: displayName, prev: stats[skillName] || 0, gain: gain });
      setTimeout(() => setSkillToast(null), 3500);
    }
    closeSheet();
  };
  const [activityMenu, setActivityMenu] = useState(null);

  const closeSheet = () => { setActiveSheet(null); setActivityMenu(null); };

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="flex-column animate-slide-up" style={{ height: '100%', padding: '10px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {skillToast && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(139, 92, 246, 0.95)', color: 'white', padding: '12px 25px', borderRadius: '12px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', width: '250px' }}>
          <strong style={{ fontSize: '1rem', marginBottom: '8px' }}>{skillToast.name} +{skillToast.gain}</strong>
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
             <div style={{ width: `${Math.min(100, skillToast.prev + skillToast.gain)}%`, height: '100%', background: '#fff', borderRadius: '4px', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </div>
        </div>
      )}
      {/* Header Profile */}
      <div className="glass-panel text-center mb-1" style={{ padding: '0.8rem', flexShrink: 0, position: 'relative' }}>
        {/* Account: 👤 guest / 🔗 Google-linked */}
        <button
          onClick={() => openSheet('account')}
          disabled={uiFrozen}
          aria-label="Account"
          style={{ position: 'absolute', top: '8px', left: '12px', background: 'none', border: 'none', fontSize: '1.1rem', cursor: uiFrozen ? 'not-allowed' : 'pointer', padding: '2px' }}
        >
          {authAccount && !authAccount.isAnonymous ? '🔗' : '👤'}
        </button>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
          {character.name}
          {ENABLE_DEV_TOOLS && (
            <span style={{ cursor: 'pointer', fontSize: '1rem', marginLeft: '6px' }} onClick={() => setActiveSheet('debug')}>🐛</span>
          )}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Age: {age} • {character?.city ? `${getCityById(character.city)?.name ?? character.city}, ${character.country}` : character?.country}</p>
        <div style={{ position: 'absolute', top: '10px', right: '15px', color: '#10b981', fontWeight: 'bold', fontSize: '1rem' }}>
          ${bank.toLocaleString()}
        </div>
        {career && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {career.sector && SECTOR_META[career.sector] ? SECTOR_META[career.sector].icon : '💼'} {career.title} (${career.salary?.toLocaleString() ?? '0'}/yr)
          </p>
        )}
        {(() => {
          const tier = getWealthTier(bank);
          const taxRate = tier.incomeTaxRate;
          const badges = [];
          if (tier.id !== 'broke') badges.push(
            <span key="tier" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: tier.color, fontWeight: 'bold' }}>
              {tier.icon} {tier.label}
            </span>
          );
          if (taxRate > 0) badges.push(
            <span key="tax" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
              🧾 {Math.round(taxRate * 100)}% tax bracket
            </span>
          );
          if (tier.lifestyleCost > 0) badges.push(
            <span key="lifestyle" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
              ✨ −${tier.lifestyleCost.toLocaleString()}/yr lifestyle
            </span>
          );
          if (economyCycle?.phase === 'boom') badges.push(
            <span key="boom" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.25)', color: '#34d399', fontWeight: 'bold' }}>📈 Boom</span>
          );
          if (economyCycle?.phase === 'recession') badges.push(
            <span key="rec" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.25)', color: '#fca5a5', fontWeight: 'bold' }}>📉 Recession</span>
          );
          if (networking > 0) badges.push(
            <span key="net" style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>🤝 Network: {networking}/100</span>
          );
          return badges.length > 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
              {badges}
            </div>
          ) : null;
        })()}
        <button
          onClick={() => { if (!uiFrozen) setNarrativeMode(!narrativeMode); }}
          disabled={uiFrozen}
          style={{
            display: 'block',
            margin: '6px auto 0',
            background: narrativeMode ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${narrativeMode ? 'rgba(124, 58, 237, 0.6)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: '20px',
            padding: '4px 10px',
            fontSize: '0.75rem',
            color: narrativeMode ? '#a855f7' : 'var(--text-secondary)',
            cursor: uiFrozen ? 'not-allowed' : 'pointer',
            opacity: uiFrozen ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {narrativeMode ? '📖 Prose' : '⚡ Quick'}
        </button>
      </div>

      {/* History Log (Middle) */}
      <div className="glass-panel mb-1" style={{ flexGrow: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        {history.map((entry, i) => {
          const isSameAge = i > 0 && history[i - 1].age === entry.age;
          return (
            <div key={i} className={`animate-fade-in ${!isSameAge && i !== 0 ? 'mt-3' : 'mt-1'}`} style={{ paddingBottom: '0.2rem' }}>
              {!isSameAge && <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2px' }}>Age {entry.age}</span>}
              <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-primary)' }}>{entry.text}</span>
            </div>
          );
        })}
        <div ref={historyEndRef} />
      </div>

      {/* Action Bar (Middle-Bottom) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', margin: '0.2rem 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-end' }}>
          <button className="action-tab" onClick={() => openSheet('job')} disabled={uiFrozen || age < 10}>
            <span style={{ fontSize: '1.2rem' }}>💼</span>
            <span>Job</span>
          </button>
          <button className="action-tab" onClick={() => openSheet('assets')} disabled={uiFrozen || age < 18}>
            <span style={{ fontSize: '1.2rem' }}>🏠</span>
            <span>Assets</span>
          </button>
        </div>
        
        <button className="age-btn" onClick={() => { setActiveSheet(null); setActivityMenu(null); ageUp(); }} disabled={isAging || !!currentEvent} style={{ opacity: (isAging || currentEvent) ? 0.7 : 1 }}>
          {isAging ? (
             <span style={{ border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid white', borderRadius: '50%', width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <span style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: 1 }}>+</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Age</span>
            </>
          )}
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-start' }}>
          <button className="action-tab" onClick={() => openSheet('relationships')} disabled={uiFrozen}>
            <span style={{ fontSize: '1.2rem' }}>❤️</span>
            <span>Relationships</span>
          </button>
          <button className="action-tab" onClick={() => openSheet('activities')} disabled={uiFrozen || age < 4}>
            <span style={{ fontSize: '1.2rem' }}>🎭</span>
            <span>Activities</span>
          </button>
        </div>
      </div>

      {/* Stats Panel (Bottom) */}
      <div className="glass-panel" style={{ padding: '0.8rem', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <div>
            <StatBar label="Happiness" value={stats.happiness} color="var(--happiness-color)" />
            <StatBar label="Health" value={stats.health} color="var(--health-color)" />
            <StatBar label="Smarts" value={stats.smarts} color="var(--smarts-color)" />
          </div>
          <div>
            <StatBar label="Looks" value={stats.looks} color="var(--looks-color)" />
            <StatBar label="Athletic" value={stats.athleticism || 0} color="#f59e0b" />
            <StatBar label="Karma" value={stats.karma || 50} color="#8b5cf6" />
          </div>
        </div>
      </div>

      {/* Action Sheets */}
      {visibleSheet === 'job' && (
        <JobSheet
          age={age}
          bank={bank}
          stats={stats}
          career={career}
          careersData={careersData}
          careerMeta={careerMeta}
          networking={networking}
          education={education}
          chooseCareer={chooseCareer}
          studyHard={studyHard}
          triggerActivityEvent={triggerActivityEvent}
          performGig={performGig}
          attendNetworkingEvent={attendNetworkingEvent}
          enrollInDegree={enrollInDegree}
          checkCareerEligibility={checkCareerEligibility}
          debugModifyBank={debugModifyBank}
          startStartup={startStartup}
          enlistMilitary={enlistMilitary}
          hireViaHeadhunter={hireViaHeadhunter}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'activities' && (() => {
        // Resolve item lock state for the current menu
        const resolveItemState = (opt) => {
          // Yearly limit
          const trackId = yearlyActivityTrackId(activityMenu, opt.text);
          if (opt.yearlyLimit) {
            const count = activitiesThisYear[trackId] ?? 0;
            if (count >= opt.yearlyLimit) return { locked: true, reason: '✓ Done this year' };
          }
          // Cost
          const cost = opt.cost ?? 0;
          if (cost > 0 && bank < cost) return { locked: true, reason: `Need $${cost.toLocaleString()}` };
          // Stat guard
          if (opt.statGuard) {
            const { stat, op, value } = opt.statGuard;
            const actual = stats[stat] ?? 0;
            if (op === 'gte' && actual < value) return { locked: true, reason: `Requires ${stat} ${value}+` };
            if (op === 'lte' && actual > value) return { locked: true, reason: `Requires ${stat} ≤${value}` };
          }
          return { locked: false, reason: '' };
        };

        const handleActivityClick = (opt) => {
          if (opt.specialAction === 'open_wills_ui') { setActiveSheet('wills'); setActivityMenu(null); return; }
          if (opt.specialAction === 'open_dating_ui') { setActiveSheet('dating'); setActivityMenu(null); return; }
          if (opt.specialAction === 'open_pets_ui') { setActiveSheet('pets'); setActivityMenu(null); return; }
          if (opt.specialAction === 'networking_mixer') { attendNetworkingEvent(); closeSheet(); return; }
          if (opt.specialAction === 'adoptPet') { adoptPet(opt.speciesId); closeSheet(); return; }
          if (opt.specialAction === 'emigrate') { emigrate(opt.cityId); closeSheet(); return; }
          if (opt.specialAction) { handleSpecialSkill(opt.specialAction, opt.context, opt, activityMenu); return; }
          // Route through unified performActivity
          const result = performActivity(opt, activityMenu);
          if (result !== 'ok') return; // already handled inside performActivity
          closeSheet();
        };

        return (
        <ActionSheet title={activityMenu ? ACTIVITY_CATEGORIES.find(c => c.id === activityMenu)?.name : "Activities"} onClose={() => { setActivityMenu(null); setActiveSheet(null); }}>
          {/* ── Category list ── */}
          {!activityMenu && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '10px' }}>
                {ACTIVITY_CATEGORIES.map(cat => {
                  const isLockedByAge  = age < cat.minAge;
                  const isLockedByBank = cat.minBank && bank < cat.minBank;
                  const isDisabled = isLockedByAge || isLockedByBank;
                  const lockReason = isLockedByAge ? `Age ${cat.minAge}+` : isLockedByBank ? `Need $${cat.minBank.toLocaleString()}` : '';

                  const handleCatClick = () => {
                    if (cat.isSpecial === 'doctor')  { setActiveSheet('doctor');  setActivityMenu(null); return; }
                    if (cat.isSpecial === 'lottery')  { setActiveSheet('lottery'); setActivityMenu(null); return; }
                    if (cat.isSpecial === 'casino')   { setActiveSheet('casino');  setActivityMenu(null); return; }
                    setActivityMenu(cat.id);
                  };

                  return (
                    <button key={cat.id} className="glass-panel" disabled={isDisabled} onClick={handleCatClick}
                      style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left', background: cat.color, opacity: isDisabled ? 0.5 : 1 }}>
                      <div style={{ fontSize: '2rem' }}>{cat.icon}</div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '1.1rem' }}>{cat.name}</strong>
                        {lockReason && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px' }}>🔒 {lockReason}</div>}
                        {!lockReason && cat.minBank && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Min: ${cat.minBank.toLocaleString()}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button className="glass-panel" onClick={() => { surrender(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(239,68,68,0.2)', width: '100%', marginTop: '10px' }}>
                <div style={{ fontSize: '1.5rem' }}>☠️</div>
                <strong style={{ color: '#fca5a5' }}>SURRENDER</strong>
              </button>
            </>
          )}

          {/* ── Activity menu items ── */}
          {activityMenu && ACTIVITY_MENUS[activityMenu] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ACTIVITY_MENUS[activityMenu].map((opt, i) => {
                const cityData = opt.specialAction === 'emigrate' && opt.cityId ? getCityById(opt.cityId) : null;
                const isCurrentCity = cityData && character?.city === opt.cityId;
                const cityMoveCost = cityData?.moveCost ?? 0;
                const canAffordMove = !cityData || bank >= cityMoveCost;
                const { locked: baseLocked, reason: baseReason } = resolveItemState(opt);
                const locked = baseLocked || isCurrentCity || !canAffordMove;
                const reason = isCurrentCity ? 'Current city' : !canAffordMove ? `Need $${cityMoveCost.toLocaleString()}` : baseReason;
                const cost = opt.cost ?? 0;
                const isYearlyDone = reason === '✓ Done this year';
                return (
                  <button key={i} className="glass-panel" disabled={locked} onClick={() => handleActivityClick(opt)}
                    style={{ padding: '1rem', textAlign: 'left', background: opt.bg || 'rgba(255,255,255,0.05)', opacity: locked ? (isYearlyDone ? 0.4 : 0.55) : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong>{opt.text}</strong>
                      {cityData && <span style={{ fontSize: '0.75rem', color: '#ef4444', flexShrink: 0, marginLeft: '8px' }}>-${cityMoveCost.toLocaleString()}</span>}
                      {!cityData && cost > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444', flexShrink: 0, marginLeft: '8px' }}>-${cost.toLocaleString()}</span>}
                    </div>
                    {cityData && !locked && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {cityData.description} • Salary ×{cityData.salaryMultiplier} • CoL ×{cityData.colMultiplier}
                      </div>
                    )}
                    {opt.baseEffects && !locked && !cityData && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {Object.entries(opt.baseEffects).filter(([,v]) => v !== 0).map(([k, v]) =>
                          `${v > 0 ? '+' : ''}${v} ${k}`
                        ).join(' • ')}
                      </div>
                    )}
                    {locked && <div style={{ fontSize: '0.72rem', color: isYearlyDone ? '#6b7280' : '#ef4444', marginTop: '2px' }}>{reason}</div>}
                  </button>
                );
              })}
              <button className="glass-panel" onClick={() => setActivityMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
            </div>
          )}
        </ActionSheet>
        );
      })()}

      {/* ── Doctor sheet ── */}
      {visibleSheet === 'doctor' && (
        <DoctorSheet bank={bank} visitDoctor={visitDoctor} onClose={closeSheet} />
      )}

      {/* ── Lottery sheet ── */}
      {visibleSheet === 'lottery' && (
        <LotterySheet bank={bank} playLottery={playLottery} onClose={closeSheet} />
      )}

      {/* ── Casino sheet ── */}
      {visibleSheet === 'casino' && (
        <CasinoSheet bank={bank} goGamble={goGamble} onClose={closeSheet} />
      )}

      {ENABLE_DEV_TOOLS && visibleSheet === 'debug' && (
        <ActionSheet title="Dev Tools" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="glass-panel" onClick={() => { debugModifyBank(1000000); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.2)' }}>
              <strong>Add +$1,000,000 Cash</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugAddAge(10); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
              <strong>Fast Forward +10 Years</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugMaxStats(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.2)' }}>
              <strong>Max All Stats (100%)</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugGrantDegree('bachelor'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
              <strong>Grant Bachelor's Degree</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugGrantDegree('phd'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}>
              <strong>Grant All Degrees (PhD)</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugSetEconomy('boom'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.2)' }}>
              <strong>📈 Set Economy: Boom</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugSetEconomy('recession'); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.15)' }}>
              <strong>📉 Set Economy: Recession</strong>
            </button>
            <button className="glass-panel" onClick={() => { debugAddNetworking(50); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.2)' }}>
              <strong>🤝 +50 Networking</strong>
            </button>
            <button className="glass-panel" onClick={() => { engine.surrender(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.2)' }}>
              <strong>Kill Character (Health 0)</strong>
            </button>
          </div>
        </ActionSheet>
      )}

      {visibleSheet === 'assets' && (
        <AssetsSheet
          bank={bank}
          properties={properties}
          belongings={belongings}
          career={career}
          economyCycle={economyCycle}
          buyAsset={buyAsset}
          sellAsset={sellAsset}
          buyInvestment={buyInvestment}
          sellInvestment={sellInvestment}
          modifyProperty={modifyProperty}
          triggerActivityEvent={triggerActivityEvent}
          debugModifyBank={debugModifyBank}
          onClose={() => setActiveSheet(null)}
        />
      )}

      {visibleSheet === 'relationships' && (
        <RelationshipsSheet
          bank={bank}
          age={age}
          relationships={relationships}
          modifyRelationship={modifyRelationship}
          giftRelationship={giftRelationship}
          proposeMarriage={proposeMarriage}
          breakUp={breakUp}
          haveChild={haveChild}
          meetFriend={meetFriend}
          triggerActivityEvent={triggerActivityEvent}
          debugModifyBank={debugModifyBank}
          onClose={closeSheet}
          onNavigateDating={() => setActiveSheet('dating')}
        />
      )}


      {visibleSheet === 'dating' && (
        <DatingSheet
          bank={bank}
          stats={stats}
          debugModifyBank={debugModifyBank}
          addRelationship={addRelationship}
          triggerActivityEvent={triggerActivityEvent}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'account' && (
        <AccountSheet
          authAccount={authAccount}
          signInWithGoogle={signInWithGoogle}
          signOutAccount={signOutAccount}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'wills' && (
        <WillsSheet
          relationships={relationships}
          will={will}
          draftWill={draftWill}
          triggerActivityEvent={triggerActivityEvent}
          onClose={closeSheet}
        />
      )}

      {visibleSheet === 'pets' && (
        <PetsSheet
          pets={pets}
          visitVet={visitVet}
          bank={bank}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
