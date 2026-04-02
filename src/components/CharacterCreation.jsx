import React, { useState } from 'react';
import { getCitiesForCountry } from '../config/cityData.js';

export default function CharacterCreation({ onStartLife }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Female');
  const [country, setCountry] = useState('United States');
  const [selectedCity, setSelectedCity] = useState(() => {
    const cities = getCitiesForCountry('United States');
    return cities[0]?.id ?? '';
  });

  const handleCountryChange = (e) => {
    const newCountry = e.target.value;
    setCountry(newCountry);
    const cities = getCitiesForCountry(newCountry);
    setSelectedCity(cities[0]?.id ?? '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onStartLife(name.trim(), gender, country, selectedCity);
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
        <h2 className="mb-4 text-center">Your Story Starts Here</h2>
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
              onChange={handleCountryChange}
              style={inputStyle}
            >
              <option style={{color: 'black'}} value="United States">United States</option>
              <option style={{color: 'black'}} value="United Kingdom">United Kingdom</option>
              <option style={{color: 'black'}} value="Canada">Canada</option>
              <option style={{color: 'black'}} value="Australia">Australia</option>
              <option style={{color: 'black'}} value="Japan">Japan</option>
              <option style={{color: 'black'}} value="Brazil">Brazil</option>
              <option style={{color: 'black'}} value="Germany">Germany</option>
              <option style={{color: 'black'}} value="France">France</option>
              <option style={{color: 'black'}} value="India">India</option>
              <option style={{color: 'black'}} value="Mexico">Mexico</option>
              <option style={{color: 'black'}} value="South Korea">South Korea</option>
              <option style={{color: 'black'}} value="Nigeria">Nigeria</option>
              <option style={{color: 'black'}} value="South Africa">South Africa</option>
            </select>
          </div>
          <div>
            <label className="mb-1" style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>City</label>
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              style={inputStyle}
            >
              {getCitiesForCountry(country).map(city => (
                <option key={city.id} value={city.id} style={{color: 'black'}}>{city.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn mt-4">Start My Life</button>
        </form>
      </div>
    </div>
  );
}
