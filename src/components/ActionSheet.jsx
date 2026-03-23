import React from 'react';

export default function ActionSheet({ title, onClose, children }) {
  return (
    <div className="animate-fade-in" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      zIndex: 60
    }}>
      <div className="glass-panel animate-slide-up" style={{ 
        borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
        maxHeight: '85%', display: 'flex', flexDirection: 'column',
        padding: '1.5rem 1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.8rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.8rem', paddingBottom: '1rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
