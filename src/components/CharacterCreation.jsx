import React, { useState } from 'react';

export default function CharacterCreation({ onStartLife }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Female');
  const [country, setCountry] = useState('United States');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onStartLife(name, gender, country);
  };

  const inputStyle = {
    width: '100%', 
    padding: '0.8rem', 
    borderRadius: '8px', 
    border: '1px solid rgba(255,255,255,0.2)', 
    background: 'rgba(0,0,0,0.3)', 
    color: 'white',
    fontSize: '1rem'
  };

  return (
    <div className="flex-center animate-fade-in" style={{ height: '100%', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%' }}>
        <h2 className="mb-4 text-center">New Life</h2>
        <form onSubmit={handleSubmit} className="flex-column">
          <div>
            <label className="mb-1" style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>First & Last Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. John Doe"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label className="mb-1" style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gender</label>
            <select 
              value={gender} 
              onChange={e => setGender(e.target.value)}
              style={inputStyle}
            >
              <option style={{color: 'black'}} value="Female">Female</option>
              <option style={{color: 'black'}} value="Male">Male</option>
              <option style={{color: 'black'}} value="Non-binary">Non-binary</option>
            </select>
          </div>
          <div>
            <label className="mb-1" style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Country</label>
            <select 
              value={country} 
              onChange={e => setCountry(e.target.value)}
              style={inputStyle}
            >
              <option style={{color: 'black'}} value="United States">United States</option>
              <option style={{color: 'black'}} value="United Kingdom">United Kingdom</option>
              <option style={{color: 'black'}} value="Canada">Canada</option>
              <option style={{color: 'black'}} value="Australia">Australia</option>
              <option style={{color: 'black'}} value="Japan">Japan</option>
            </select>
          </div>
          <button type="submit" className="btn mt-4">Begin Life</button>
        </form>
      </div>
    </div>
  );
}
