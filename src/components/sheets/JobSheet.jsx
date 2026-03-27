import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';
import { SPECIAL_CAREERS } from '../../config/specialCareers';
import { DEGREE_CONFIG, DEGREE_LABELS } from '../../engine/gameState';

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

export default function JobSheet({
  age, bank, stats, career, careersData, careerMeta, networking, education,
  chooseCareer, studyHard, triggerActivityEvent, performGig, attendNetworkingEvent,
  enrollInDegree, checkCareerEligibility, debugModifyBank, startStartup,
  onClose,
}) {
  const [jobMenu, setJobMenu] = useState(null);
  const [jobSector, setJobSector] = useState(null);

  const close = () => {
    setJobMenu(null);
    setJobSector(null);
    onClose();
  };

  const handleChooseJob = (id) => {
    chooseCareer(id);
    close();
  };

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
    <ActionSheet title={getTitle()} onClose={() => { setJobMenu(null); setJobSector(null); onClose(); }}>
      {age < 18 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '4px', background: 'rgba(59, 130, 246, 0.1)' }}>
            <strong>{age < 11 ? "Elementary School" : (age < 14 ? "Middle School" : "High School")}</strong>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Grades: {stats.grades}/100</div>
          </div>
          <button className="glass-panel" onClick={() => { studyHard(); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>📚 Study Hard</strong></button>
          <button className="glass-panel" onClick={() => { triggerActivityEvent('Interacted with classmates at school'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🗣️ Interact with Classmates</strong></button>
          <button className="glass-panel" onClick={() => { triggerActivityEvent('Went to the administration office at school'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🏫 Speak to Administrators</strong></button>
          {age >= 16 && (
            <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to drop out of high school'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(239, 68, 68, 0.1)' }}><strong>Escalate: Drop Out</strong></button>
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
              <button className="glass-panel" onClick={() => { attendNetworkingEvent(); close(); }} style={{ padding: '1rem', textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)' }}>
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
                  <button key={c.id} className="glass-panel" disabled={!elig.eligible || isActive} onClick={() => { handleChooseJob(c.id); }}
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
                  <button key={c.id} className="glass-panel" disabled={!elig.eligible} onClick={() => { handleChooseJob(c.id); }}
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
                  <button key={c.id} className="glass-panel" disabled={!elig.eligible || isActive} onClick={() => { handleChooseJob(c.id); }}
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
              <button className="glass-panel" onClick={() => { performGig('Ride Share Driver', 40); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🚗 Ride Share (+$40)</strong></button>
              <button className="glass-panel" onClick={() => { performGig('Food Delivery', 30); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>🍔 Food Delivery (+$30)</strong></button>
              <button className="glass-panel" onClick={() => { performGig('Tutor', 50); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}><strong>📖 Private Tutor (+$50)</strong></button>
              <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
            </div>
          )}

          {/* Military */}
          {jobMenu === 'military' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Army'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(16, 185, 129, 0.1)' }}><strong>🪖 Enlist in Army</strong></button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Navy'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(59, 130, 246, 0.1)' }}><strong>⚓ Enlist in Navy</strong></button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Air Force'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(139, 92, 246, 0.1)' }}><strong>✈️ Enlist in Air Force</strong></button>
              <button className="glass-panel" onClick={() => { triggerActivityEvent('Attempted to enlist in the Marines'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(245, 158, 11, 0.1)' }}><strong>🎖️ Enlist in Marines</strong></button>
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
                    close();
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
                    <button key={d} className="glass-panel" disabled={!canAfford} onClick={() => { enrollInDegree(d); close(); }}
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
                <button className="glass-panel" onClick={() => { triggerActivityEvent('Applied to a Trade/Vocational School'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255,255,255,0.05)' }}>
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
              <button className="glass-panel" disabled={bank < 1000} onClick={() => { triggerActivityEvent('Paid a Headhunter $1000 to find an Executive level job'); close(); }} style={{ padding: '0.8rem', textAlign: 'left', background: 'rgba(255, 215, 0, 0.1)' }}>
                <strong>Executive Placement (-$1,000)</strong>
              </button>
              <button className="glass-panel" onClick={() => setJobMenu(null)} style={{ padding: '0.8rem', textAlign: 'center', marginTop: '6px' }}>Back</button>
            </div>
          )}
        </>
      )}
    </ActionSheet>
  );
}
