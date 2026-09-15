import React, { useRef, useEffect, useState } from 'react';
import GameHeader from './game/GameHeader';
import GameSheets from './game/GameSheets';

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
  const { age, bank, stats, history, ageUp, isAging, currentEvent, consumeYearlyActivity, triggerActivityEvent, debugModifyBank, trainHiddenSkill } = engine;
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
      <GameHeader engine={engine} uiFrozen={uiFrozen} openSheet={openSheet} setActiveSheet={setActiveSheet} enableDevTools={ENABLE_DEV_TOOLS} />

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

      <GameSheets
        engine={engine}
        visibleSheet={visibleSheet}
        activityMenu={activityMenu}
        setActivityMenu={setActivityMenu}
        setActiveSheet={setActiveSheet}
        closeSheet={closeSheet}
        handleSpecialSkill={handleSpecialSkill}
        enableDevTools={ENABLE_DEV_TOOLS}
      />
    </div>
  );
}
