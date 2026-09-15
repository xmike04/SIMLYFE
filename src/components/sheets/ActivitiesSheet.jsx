import React from 'react';
import ActionSheet from '../ActionSheet';
import { ACTIVITY_CATEGORIES, ACTIVITY_MENUS } from '../../config/activities';
import { getCityById } from '../../config/cityData.js';
import { yearlyActivityTrackId } from '../../engine/gameState';

export default function ActivitiesSheet({
  engine, activityMenu, setActivityMenu, setActiveSheet,
  closeSheet, handleSpecialSkill,
}) {
  const { character, age, bank, stats, activitiesThisYear, performActivity, attendNetworkingEvent, adoptPet, emigrate, surrender } = engine;
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
}
