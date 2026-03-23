import React, { useRef, useEffect, useState } from 'react';
import ActionSheet from './ActionSheet';
import { ACTIVITY_CATEGORIES, ACTIVITY_MENUS } from '../config/activities';
import { SPECIAL_CAREERS } from '../config/specialCareers';

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
  const { character, age, bank, stats, history, career, careersData, chooseCareer, ageUp, activitiesThisYear, performActivity, isAging, relationships, modifyRelationship, modifyProperty, performGig, executeTrade, startStartup, playLottery, goGamble, visitDoctor, surrender, addRelationship, triggerActivityEvent, belongings, properties, buyAsset, sellAsset, debugModifyBank, debugAddAge, debugMaxStats, studyHard } = engine;
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

  const [willDistribution, setWillDistribution] = useState({});

  const closeSheet = () => { setActiveSheet(null); setSelectedRel(null); setSelectedProp(null); setAssetMenu(null); setActivityMenu(null); setDatingMatch(null); setJobMenu(null); };

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
            Job: {career.title} (${career.salary.toLocaleString()}/yr)
          </p>
        )}
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
        const getJobTitle = () => {
          if (age < 18) return "Education";
          if (!jobMenu) return "Career & Income";
          if (jobMenu === 'full_time') return "Full-Time Jobs";
          if (jobMenu === 'part_time') return "Part-Time Jobs";
          if (jobMenu === 'freelance') return "Freelance Jobs";
          if (jobMenu === 'military') return "Military Enlistment";
          if (jobMenu === 'education') return "Higher Education";
          if (jobMenu === 'recruiter') return "Job Recruiters";
          if (jobMenu === 'special') return "Special Careers";
          const sc = SPECIAL_CAREERS.find(c => c.id === jobMenu);
          if (sc) return sc.name;
          return (jobMenu.charAt(0).toUpperCase() + jobMenu.slice(1));
        };
        return (
        <ActionSheet title={getJobTitle()} onClose={() => { setJobMenu(null); setActiveSheet(null); }}>
          {age < 18 ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.1)' }}>
                  <strong>{age < 11 ? "Elementary School" : (age < 14 ? "Middle School" : "High School")}</strong>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Grades: {stats.grades}/100</div>
                </div>
                <button className="glass-panel" onClick={() => { studyHard(); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                  <strong>📚 Study Hard</strong>
                </button>
                <button className="glass-panel" onClick={() => { triggerActivityEvent('Interacted with classmates at school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                  <strong>🗣️ Interact with Classmates</strong>
                </button>
                <button className="glass-panel" onClick={() => { triggerActivityEvent('Went to the administration office at school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                  <strong>🏫 Speak to Administrators</strong>
                </button>
                {age >= 16 && (
                  <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to drop out of high school'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)' }}>
                    <strong>Escalate: Drop Out</strong>
                  </button>
                )}
             </div>
          ) : (
            <>
              {career && !jobMenu && (
                <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)' }}>
                  <strong>Active: {career.title}</strong>
                  <div style={{ fontSize: '0.9rem', color: '#10b981' }}>{career.id === 'founder' ? `Equity Valuation: $${career.equity.toLocaleString()}` : `Salary: $${career.salary.toLocaleString()}/yr`}</div>
                  <button className="glass-panel" onClick={() => handleChooseJob(null)} style={{ marginTop: '10px', padding: '0.5rem', width: '100%' }}>Quit Position</button>
                </div>
              )}
              
              {!jobMenu ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                   <button className="glass-panel" onClick={() => setJobMenu('Full-Time Jobs')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>💼 Full-Time</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Part-Time Jobs')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>⏱️ Part-Time</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Freelance')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}><strong>🛠️ Freelance</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Military')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}><strong>🎖️ Military</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Special Careers')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}><strong>🌟 Special Careers</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Education')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}><strong>🎓 Education</strong></button>
                   <button className="glass-panel" onClick={() => setJobMenu('Job Recruiter')} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)' }}><strong>👔 Recruiter</strong></button>
                   
                   {!career && (
                     <button className="glass-panel" onClick={() => { startStartup(); closeSheet(); }} disabled={bank < 500} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(255,215,0,0.1)', gridColumn: 'span 2' }}>
                       <strong>🚀 Launch Tech Startup (-$500)</strong>
                     </button>
                   )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {jobMenu === 'Full-Time Jobs' && careersData.filter(c => c.type === 'full_time').map(c => (
                     <button key={c.id} className="glass-panel" onClick={() => { handleChooseJob(c.id); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                       <strong>{c.title}</strong>
                       <div style={{ fontSize: '0.8rem', color: '#10b981' }}>${c.salary.toLocaleString()}/yr</div>
                     </button>
                   ))}
                   {jobMenu === 'Full-Time Jobs' && careersData.filter(c => c.type === 'full_time').length === 0 && (
                     <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No full-time jobs available right now.</div>
                   )}
                   
                   {jobMenu === 'Part-Time Jobs' && careersData.filter(c => c.type === 'part_time').map(c => (
                     <button key={c.id} className="glass-panel" onClick={() => { handleChooseJob(c.id); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
                       <strong>{c.title}</strong>
                       <div style={{ fontSize: '0.8rem', color: '#10b981' }}>${c.salary.toLocaleString()}/yr</div>
                     </button>
                   ))}
                   {jobMenu === 'Part-Time Jobs' && careersData.filter(c => c.type === 'part_time').length === 0 && (
                     <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No part-time roles are hiring.</div>
                   )}
                   
                   {jobMenu === 'Freelance' && (
                     <>
                       <button className="glass-panel" onClick={() => { performGig('Ride Share Driver', 40); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>Ride Share (+$40)</strong></button>
                       <button className="glass-panel" onClick={() => { performGig('Food Delivery', 30); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>Food Delivery (+$30)</strong></button>
                       <button className="glass-panel" onClick={() => { performGig('Tutor', 50); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>Private Tutor (+$50)</strong></button>
                     </>
                   )}
                   
                   {jobMenu === 'Military' && (
                     <>
                       <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Army'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.1)' }}><strong>Enlist in Army</strong></button>
                       <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Navy'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}><strong>Enlist in Navy</strong></button>
                       <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Air Force'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.1)' }}><strong>Enlist in Air Force</strong></button>
                       <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Marines'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(245, 158, 11, 0.1)' }}><strong>Enlist in Marines</strong></button>
                     </>
                   )}

                   {jobMenu === 'Special Careers' && (
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                       {SPECIAL_CAREERS.map(sc => (
                         <button key={sc.id} className="glass-panel" onClick={() => setJobMenu(sc.id)} style={{ padding: '0.8rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
                           <strong>{sc.icon} {sc.name}</strong>
                         </button>
                       ))}
                     </div>
                   )}

                   {SPECIAL_CAREERS.find(c => c.id === jobMenu) && (
                     <>
                       <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '10px' }}>
                         {SPECIAL_CAREERS.find(c => c.id === jobMenu).description}
                       </div>
                       {SPECIAL_CAREERS.find(c => c.id === jobMenu).actions.map((action, i) => (
                         <button key={i} className="glass-panel" disabled={bank < (action.cost || 0)} onClick={() => {
                            if (action.cost) debugModifyBank(-action.cost);
                            if (action.context === 'specialAction:startStartup') { startStartup(); }
                            else { triggerActivityEvent(action.context); }
                            closeSheet();
                         }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{action.text}</strong>
                         </button>
                       ))}
                     </>
                   )}

                   {jobMenu === 'Education' && (
                     <>
                       <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Apply for higher education. Good grades increase your chances of acceptance and scholarships!</div>
                       <button className="glass-panel" onClick={() => { 
                         if (stats.grades > 85) triggerActivityEvent('Applied to a prestigious University and miraculously got accepted with a massive scholarship thanks to flawless grades!'); 
                         else if (stats.grades >= 60) triggerActivityEvent('Applied to a local University and got accepted.');
                         else triggerActivityEvent('Applied to University but was instantly rejected due to brutally poor high school grades.');
                         closeSheet(); 
                       }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.2)' }}><strong>Apply to University</strong></button>
                       <button className="glass-panel" onClick={() => { triggerActivityEvent('Applied to a Trade/Vocational School'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255, 255, 255, 0.05)' }}><strong>Trade School</strong></button>
                     </>
                   )}

                   {jobMenu === 'Job Recruiter' && (
                     <>
                       <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Pay a premium for a headhunter to find you high-tier placements.</div>
                       <button className="glass-panel" disabled={bank < 1000} onClick={() => { triggerActivityEvent('Paid a Headhunter $1000 to find an Executive level job'); closeSheet(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255, 215, 0, 0.1)' }}><strong>Executive Placement (-$1,000)</strong></button>
                     </>
                   )}

                   <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
                </div>
              )}
            </>
          )}
        </ActionSheet>
        );
      })()}

      {activeSheet === 'activities' && (
        <ActionSheet title={activityMenu ? ACTIVITY_CATEGORIES.find(c => c.id === activityMenu)?.name : "Activities"} onClose={() => { setActivityMenu(null); setActiveSheet(null); }}>
          {!activityMenu && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '10px' }}>
                {ACTIVITY_CATEGORIES.map(cat => {
                  const isLockedByAge = age < cat.minAge;
                  const isLockedByBank = cat.minBank && bank < cat.minBank;
                  const isDisabled = isLockedByAge || isLockedByBank;
                  
                  return (
                    <button 
                      key={cat.id} 
                      className="glass-panel" 
                      disabled={isDisabled} 
                      onClick={() => setActivityMenu(cat.id)} 
                      style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '15px', textAlign: 'left', background: cat.color }}
                    >
                      <div style={{ fontSize: '2rem' }}>{cat.icon}</div> 
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '1.2rem' }}>{cat.name}</strong>
                        {cat.minBank && <div style={{ fontSize: '0.8rem', color: isLockedByBank ? '#ef4444' : 'var(--text-secondary)' }}>Cost: ${cat.minBank}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button className="glass-panel" onClick={() => { surrender(); closeSheet(); }} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.2)', width: '100%', marginTop: '10px' }}>
                 <div style={{ fontSize: '1.5rem' }}>☠️</div> <strong style={{color:'#fca5a5'}}>SURRENDER</strong>
              </button>
            </>
          )}

          {activityMenu && ACTIVITY_MENUS[activityMenu] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {ACTIVITY_MENUS[activityMenu].map((opt, i) => (
                  <button 
                    key={i}
                    className="glass-panel" 
                    onClick={() => { 
                      if (opt.specialAction === 'open_wills_ui') {
                        setActiveSheet('wills');
                        setActivityMenu(null);
                      } else if (opt.specialAction === 'open_dating_ui') {
                        setActiveSheet('dating');
                        setActivityMenu(null);
                      } else if (opt.specialAction) {
                        handleSpecialSkill(opt.specialAction, opt.context);
                      } else {
                        triggerActivityEvent(opt.context); 
                        closeSheet(); 
                      }
                    }} 
                    style={{ padding: '1rem', textAlign: 'left', background: opt.bg || 'rgba(255,255,255,0.05)' }}
                  >
                    <strong>{opt.text}</strong>
                  </button>
                ))}
                <button className="glass-panel" onClick={() => setActivityMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
            </div>
          )}
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

      {activeSheet === 'relationships' && (
        <ActionSheet isOpen={activeSheet === 'relationships'} onClose={closeSheet} title={selectedRel ? selectedRel.name : "Relationships"}>
        {selectedRel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Relationship: {Math.round(selectedRel.relation)}%
            </div>
            <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 10); triggerActivityEvent(`Spent quality time bonding with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.1)' }}>
              <strong>Spend Quality Time</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Bond with them (+Relation)</div>
            </button>
            <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 5); triggerActivityEvent(`Had a very deep conversation with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}>
              <strong>Have a Conversation</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Talk about life (+Relation)</div>
            </button>
            <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -5); debugModifyBank(500); triggerActivityEvent(`Desperately begged my ${selectedRel.type}, ${selectedRel.name} for $500.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.1)' }}>
              <strong>Ask for Money</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Beg for $500 (-Relation)</div>
            </button>
            {age >= 5 && (
              <>
                <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -20); triggerActivityEvent(`Got into a vicious screaming match and argued with my ${selectedRel.type}, ${selectedRel.name}.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.2)' }}>
                  <strong>Argue</strong>
                  <div style={{ fontSize: '0.8rem', color: '#ffaaaa' }}>Start a fight (-Relation)</div>
                </button>
                <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -40); triggerActivityEvent(`Cruelly insulted my ${selectedRel.type}, ${selectedRel.name} right to their face.`); closeSheet(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.2)' }}>
                  <strong>Insult</strong>
                  <div style={{ fontSize: '0.8rem', color: '#ffaaaa' }}>Severely damage the relationship (--Relation)</div>
                </button>
              </>
            )}
            <button className="glass-panel" onClick={() => setSelectedRel(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '10px' }}>Back</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(!relationships || relationships.length === 0) && <div style={{ textAlign: 'center', opacity: 0.5 }}>You have no known relatives.</div>}
            {relationships && relationships.map(rel => (
              <button key={rel.id} className="glass-panel" onClick={() => setSelectedRel(rel)} style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ textAlign: 'left' }}>
                  <strong>{rel.name}</strong> <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({rel.type})</span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Age {rel.age}</div>
                </div>
                <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px' }}>
                  <div style={{ width: `${rel.relation}%`, height: '100%', background: `hsl(${rel.relation * 1.2}, 80%, 50%)`, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </ActionSheet>
      )}

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
