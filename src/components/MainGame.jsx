import React, { useRef, useEffect, useState } from 'react';
import ActionSheet from './ActionSheet';
import { ACTIVITY_CATEGORIES, ACTIVITY_MENUS } from '../config/activities';
import { SPECIAL_CAREERS } from '../config/specialCareers';
import { DEGREE_CONFIG, DEGREE_LABELS } from '../engine/gameState';
import { getWealthTier, calculateIncomeTax } from '../config/wealthTiers';

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
  const { character, age, bank, stats, history, career, careersData, chooseCareer, ageUp, activitiesThisYear, performActivity, isAging, relationships, modifyRelationship, modifyProperty, performGig, executeTrade, startStartup, playLottery, goGamble, visitDoctor, surrender, addRelationship, proposeMarriage, breakUp, haveChild, giftRelationship, meetFriend, triggerActivityEvent, belongings, properties, buyAsset, sellAsset, debugModifyBank, debugAddAge, debugMaxStats, studyHard, trainHiddenSkill, careerMeta, networking, economyCycle, education, checkCareerEligibility, enrollInDegree, attendNetworkingEvent, debugGrantDegree, debugSetEconomy, debugAddNetworking } = engine;
  const historyEndRef = useRef(null);
  
  const [activeSheet, setActiveSheet] = useState(null);
  const [selectedRel, setSelectedRel] = useState(null);
  const [selectedProp, setSelectedProp] = useState(null);
  const [skillToast, setSkillToast] = useState(null);
  const [assetMenu, setAssetMenu] = useState(null);

  const handleSpecialSkill = (action, context) => {
    let cost = 0;
    let skillName = "";
    let displayName = "";
    
    if (action === 'gym' || action === 'run') { skillName = 'athleticism'; displayName = 'Athleticism'; }
    if (action === 'act_lesson') { skillName = 'acting'; cost = 50; displayName = 'Acting Skill'; }
    if (action === 'voice_lesson') { skillName = 'voice'; cost = 50; displayName = 'Vocal Skill'; }
    if (action === 'model_lesson') { skillName = 'modeling'; cost = 50; displayName = 'Modeling Skill'; }

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

  const [datingPrefAge, setDatingPrefAge] = useState('18-25');
  const [datingPrefGender, setDatingPrefGender] = useState('Any');
  const [datingMatch, setDatingMatch] = useState(null);
  const [jobMenu, setJobMenu] = useState(null);
  const [jobSector, setJobSector] = useState(null);

  const [willDistribution, setWillDistribution] = useState({});

  const closeSheet = () => { setActiveSheet(null); setSelectedRel(null); setSelectedProp(null); setAssetMenu(null); setActivityMenu(null); setDatingMatch(null); setJobMenu(null); setJobSector(null); };

  const handleSearchMatch = () => {
    if (bank < 20) return;
    debugModifyBank(-20);
    
    let genAge = 18 + Math.floor(Math.random() * 8);
    if (datingPrefAge === '26-35') genAge = 26 + Math.floor(Math.random() * 10);
    if (datingPrefAge === '36-50') genAge = 36 + Math.floor(Math.random() * 15);
    if (datingPrefAge === '50+') genAge = 50 + Math.floor(Math.random() * 30);
    
    let genGender = datingPrefGender === 'Any' ? (Math.random() > 0.5 ? 'Male' : 'Female') : datingPrefGender;
    
    const namesM = ["Chris", "Alex", "Jordan", "Taylor", "Matt", "Ryan", "Josh", "Brandon", "Tyler", "Kevin", "Jacob"];
    const namesF = ["Jessica", "Ashley", "Amanda", "Sarah", "Jennifer", "Brittany", "Megan", "Rachel", "Lauren", "Emily"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
    
    const firstNames = genGender === 'Male' ? namesM : namesF;
    const gName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    
    setDatingMatch({
      id: `rel_${Date.now()}_lover`,
      type: 'Lover',
      name: gName,
      gender: genGender,
      age: genAge,
      looks: 30 + Math.floor(Math.random() * 70),
      smarts: 30 + Math.floor(Math.random() * 70),
      relation: 40 + Math.floor(Math.random() * 40)
    });
  };

  const handleAskOut = () => {
    const success = Math.random() < ((datingMatch.looks / 150) + (stats.looks / 150));
    if (success) {
       addRelationship(datingMatch);
       triggerActivityEvent(`Went on a successful date from a dating app with ${datingMatch.name}. We are now dating!`);
    } else {
       triggerActivityEvent(`Asked ${datingMatch.name} out on a date from a dating app, but got rejected horribly.`);
    }
    setDatingMatch(null);
    closeSheet();
  };

  useEffect(() => {
    if (activeSheet === 'wills') {
       const initialDist = {};
       relationships.forEach(r => initialDist[r.id] = 0);
       setWillDistribution(initialDist);
    }
  }, [activeSheet, relationships]);

  const handleCompleteWill = () => {
    const totalAllocated = Object.values(willDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    let str = "";
    if (totalAllocated === 0) {
      str = "Drafted a standard will explicitly spreading all assets and money evenly across my entire family and lovers.";
    } else {
      const details = relationships
         .filter(r => (parseInt(willDistribution[r.id]) || 0) > 0)
         .map(r => `${willDistribution[r.id]}% to my ${r.type.toLowerCase()} ${r.name}`);
      
      str = `Drafted a highly specific will leaving: ${details.join(', ')}. The family members who got left out or received little might have feelings about this.`;
    }
    triggerActivityEvent(str);
    closeSheet();
  };

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleChooseJob = (id) => {
    chooseCareer(id);
    setActiveSheet(null);
  };

  const handleActivity = (id, name, effects) => {
    performActivity(id, name, effects);
    setActiveSheet(null);
  };

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
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{character.name} <span style={{ cursor: 'pointer', fontSize: '1rem' }} onClick={() => setActiveSheet('debug')}>🐛</span></h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Age: {age} • {character.country}</p>
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
          <button className="action-tab" onClick={() => setActiveSheet('job')} disabled={age < 10}>
            <span style={{ fontSize: '1.2rem' }}>💼</span>
            <span>Job</span>
          </button>
          <button className="action-tab" onClick={() => setActiveSheet('assets')} disabled={age < 18}>
            <span style={{ fontSize: '1.2rem' }}>🏠</span>
            <span>Assets</span>
          </button>
        </div>
        
        <button className="age-btn" onClick={ageUp} disabled={isAging} style={{ opacity: isAging ? 0.7 : 1 }}>
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
          <button className="action-tab" onClick={() => setActiveSheet('relationships')}>
            <span style={{ fontSize: '1.2rem' }}>❤️</span>
            <span>Relationships</span>
          </button>
          <button className="action-tab" onClick={() => setActiveSheet('activities')} disabled={age < 4}>
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
      {activeSheet === 'job' && (() => {
        const getSectors = (type) => [...new Set(careersData.filter(c => c.type === type).map(c => c.sector).filter(Boolean))].sort();
        const getSectorJobs = (type, sector) => careersData.filter(c => c.type === type && c.sector === sector);

        const getTitle = () => {
          if (age < 18) return "Education";
          if (!jobMenu) return "Career & Income";
          if (jobMenu === 'full_time') return jobSector ? (SECTOR_META[jobSector]?.label || jobSector) : "Full-Time Careers";
          if (jobMenu === 'part_time') return jobSector ? (SECTOR_META[jobSector]?.label || jobSector) : "Part-Time Jobs";
          if (jobMenu === 'freelance') return "Freelance";
          if (jobMenu === 'military') return "Military";
          if (jobMenu === 'education') return "Higher Education";
          if (jobMenu === 'recruiter') return "Job Recruiter";
          if (jobMenu === 'special_careers') return "Special Careers";
          const sc = SPECIAL_CAREERS.find(c => c.id === jobMenu);
          if (sc) return sc.name;
          return "Career";
        };

        return (
        <ActionSheet title={getTitle()} onClose={() => { setJobMenu(null); setJobSector(null); setActiveSheet(null); }}>
          {age < 18 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="glass-panel" style={{ padding: '1rem', marginBottom: '4px', background: 'rgba(59, 130, 246, 0.1)' }}>
                <strong>{age < 11 ? "Elementary School" : (age < 14 ? "Middle School" : "High School")}</strong>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Grades: {stats.grades}/100</div>
              </div>
              <button className="glass-panel" onClick={() => { studyHard(); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>📚 Study Hard</strong></button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Interacted with classmates at school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🗣️ Interact with Classmates</strong></button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Went to the administration office at school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🏫 Speak to Administrators</strong></button>
              {age >= 16 && (
                <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to drop out of high school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)' }}><strong>Escalate: Drop Out</strong></button>
              )}
            </div>
          ) : (
            <>
              {/* Active career panel */}
              {career && !jobMenu && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '8px', background: 'rgba(16, 185, 129, 0.08)', borderLeft: `4px solid ${careerMeta?.isOnPIP ? '#ef4444' : '#10b981'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{career.title}</strong>
                      {career.sector && SECTOR_META[career.sector] && <span style={{ fontSize: '0.78rem', marginLeft: '6px', opacity: 0.6 }}>{SECTOR_META[career.sector].icon}</span>}
                      <div style={{ fontSize: '0.85rem', color: '#10b981', marginTop: '2px' }}>
                        {career.id === 'founder' ? `Equity: $${career.equity?.toLocaleString()}` : `$${career.salary?.toLocaleString()}/yr`}
                      </div>
                      {careerMeta && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                          {careerMeta.yearsInRole} yr{careerMeta.yearsInRole !== 1 ? 's' : ''} in role
                          {careerMeta.isOnPIP && <span style={{ color: '#ef4444', marginLeft: '6px', fontWeight: 'bold' }}>⚠️ ON PIP</span>}
                        </div>
                      )}
                    </div>
                    {career.promotionRequirements && careerMeta && (
                      <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <div style={{ marginBottom: '2px' }}>Promo req:</div>
                        <div>{career.promotionRequirements.minYearsInRole}yr • {career.promotionRequirements.minSmarts}+ smarts</div>
                        <div style={{ color: careerMeta.yearsInRole >= career.promotionRequirements.minYearsInRole ? '#34d399' : 'inherit', marginTop: '2px' }}>
                          {careerMeta.yearsInRole}/{career.promotionRequirements.minYearsInRole} yrs
                        </div>
                      </div>
                    )}
                  </div>
                  {careerMeta?.financialStressFlag && (
                    <div style={{ marginTop: '8px', padding: '5px 10px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '0.78rem', color: '#fca5a5' }}>
                      ⚠️ Financial stress detected — PIP risk
                    </div>
                  )}
                  <button className="glass-panel" onClick={() => handleChooseJob(null)} style={{ marginTop: '8px', padding: '0.5rem', width: '100%', background: 'rgba(239, 68, 68, 0.12)', fontSize: '0.85rem' }}>Quit Position</button>
                </div>
              )}

              {/* Main hub grid */}
              {!jobMenu && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="glass-panel" onClick={() => setJobMenu('full_time')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>💼 Full-Time</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('part_time')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>⏱️ Part-Time</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('freelance')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>🛠️ Freelance</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('military')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}><strong>🎖️ Military</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('special_careers')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}><strong>🌟 Special Careers</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('education')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}><strong>🎓 Education</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu('recruiter')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}><strong>👔 Recruiter</strong></button>
                  <button className="glass-panel" onClick={() => { attendNetworkingEvent(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                    <strong>🤝 Networking</strong>
                    <div style={{ fontSize: '0.72rem', color: '#a78bfa', marginTop: '2px' }}>{networking}/100</div>
                  </button>
                </div>
              )}

              {/* Full-time: sector grid */}
              {jobMenu === 'full_time' && !jobSector && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {getSectors('full_time').map(sector => (
                    <button key={sector} className="glass-panel" onClick={() => setJobSector(sector)} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '1.5rem' }}>{SECTOR_META[sector]?.icon || '💼'}</div>
                      <strong style={{ fontSize: '0.9rem' }}>{SECTOR_META[sector]?.label || sector}</strong>
                    </button>
                  ))}
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', gridColumn: getSectors('full_time').length % 2 !== 0 ? 'span 2' : undefined, marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Full-time: job list for sector */}
              {jobMenu === 'full_time' && jobSector && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getSectorJobs('full_time', jobSector).map(c => {
                    const elig = checkCareerEligibility ? checkCareerEligibility(c) : { eligible: true, reason: '' };
                    const isActive = career?.id === c.id;
                    return (
                      <button key={c.id} className="glass-panel" disabled={!elig.eligible || isActive} onClick={() => { handleChooseJob(c.id); closeSheet(); }}
                        style={{ padding: '0.8rem', textAlign: 'left', background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)', opacity: elig.eligible ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong>{c.title}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '8px', flexShrink: 0 }}>Tier {c.tier}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#10b981' }}>${c.salary?.toLocaleString()}/yr</div>
                        {c.requiresDegree && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Req: {DEGREE_LABELS[c.requiresDegree] || c.requiresDegree}</div>}
                        {!elig.eligible && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>🔒 {elig.reason}</div>}
                        {isActive && <div style={{ fontSize: '0.72rem', color: '#34d399' }}>✓ Current job</div>}
                      </button>
                    );
                  })}
                  <button className="glass-panel" onClick={() => setJobSector(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Part-time: sector grid */}
              {jobMenu === 'part_time' && !jobSector && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {getSectors('part_time').map(sector => (
                    <button key={sector} className="glass-panel" onClick={() => setJobSector(sector)} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '1.5rem' }}>{SECTOR_META[sector]?.icon || '⏱️'}</div>
                      <strong style={{ fontSize: '0.9rem' }}>{SECTOR_META[sector]?.label || sector}</strong>
                    </button>
                  ))}
                  {getSectors('part_time').length === 0 && careersData.filter(c => c.type === 'part_time').map(c => {
                    const elig = checkCareerEligibility ? checkCareerEligibility(c) : { eligible: true, reason: '' };
                    return (
                      <button key={c.id} className="glass-panel" disabled={!elig.eligible} onClick={() => { handleChooseJob(c.id); closeSheet(); }}
                        style={{ padding: '0.8rem', textAlign: 'left', gridColumn: 'span 2', background: 'rgba(255,255,255,0.05)', opacity: elig.eligible ? 1 : 0.55 }}>
                        <strong>{c.title}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#10b981' }}>${c.salary?.toLocaleString()}/yr</div>
                        {!elig.eligible && <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>🔒 {elig.reason}</div>}
                      </button>
                    );
                  })}
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', gridColumn: 'span 2', marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Part-time: job list for sector */}
              {jobMenu === 'part_time' && jobSector && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getSectorJobs('part_time', jobSector).map(c => {
                    const elig = checkCareerEligibility ? checkCareerEligibility(c) : { eligible: true, reason: '' };
                    const isActive = career?.id === c.id;
                    return (
                      <button key={c.id} className="glass-panel" disabled={!elig.eligible || isActive} onClick={() => { handleChooseJob(c.id); closeSheet(); }}
                        style={{ padding: '0.8rem', textAlign: 'left', background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)', opacity: elig.eligible ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{c.title}</strong>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Tier {c.tier}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#10b981' }}>${c.salary?.toLocaleString()}/yr</div>
                        {!elig.eligible && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '3px' }}>🔒 {elig.reason}</div>}
                      </button>
                    );
                  })}
                  <button className="glass-panel" onClick={() => setJobSector(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Freelance */}
              {jobMenu === 'freelance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="glass-panel" onClick={() => { performGig('Ride Share Driver', 40); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🚗 Ride Share (+$40)</strong></button>
                  <button className="glass-panel" onClick={() => { performGig('Food Delivery', 30); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🍔 Food Delivery (+$30)</strong></button>
                  <button className="glass-panel" onClick={() => { performGig('Tutor', 50); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>📖 Private Tutor (+$50)</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Military */}
              {jobMenu === 'military' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Army'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.1)' }}><strong>🪖 Enlist in Army</strong></button>
                  <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Navy'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}><strong>⚓ Enlist in Navy</strong></button>
                  <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Air Force'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.1)' }}><strong>✈️ Enlist in Air Force</strong></button>
                  <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Marines'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(245, 158, 11, 0.1)' }}><strong>🎖️ Enlist in Marines</strong></button>
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Special Careers grid */}
              {jobMenu === 'special_careers' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {SPECIAL_CAREERS.map(sc => (
                    <button key={sc.id} className="glass-panel" onClick={() => setJobMenu(sc.id)} style={{ padding: '0.8rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                      <strong>{sc.icon} {sc.name}</strong>
                    </button>
                  ))}
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', gridColumn: SPECIAL_CAREERS.length % 2 !== 0 ? 'span 2' : undefined, marginTop: '6px' }}>Back</button>
                </div>
              )}

              {/* Special Career detail */}
              {SPECIAL_CAREERS.find(c => c.id === jobMenu) && (() => {
                const sc = SPECIAL_CAREERS.find(c => c.id === jobMenu);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '4px' }}>{sc.description}</div>
                    {sc.actions.map((action, i) => (
                      <button key={i} className="glass-panel" disabled={bank < (action.cost || 0)} onClick={() => {
                        if (action.cost) debugModifyBank(-action.cost);
                        if (action.specialAction === 'startStartup') { startStartup(); }
                        else { triggerActivityEvent(action.context); }
                        closeSheet();
                      }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong>{action.text}</strong>
                        {action.cost && <span style={{ color: '#ef4444', fontSize: '0.8rem', flexShrink: 0, marginLeft: '8px' }}>-${action.cost.toLocaleString()}</span>}
                      </button>
                    ))}
                    <button className="glass-panel" onClick={() => setJobMenu('special_careers')} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                  </div>
                );
              })()}

              {/* Education: structured degree enrollment */}
              {jobMenu === 'education' && (() => {
                const degreeTypes = ['associate', 'bachelor', 'master', 'phd'];
                const enrolled = education?.currentDegree;
                const completedList = [education?.highSchool && 'highSchool', ...degreeTypes.filter(d => education?.[d])].filter(Boolean);
                const availableToEnroll = degreeTypes.filter(d => {
                  if (education?.[d]) return false;
                  if (enrolled) return false;
                  const cfg = DEGREE_CONFIG[d];
                  return !cfg.requires || education?.[cfg.requires];
                });
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {enrolled && (
                      <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.15)', borderLeft: '4px solid #3b82f6' }}>
                        <strong>📖 Enrolled: {DEGREE_LABELS[enrolled.type]}</strong>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                          Year {(enrolled.yearsCompleted || 0) + 1} of {DEGREE_CONFIG[enrolled.type]?.years}
                          {' • '}-${DEGREE_CONFIG[enrolled.type]?.annualCost.toLocaleString()}/yr
                        </div>
                        <div style={{ marginTop: '6px', width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${((enrolled.yearsCompleted || 0) / (DEGREE_CONFIG[enrolled.type]?.years || 1)) * 100}%`, height: '100%', background: '#3b82f6' }} />
                        </div>
                      </div>
                    )}
                    {completedList.length > 0 && (
                      <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ✅ {completedList.map(d => DEGREE_LABELS[d]).join(' • ')}
                      </div>
                    )}
                    {availableToEnroll.map(d => {
                      const cfg = DEGREE_CONFIG[d];
                      const canAfford = cfg.annualCost === 0 || bank >= cfg.annualCost;
                      return (
                        <button key={d} className="glass-panel" disabled={!canAfford} onClick={() => { enrollInDegree(d); closeSheet(); }}
                          style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)', opacity: canAfford ? 1 : 0.55 }}>
                          <strong>🎓 Enroll: {DEGREE_LABELS[d]}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {cfg.years} yr{cfg.years !== 1 ? 's' : ''} • {cfg.annualCost === 0 ? 'Fully Funded' : `$${cfg.annualCost.toLocaleString()}/yr`}
                          </div>
                          {!canAfford && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>Need ${cfg.annualCost.toLocaleString()}/yr</div>}
                        </button>
                      );
                    })}
                    {enrolled && (
                      <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Finish your current degree before enrolling in another.
                      </div>
                    )}
                    {availableToEnroll.length === 0 && !enrolled && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {degreeTypes.every(d => education?.[d]) ? '🎓 All degrees completed!' : 'No degrees available — check prerequisites.'}
                      </div>
                    )}
                    <button className="glass-panel" onClick={() => { triggerActivityEvent('Applied to a Trade/Vocational School'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                      <strong>🔧 Trade/Vocational School</strong>
                    </button>
                    <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                  </div>
                );
              })()}

              {/* Recruiter */}
              {jobMenu === 'recruiter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Pay a premium for a headhunter to find high-tier placements.</div>
                  <button className="glass-panel" disabled={bank < 1000} onClick={() => { triggerActivityEvent('Paid a Headhunter $1000 to find an Executive level job'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255, 215, 0, 0.1)' }}>
                    <strong>Executive Placement (-$1,000)</strong>
                  </button>
                  <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
                </div>
              )}
            </>
          )}
        </ActionSheet>
        );
      })()}

      {activeSheet === 'activities' && (() => {
        // Resolve item lock state for the current menu
        const resolveItemState = (opt) => {
          // Yearly limit
          const trackId = `${activityMenu}__${opt.text}`;
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
          if (opt.specialAction === 'networking_mixer') { attendNetworkingEvent(); closeSheet(); return; }
          if (opt.specialAction) { handleSpecialSkill(opt.specialAction, opt.context); return; }
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
                const { locked, reason } = resolveItemState(opt);
                const cost = opt.cost ?? 0;
                const isYearlyDone = reason === '✓ Done this year';
                return (
                  <button key={i} className="glass-panel" disabled={locked} onClick={() => handleActivityClick(opt)}
                    style={{ padding: '1rem', textAlign: 'left', background: opt.bg || 'rgba(255,255,255,0.05)', opacity: locked ? (isYearlyDone ? 0.4 : 0.55) : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong>{opt.text}</strong>
                      {cost > 0 && <span style={{ fontSize: '0.75rem', color: '#ef4444', flexShrink: 0, marginLeft: '8px' }}>-${cost.toLocaleString()}</span>}
                    </div>
                    {opt.baseEffects && !locked && (
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
      {activeSheet === 'doctor' && (
        <ActionSheet title="Doctor" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { key: 'checkup',    label: 'General Checkup',  cost: 100,  desc: '+15 Health, +3 Happiness',  color: 'rgba(59,130,246,0.1)' },
              { key: 'therapy',    label: 'Therapy Session',  cost: 200,  desc: '+5 Health, +20 Happiness',  color: 'rgba(139,92,246,0.1)' },
              { key: 'specialist', label: 'Specialist Visit', cost: 500,  desc: '+25 Health, +5 Happiness',  color: 'rgba(16,185,129,0.1)' },
              { key: 'surgery',    label: 'Minor Surgery',    cost: 5000, desc: '+40 Health, -5 Happiness',  color: 'rgba(239,68,68,0.1)' },
            ].map(v => (
              <button key={v.key} className="glass-panel" disabled={bank < v.cost}
                onClick={() => { visitDoctor(v.key); closeSheet(); }}
                style={{ padding: '1rem', textAlign: 'left', background: v.color, opacity: bank < v.cost ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{v.label}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>-${v.cost.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{v.desc}</div>
                {bank < v.cost && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>Need ${v.cost.toLocaleString()}</div>}
              </button>
            ))}
          </div>
        </ActionSheet>
      )}

      {/* ── Lottery sheet ── */}
      {activeSheet === 'lottery' && (
        <ActionSheet title="Lottery" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              Jackpot: <strong style={{ color: '#10b981' }}>$10,000,000</strong> • Odds: 1 in 100,000
            </div>
            {[1, 5, 10, 50].map(n => (
              <button key={n} className="glass-panel" disabled={bank < n * 5}
                onClick={() => { playLottery(n); closeSheet(); }}
                style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.1)', opacity: bank < n * 5 ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Buy {n} Ticket{n > 1 ? 's' : ''}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>-${(n * 5).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </ActionSheet>
      )}

      {/* ── Casino sheet ── */}
      {activeSheet === 'casino' && (
        <ActionSheet title="Casino" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              45% win 2× • 25% get half back • 30% lose all
            </div>
            {[100, 500, 1000, 5000, 10000].map(amt => (
              <button key={amt} className="glass-panel" disabled={bank < amt}
                onClick={() => { goGamble(amt); closeSheet(); }}
                style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.1)', opacity: bank < amt ? 0.55 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>Bet ${amt.toLocaleString()}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Win: ${(amt * 2).toLocaleString()}</span>
                </div>
                {bank < amt && <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '2px' }}>Insufficient funds</div>}
              </button>
            ))}
          </div>
        </ActionSheet>
      )}

      {activeSheet === 'debug' && (
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

      {activeSheet === 'assets' && (
        <ActionSheet title={assetMenu ? (assetMenu.charAt(0).toUpperCase() + assetMenu.slice(1)) : "Assets"} onClose={() => { setAssetMenu(null); setActiveSheet(null); }}>
          {!assetMenu && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="glass-panel" onClick={() => setAssetMenu('finances')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>📈 Finances</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>View your net worth, cash flow & equity</div>
              </button>
              <button className="glass-panel" onClick={() => setAssetMenu('properties')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.1)' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🏡 Properties</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage {properties.length} real estate assets</div>
              </button>
              <button className="glass-panel" onClick={() => setAssetMenu('belongings')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.1)' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>💎 Belongings</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>View {belongings.length} personal items</div>
              </button>
              <button className="glass-panel" onClick={() => setAssetMenu('shopping')} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(236, 72, 153, 0.1)', marginTop: '10px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🛍️ Go Shopping</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Buy Vehicles, Real Estate & Luxuries</div>
              </button>
            </div>
          )}

          {assetMenu === 'finances' && (() => {
            const propVal = properties.reduce((acc, p) => acc + p.currentValue, 0);
            const belVal = belongings.reduce((acc, p) => acc + p.currentValue, 0);
            const netWorth = bank + propVal + belVal + (career && career.equity ? career.equity : 0);
            const inflow = career ? (career.salary || 0) : 0;
            const outflow = properties.reduce((acc, p) => acc + (p.upkeep || 0), 0) + belongings.reduce((acc, b) => acc + (b.upkeep || 0), 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#fff' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Total Net Worth</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#34d399' }}>${netWorth.toLocaleString()}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="glass-panel" style={{ padding: '1rem' }}><span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Liquid Cash</span><br/>${Math.floor(bank).toLocaleString()}</div>
                  <div className="glass-panel" style={{ padding: '1rem' }}><span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Properties</span><br/>${Math.floor(propVal).toLocaleString()}</div>
                  <div className="glass-panel" style={{ padding: '1rem' }}><span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Belongings</span><br/>${Math.floor(belVal).toLocaleString()}</div>
                  <div className="glass-panel" style={{ padding: '1rem' }}><span style={{color:'var(--text-secondary)', fontSize:'0.8rem'}}>Active Equity</span><br/>${(career && career.equity) ? career.equity.toLocaleString() : '0'}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                  <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #34d399' }}><span style={{color:'var(--text-secondary)'}}>Annual Inflow</span><br/>+${inflow.toLocaleString()}</div>
                  <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid #ef4444' }}><span style={{color:'var(--text-secondary)'}}>Annual Outflow</span><br/>-${outflow.toLocaleString()}</div>
                </div>
                <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
              </div>
            );
          })()}

          {assetMenu === 'properties' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedProp ? (
                <>
                  <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', marginBottom: '10px', background: 'rgba(255,255,255,0.05)' }}>
                    <strong>{selectedProp.name}</strong>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Current Value: ${Math.floor(selectedProp.currentValue).toLocaleString()}</div>
                  </div>
                  <button className="glass-panel" disabled={bank < 10000} onClick={() => { debugModifyBank(-10000); modifyProperty(selectedProp.id, 25000); triggerActivityEvent(`Spent $10,000 to drastically renovate and upgrade my ${selectedProp.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}>
                    <strong>🔨 Renovate (-$10,000)</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Increase property value.</div>
                  </button>
                  <button className="glass-panel" onClick={() => { triggerActivityEvent(`Threw a massive, wild house party at my ${selectedProp.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(236, 72, 153, 0.1)' }}>
                    <strong>🎉 Throw House Party</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Invite friends over.</div>
                  </button>
                  <button className="glass-panel" onClick={() => { sellAsset('property', selectedProp.id); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)' }}>
                    <strong>💰 Sell Asset</strong>
                    <div style={{ fontSize: '0.8rem', color: '#ffaaaa' }}>Liquidate for cash.</div>
                  </button>
                  <button className="glass-panel" onClick={() => setSelectedProp(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
                </>
              ) : (
                <>
                  {properties.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>You don't own any real estate.</div>
                  ) : (
                    properties.map(p => (
                      <div key={p.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Value: ${Math.floor(p.currentValue).toLocaleString()}</div>
                          <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>Tax: -${(p.upkeep || 0).toLocaleString()}/yr</div>
                        </div>
                        <button className="btn btn-primary" onClick={() => setSelectedProp(p)}>Manage</button>
                      </div>
                    ))
                  )}
                  <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
                </>
              )}
            </div>
          )}

          {assetMenu === 'belongings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {belongings.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>You don't own any personal items.</div>
              ) : (
                belongings.map(b => (
                  <div key={b.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{b.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Value: ${Math.floor(b.currentValue).toLocaleString()}</div>
                    </div>
                    <button className="btn btn-primary" onClick={() => { sellAsset('belonging', b.id); setAssetMenu(null); }}>Sell</button>
                  </div>
                ))
              )}
              <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
            </div>
          )}

          {assetMenu === 'shopping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-secondary)' }}>Real Estate Market</h3>
               <button className="glass-panel" disabled={bank < 250000} onClick={() => buyAsset('property', { name: "Suburban Home", cost: 250000, type: "house", upkeep: 2500 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Suburban Home - $250,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A starter home ($2,500/yr upkeep)</div>
               </button>
               <button className="glass-panel" disabled={bank < 120000} onClick={() => buyAsset('property', { name: "City Condo", cost: 120000, type: "condo", upkeep: 4000 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>City Condo - $120,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Downtown living ($4,000/yr HOA/upkeep)</div>
               </button>
               <button className="glass-panel" disabled={bank < 1200000} onClick={() => buyAsset('property', { name: "Modern Penthouse", cost: 1200000, type: "mansion", upkeep: 10000 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Modern Penthouse - $1,200,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Luxury living ($10,000/yr upkeep)</div>
               </button>
               <button className="glass-panel" disabled={bank < 5000000} onClick={() => buyAsset('property', { name: "Mega Mansion", cost: 5000000, type: "mansion", upkeep: 25000 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Mega Mansion - $5,000,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Compound ($25,000/yr upkeep)</div>
               </button>

               <h3 style={{ margin: '15px 0 5px 0', color: 'var(--text-secondary)' }}>Vehicle Dealership</h3>
               <button className="glass-panel" disabled={bank < 3000} onClick={() => buyAsset('vehicle', { name: "Used Clunker", cost: 3000, type: "car", upkeep: 100 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Used Clunker - $3,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Barely runs ($100/yr maintenance)</div>
               </button>
               <button className="glass-panel" disabled={bank < 40000} onClick={() => buyAsset('vehicle', { name: "Sedan", cost: 40000, type: "car", upkeep: 500 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>New Sedan - $40,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reliable ($500/yr maintenance)</div>
               </button>
               <button className="glass-panel" disabled={bank < 150000} onClick={() => buyAsset('vehicle', { name: "Supercar", cost: 150000, type: "car", upkeep: 3000 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Supercar - $150,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fast ($3,000/yr maintenance)</div>
               </button>
               <button className="glass-panel" disabled={bank < 4500000} onClick={() => buyAsset('vehicle', { name: "Luxury Yacht", cost: 4500000, type: "boat", upkeep: 100000 })} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                 <strong>Luxury Yacht - $4,500,000</strong>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ocean life ($100k/yr maintenance)</div>
               </button>

               <button className="glass-panel" onClick={() => setAssetMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
            </div>
          )}
        </ActionSheet>
      )}

      {activeSheet === 'relationships' && (() => {
        const getMood = (relation) => {
          if (relation >= 75) return { emoji: '😊', label: 'Happy',   color: '#4ade80' };
          if (relation >= 50) return { emoji: '😐', label: 'Neutral', color: '#fbbf24' };
          if (relation >= 25) return { emoji: '😒', label: 'Upset',   color: '#f97316' };
          return                       { emoji: '😡', label: 'Hostile', color: '#ef4444' };
        };

        const getStatusBadge = (rel) => {
          if (!rel.isAlive) return { label: 'Deceased', color: '#6b7280', bg: 'rgba(107,114,128,0.2)' };
          const map = {
            family:    { label: 'Family',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
            dating:    { label: 'Dating',   color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
            married:   { label: 'Married',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
            ex:        { label: 'Ex',       color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
            estranged: { label: 'Estranged',color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
            friend:    { label: 'Friend',   color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
          };
          return map[rel.status] ?? { label: rel.type, color: '#94a3b8', bg: 'rgba(255,255,255,0.1)' };
        };

        const tier = getWealthTier(bank);
        const activeLovers = relationships.filter(r => r.isAlive && (r.status === 'dating' || r.status === 'married'));
        const canPropose = selectedRel && selectedRel.status === 'dating' && selectedRel.relation >= 80 && age >= 18;
        const canMarry   = canPropose;
        const canBreakUp = selectedRel && (selectedRel.status === 'dating' || selectedRel.status === 'married');
        const canHaveChild = selectedRel && (selectedRel.status === 'married' || selectedRel.status === 'dating') && age >= 18 && age <= 55;

        return (
          <ActionSheet isOpen onClose={closeSheet} title={selectedRel ? selectedRel.name : 'Relationships'}>
            {selectedRel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Header: mood + status + relation bar */}
                {(() => {
                  const mood = getMood(selectedRel.relation);
                  const badge = getStatusBadge(selectedRel);
                  return (
                    <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '2.5rem' }}>{selectedRel.isAlive === false ? '🪦' : mood.emoji}</div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '8px 0', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        {selectedRel.isAlive !== false && (
                          <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', color: mood.color }}>{mood.label}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Age {selectedRel.age} · Relation {Math.round(selectedRel.relation)}%
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                        <div style={{ width: `${selectedRel.relation}%`, height: '100%', background: `hsl(${selectedRel.relation * 1.2}, 75%, 50%)`, borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })()}

                {selectedRel.isAlive === false ? (
                  <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.6, fontStyle: 'italic' }}>
                    {selectedRel.name} has passed away. They live on in your memories.
                  </div>
                ) : (
                  <>
                    {/* Universal actions */}
                    <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 10); triggerActivityEvent(`Spent quality time bonding with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.08)' }}>
                      <strong>Spend Quality Time</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+10 Relation · prevents decay this year</div>
                    </button>
                    <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 5); triggerActivityEvent(`Had a deep conversation with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59,130,246,0.1)' }}>
                      <strong>Have a Deep Conversation</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+5 Relation</div>
                    </button>

                    {/* Gifts — amounts scale with wealth tier */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {tier.giftAmounts.map((amt, gi) => {
                        const canAfford = bank >= amt;
                        const relGain = gi === 2 ? 20 : gi === 1 ? 10 : 5;
                        return (
                          <button key={amt} className="glass-panel" disabled={!canAfford} onClick={() => { giftRelationship(selectedRel.id, amt); closeSheet(); }}
                            style={{ flex: 1, padding: '0.7rem 0.4rem', textAlign: 'center', background: canAfford ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', opacity: canAfford ? 1 : 0.4 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4ade80' }}>Gift ${amt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{relGain} rel</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Family-specific */}
                    {selectedRel.status === 'family' && (
                      <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -5); debugModifyBank(500); triggerActivityEvent(`Desperately begged my ${selectedRel.type}, ${selectedRel.name} for $500.`); closeSheet(); }}
                        style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.08)' }}>
                        <strong>Ask for Money ($500)</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>−5 Relation · +$500</div>
                      </button>
                    )}

                    {/* Friend-specific */}
                    {selectedRel.status === 'friend' && (
                      <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 8); triggerActivityEvent(`Hung out with my friend ${selectedRel.name} and had a great time.`); closeSheet(); }}
                        style={{ padding: '1rem', textAlign: 'left', background: 'rgba(52,211,153,0.1)' }}>
                        <strong>Hang Out</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+8 Relation · +5 Happiness</div>
                      </button>
                    )}

                    {/* Romantic actions */}
                    {(selectedRel.status === 'dating' || selectedRel.status === 'married') && (
                      <>
                        {(() => {
                          const dateCost = tier.dateCost;
                          const canAffordDate = bank >= dateCost;
                          return (
                            <button className="glass-panel" disabled={!canAffordDate}
                              onClick={() => {
                                if (dateCost > 0) debugModifyBank(-dateCost);
                                modifyRelationship(selectedRel.id, 12);
                                triggerActivityEvent(`Went on a romantic date with ${selectedRel.name}.`);
                                closeSheet();
                              }}
                              style={{ padding: '1rem', textAlign: 'left', background: canAffordDate ? 'rgba(244,114,182,0.1)' : 'rgba(255,255,255,0.03)', opacity: canAffordDate ? 1 : 0.5 }}>
                              <strong>Go on a Date{dateCost > 0 ? ` ($${dateCost.toLocaleString()})` : ''}</strong>
                              <div style={{ fontSize: '0.8rem', color: canAffordDate ? 'var(--text-secondary)' : '#ef4444' }}>
                                {canAffordDate ? '+12 Relation' : `Need $${dateCost.toLocaleString()}`}
                              </div>
                            </button>
                          );
                        })()}
                        {canHaveChild && (
                          <button className="glass-panel" onClick={() => { haveChild(selectedRel.id); closeSheet(); }}
                            style={{ padding: '1rem', textAlign: 'left', background: 'rgba(251,191,36,0.1)' }}>
                            <strong>Have a Child 👶</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+20 Happiness</div>
                          </button>
                        )}
                        {canMarry && (
                          <button className="glass-panel" onClick={() => { proposeMarriage(selectedRel.id); closeSheet(); }}
                            style={{ padding: '1rem', textAlign: 'left', background: 'rgba(251,191,36,0.15)' }}>
                            <strong>Propose Marriage 💍</strong>
                            <div style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Relation ≥ 80 required</div>
                          </button>
                        )}
                        {!canMarry && selectedRel.status === 'dating' && (
                          <button className="glass-panel" disabled style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.03)', opacity: 0.4 }}>
                            <strong>Propose Marriage 💍</strong>
                            <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>Needs relation ≥ 80 (currently {Math.round(selectedRel.relation)})</div>
                          </button>
                        )}
                      </>
                    )}

                    {/* Destructive actions */}
                    {age >= 5 && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -20); triggerActivityEvent(`Got into a vicious argument with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }}
                          style={{ flex: 1, padding: '0.8rem', textAlign: 'center', background: 'rgba(239,68,68,0.15)' }}>
                          <strong style={{ color: '#fca5a5' }}>Argue</strong>
                          <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>−20 Relation</div>
                        </button>
                        <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -40); triggerActivityEvent(`Cruelly insulted my ${selectedRel.type}, ${selectedRel.name} to their face.`); closeSheet(); }}
                          style={{ flex: 1, padding: '0.8rem', textAlign: 'center', background: 'rgba(239,68,68,0.2)' }}>
                          <strong style={{ color: '#fca5a5' }}>Insult</strong>
                          <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>−40 Relation</div>
                        </button>
                      </div>
                    )}

                    {/* Break up / divorce */}
                    {canBreakUp && (
                      <button className="glass-panel" onClick={() => { breakUp(selectedRel.id); closeSheet(); }}
                        style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239,68,68,0.1)', marginTop: '4px' }}>
                        <strong style={{ color: '#ef4444' }}>{selectedRel.status === 'married' ? 'File for Divorce' : 'Break Up'}</strong>
                        <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                          {selectedRel.status === 'married' ? `Costs ~$${Math.min(50000, Math.max(5000, Math.floor(bank * 0.15))).toLocaleString()} · −15 Happiness` : '−15 Happiness'}
                        </div>
                      </button>
                    )}
                  </>
                )}

                <button className="glass-panel" onClick={() => setSelectedRel(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '8px' }}>← Back</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Jealousy warning banner */}
                {activeLovers.length > 1 && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem', color: '#fca5a5', marginBottom: '4px' }}>
                    ⚠️ You have {activeLovers.length} simultaneous partners. Jealousy is draining your happiness each year.
                  </div>
                )}

                {/* Meet Someone New */}
                {age >= 5 && (
                  <button className="glass-panel" onClick={() => { meetFriend(); closeSheet(); }}
                    style={{ padding: '1rem', textAlign: 'left', background: 'rgba(52,211,153,0.1)' }}>
                    <strong>Meet Someone New 🤝</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Make a new friend · +5 Happiness</div>
                  </button>
                )}
                {age >= 14 && (
                  <button className="glass-panel" onClick={() => { setActiveSheet('dating'); }}
                    style={{ padding: '1rem', textAlign: 'left', background: 'rgba(244,114,182,0.1)' }}>
                    <strong>Dating App 💖</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Find a romantic partner</div>
                  </button>
                )}

                <div style={{ margin: '8px 0 4px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Relationships</div>

                {(!relationships || relationships.length === 0) && (
                  <div style={{ textAlign: 'center', opacity: 0.5, padding: '1rem' }}>You have no known relationships.</div>
                )}
                {relationships && relationships.map(rel => {
                  const mood = getMood(rel.relation);
                  const badge = getStatusBadge(rel);
                  return (
                    <button key={rel.id} className="glass-panel" onClick={() => setSelectedRel(rel)}
                      style={{ padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: rel.isAlive === false ? 'rgba(107,114,128,0.05)' : 'rgba(255,255,255,0.05)', opacity: rel.isAlive === false ? 0.6 : 1 }}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold' }}>
                          {rel.isAlive === false ? '🪦 ' : ''}{rel.name}
                          <span style={{ marginLeft: '6px', padding: '1px 7px', borderRadius: '10px', fontSize: '0.7rem', background: badge.bg, color: badge.color }}>{badge.label}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Age {rel.age} · {rel.isAlive !== false ? mood.emoji + ' ' + mood.label : 'Passed Away'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                        <div style={{ width: '56px', height: '5px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px' }}>
                          <div style={{ width: `${rel.relation}%`, height: '100%', background: `hsl(${rel.relation * 1.2}, 75%, 50%)`, borderRadius: '3px' }} />
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{Math.round(rel.relation)}%</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ActionSheet>
        );
      })()}

      {activeSheet === 'dating' && (
        <ActionSheet title="Dating App" onClose={closeSheet}>
           {!datingMatch ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
               <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)' }}>
                 <h4 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)' }}>Search Preferences</h4>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                   <span>Age Group:</span>
                   <select value={datingPrefAge} onChange={e => setDatingPrefAge(e.target.value)} style={{ background: '#1e1e1e', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px', borderRadius: '4px' }}>
                     <option value="18-25">18-25</option>
                     <option value="26-35">26-35</option>
                     <option value="36-50">36-50</option>
                     <option value="50+">50+</option>
                   </select>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                   <span>Gender:</span>
                   <select value={datingPrefGender} onChange={e => setDatingPrefGender(e.target.value)} style={{ background: '#1e1e1e', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px', borderRadius: '4px' }}>
                     <option value="Any">Any</option>
                     <option value="Male">Male</option>
                     <option value="Female">Female</option>
                   </select>
                 </div>
               </div>
               <button className="glass-panel" disabled={bank < 20} onClick={handleSearchMatch} style={{ padding: '1.2rem', textAlign: 'center', background: 'rgba(236, 72, 153, 0.2)', fontSize: '1.1rem' }}>
                 <strong>🔍 Search Matches (-$20)</strong>
               </button>
             </div>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
               <div className="glass-panel" style={{ padding: '2rem', width: '100%', textAlign: 'center', position: 'relative', background: 'rgba(255,255,255,0.05)' }}>
                 <button onClick={() => setDatingMatch(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
                 <div style={{ fontSize: '4rem', marginBottom: '10px' }}>{datingMatch.gender === 'Female' ? '👩' : '👨'}</div>
                 <h2 style={{ margin: '0 0 5px 0' }}>{datingMatch.name}, {datingMatch.age}</h2>
                 <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>{datingMatch.gender}</p>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
                   <div>
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Looks</span>
                     <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--looks-color)' }}>{datingMatch.looks} <span style={{fontSize:'0.8rem', opacity:0.6}}>/100</span></div>
                   </div>
                   <div>
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Smarts</span>
                     <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--smarts-color)' }}>{datingMatch.smarts} <span style={{fontSize:'0.8rem', opacity:0.6}}>/100</span></div>
                   </div>
                 </div>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                 <button className="glass-panel" onClick={() => setDatingMatch(null)} style={{ padding: '1rem', background: 'rgba(255,255,255,0.1)' }}><strong>Pass</strong></button>
                 <button className="glass-panel" onClick={handleAskOut} style={{ padding: '1rem', background: 'rgba(236, 72, 153, 0.4)' }}><strong>Ask Out 💌</strong></button>
               </div>
             </div>
           )}
        </ActionSheet>
      )}

      {activeSheet === 'wills' && (
        <ActionSheet title="Will & Testament" onClose={closeSheet}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              Allocate percentages of your estate and belongings to your relationships. Remaining estate will be automatically heavily taxed or donated upon your death.
            </p>
            {relationships.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5, fontStyle: 'italic' }}>You have no recorded relationships to bequeath assets to.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                {relationships.map(rel => (
                  <div key={rel.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)' }}>
                    <div>
                      <strong>{rel.name}</strong> <span style={{ opacity: 0.7, fontSize: '0.8rem', marginLeft: '5px', color:'var(--text-muted)' }}>({rel.type})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input 
                        type="number" 
                        min="0" max="100" 
                        value={willDistribution[rel.id]} 
                        onChange={(e) => setWillDistribution(prev => ({...prev, [rel.id]: e.target.value}))}
                        style={{ width: '60px', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px', borderRadius: '4px', textAlign: 'right' }} 
                      />%
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Total Allocated:</span>
              <strong style={{ fontSize: '1.2rem', color: (Object.values(willDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0) > 100) ? '#ef4444' : '#34d399' }}>
                {Object.values(willDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0)}%
              </strong>
            </div>

            <button 
              className="glass-panel" 
              disabled={Object.values(willDistribution).reduce((sum, val) => sum + (parseInt(val) || 0), 0) > 100}
              onClick={handleCompleteWill} 
              style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.2)', marginTop: '10px' }}
            >
              <strong>Finalize Trust</strong>
            </button>
          </div>
        </ActionSheet>
      )}
    </div>
  );
}
