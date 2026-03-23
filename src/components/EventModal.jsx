import React from 'react';

export default function EventModal({ event, onChoice }) {
  if (!event) return null;

  return (
    <div className="animate-fade-in" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px', zIndex: 100
    }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', border: '1px solid var(--accent-primary)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-15px', right: '20px', background: 'var(--accent-primary)', padding: '5px 15px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>
          EVENT
        </div>
        <h3 className="mb-4 mt-2" style={{ lineHeight: '1.4' }}>{event.description}</h3>
        
        <div className="flex-column" style={{ gap: '0.8rem' }}>
          {event.choices.map((choice, i) => (
            <button 
              key={i} 
              className="btn btn-secondary" 
              onClick={() => onChoice(choice)}
              style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '1rem', whiteSpace: 'normal', height: 'auto', display: 'flex' }}
            >
              {choice.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
