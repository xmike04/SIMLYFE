import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';
import { getWealthTier } from '../../config/wealthTiers';

const getMood = (relation) => {
  if (relation >= 75) return { emoji: '😊', label: 'Happy',   color: '#4ade80' };
  if (relation >= 50) return { emoji: '😐', label: 'Neutral', color: '#fbbf24' };
  if (relation >= 25) return { emoji: '😒', label: 'Upset',   color: '#f97316' };
  return                     { emoji: '😡', label: 'Hostile', color: '#ef4444' };
};

const getStatusBadge = (rel) => {
  if (!rel.isAlive) return { label: 'Deceased', color: '#6b7280', bg: 'rgba(107,114,128,0.2)' };
  const map = {
    family:    { label: 'Family',    color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
    dating:    { label: 'Dating',    color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
    married:   { label: 'Married',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)'  },
    ex:        { label: 'Ex',        color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
    estranged: { label: 'Estranged', color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
    friend:    { label: 'Friend',    color: '#34d399', bg: 'rgba(52,211,153,0.15)'  },
  };
  return map[rel.status] ?? { label: rel.type, color: '#94a3b8', bg: 'rgba(255,255,255,0.1)' };
};

export default function RelationshipsSheet({
  bank, age, relationships,
  modifyRelationship, giftRelationship, proposeMarriage, breakUp, haveChild, meetFriend,
  triggerActivityEvent, debugModifyBank,
  onClose, onNavigateDating,
}) {
  const [selectedRel, setSelectedRel] = useState(null);

  const close = () => { setSelectedRel(null); onClose(); };

  const tier = getWealthTier(bank);
  const activeLovers = relationships.filter(r => r.isAlive && (r.status === 'dating' || r.status === 'married'));
  const canPropose   = selectedRel && selectedRel.status === 'dating' && selectedRel.relation >= 80 && age >= 18;
  const canBreakUp   = selectedRel && (selectedRel.status === 'dating' || selectedRel.status === 'married');
  const canHaveChild = selectedRel && (selectedRel.status === 'married' || selectedRel.status === 'dating') && age >= 18 && age <= 55;

  return (
    <ActionSheet isOpen onClose={close} title={selectedRel ? selectedRel.name : 'Relationships'}>
      {selectedRel ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Header: mood + status + relation bar */}
          {(() => {
            const mood  = getMood(selectedRel.relation);
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
              <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 10); triggerActivityEvent(`Spent quality time bonding with my ${selectedRel.type}, ${selectedRel.name}.`); close(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(255,255,255,0.08)' }}>
                <strong>Spend Quality Time</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+10 Relation · prevents decay this year</div>
              </button>
              <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 5); triggerActivityEvent(`Had a deep conversation with my ${selectedRel.type}, ${selectedRel.name}.`); close(); }} style={{ padding: '1rem', textAlign: 'left', background: 'rgba(59,130,246,0.1)' }}>
                <strong>Have a Deep Conversation</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+5 Relation</div>
              </button>

              {/* Gifts — amounts scale with wealth tier */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {tier.giftAmounts.map((amt, gi) => {
                  const canAfford = bank >= amt;
                  const relGain = gi === 2 ? 20 : gi === 1 ? 10 : 5;
                  return (
                    <button key={amt} className="glass-panel" disabled={!canAfford}
                      onClick={() => { giftRelationship(selectedRel.id, amt); close(); }}
                      style={{ flex: 1, padding: '0.7rem 0.4rem', textAlign: 'center', background: canAfford ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', opacity: canAfford ? 1 : 0.4 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#4ade80' }}>Gift ${amt.toLocaleString()}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{relGain} rel</div>
                    </button>
                  );
                })}
              </div>

              {/* Family-specific */}
              {selectedRel.status === 'family' && (
                <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -5); debugModifyBank(500); triggerActivityEvent(`Desperately begged my ${selectedRel.type}, ${selectedRel.name} for $500.`); close(); }}
                  style={{ padding: '1rem', textAlign: 'left', background: 'rgba(16,185,129,0.08)' }}>
                  <strong>Ask for Money ($500)</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>−5 Relation · +$500</div>
                </button>
              )}

              {/* Friend-specific */}
              {selectedRel.status === 'friend' && (
                <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, 8); triggerActivityEvent(`Hung out with my friend ${selectedRel.name} and had a great time.`); close(); }}
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
                        onClick={() => { if (dateCost > 0) debugModifyBank(-dateCost); modifyRelationship(selectedRel.id, 12); triggerActivityEvent(`Went on a romantic date with ${selectedRel.name}.`); close(); }}
                        style={{ padding: '1rem', textAlign: 'left', background: canAffordDate ? 'rgba(244,114,182,0.1)' : 'rgba(255,255,255,0.03)', opacity: canAffordDate ? 1 : 0.5 }}>
                        <strong>Go on a Date{dateCost > 0 ? ` ($${dateCost.toLocaleString()})` : ''}</strong>
                        <div style={{ fontSize: '0.8rem', color: canAffordDate ? 'var(--text-secondary)' : '#ef4444' }}>
                          {canAffordDate ? '+12 Relation' : `Need $${dateCost.toLocaleString()}`}
                        </div>
                      </button>
                    );
                  })()}
                  {canHaveChild && (
                    <button className="glass-panel" onClick={() => { haveChild(selectedRel.id); close(); }}
                      style={{ padding: '1rem', textAlign: 'left', background: 'rgba(251,191,36,0.1)' }}>
                      <strong>Have a Child 👶</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>+20 Happiness</div>
                    </button>
                  )}
                  {canPropose && (
                    <button className="glass-panel" onClick={() => { proposeMarriage(selectedRel.id); close(); }}
                      style={{ padding: '1rem', textAlign: 'left', background: 'rgba(251,191,36,0.15)' }}>
                      <strong>Propose Marriage 💍</strong>
                      <div style={{ fontSize: '0.8rem', color: '#fbbf24' }}>Relation ≥ 80 required</div>
                    </button>
                  )}
                  {!canPropose && selectedRel.status === 'dating' && (
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
                  <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -20); triggerActivityEvent(`Got into a vicious argument with my ${selectedRel.type}, ${selectedRel.name}.`); close(); }}
                    style={{ flex: 1, padding: '0.8rem', textAlign: 'center', background: 'rgba(239,68,68,0.15)' }}>
                    <strong style={{ color: '#fca5a5' }}>Argue</strong>
                    <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>−20 Relation</div>
                  </button>
                  <button className="glass-panel" onClick={() => { modifyRelationship(selectedRel.id, -40); triggerActivityEvent(`Cruelly insulted my ${selectedRel.type}, ${selectedRel.name} to their face.`); close(); }}
                    style={{ flex: 1, padding: '0.8rem', textAlign: 'center', background: 'rgba(239,68,68,0.2)' }}>
                    <strong style={{ color: '#fca5a5' }}>Insult</strong>
                    <div style={{ fontSize: '0.75rem', color: '#fca5a5' }}>−40 Relation</div>
                  </button>
                </div>
              )}

              {/* Break up / divorce */}
              {canBreakUp && (
                <button className="glass-panel" onClick={() => { breakUp(selectedRel.id); close(); }}
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
          {activeLovers.length > 1 && (
            <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem', color: '#fca5a5', marginBottom: '4px' }}>
              ⚠️ You have {activeLovers.length} simultaneous partners. Jealousy is draining your happiness each year.
            </div>
          )}
          {age >= 5 && (
            <button className="glass-panel" onClick={() => { meetFriend(); close(); }}
              style={{ padding: '1rem', textAlign: 'left', background: 'rgba(52,211,153,0.1)' }}>
              <strong>Meet Someone New 🤝</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Make a new friend · +5 Happiness</div>
            </button>
          )}
          {age >= 14 && (
            <button className="glass-panel" onClick={onNavigateDating}
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
            const mood  = getMood(rel.relation);
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
}
