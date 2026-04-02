import React, { useState } from 'react';
import ActionSheet from '../ActionSheet';

const NAMES_M = ["Chris", "Alex", "Jordan", "Taylor", "Matt", "Ryan", "Josh", "Brandon", "Tyler", "Kevin", "Jacob"];
const NAMES_F = ["Jessica", "Ashley", "Amanda", "Sarah", "Jennifer", "Brittany", "Megan", "Rachel", "Lauren", "Emily"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];

export default function DatingSheet({ bank, stats, debugModifyBank, addRelationship, triggerActivityEvent, onClose }) {
  const [datingPrefAge, setDatingPrefAge] = useState('18-25');
  const [datingPrefGender, setDatingPrefGender] = useState('Any');
  const [datingMatch, setDatingMatch] = useState(null);

  const handleSearchMatch = () => {
    if (bank < 20) return;
    debugModifyBank(-20);

    let genAge = 18 + Math.floor(Math.random() * 8);
    if (datingPrefAge === '26-35') genAge = 26 + Math.floor(Math.random() * 10);
    if (datingPrefAge === '36-50') genAge = 36 + Math.floor(Math.random() * 15);
    if (datingPrefAge === '50+') genAge = 50 + Math.floor(Math.random() * 30);

    let genGender = datingPrefGender === 'Any' ? (Math.random() > 0.5 ? 'Male' : 'Female') : datingPrefGender;

    const firstNames = genGender === 'Male' ? NAMES_M : NAMES_F;
    const gName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;

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
    onClose();
  };

  return (
    <ActionSheet title="Dating App" onClose={onClose}>
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
  );
}
