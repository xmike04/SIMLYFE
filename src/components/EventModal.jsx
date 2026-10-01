import React, { useState } from 'react';

export default function EventModal({ event, onChoice, onReport }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('offensive');
  const [sending, setSending] = useState(false);
  const [reportStatus, setReportStatus] = useState('');
  async function submitReport() {
    setSending(true);
    try {
      const result = await onReport(event, reason);
      setReportStatus(result?.ok ? 'Report received. Your event is still waiting for your choice.' : 'Report could not be sent. Please try again when connected.');
    } catch {
      setReportStatus('Report could not be sent. Please try again when connected.');
    } finally { setSending(false); }
  }
  if (!event) return null;

  return (
    <div className="event-overlay animate-fade-in" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '20px', zIndex: 100
    }}>
      <div className="glass-panel animate-slide-up" style={{ width: '100%', border: '1px solid var(--accent-primary)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '12px', right: '20px', background: 'var(--accent-primary)', padding: '5px 15px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>
          EVENT
        </div>
        {event.meta?.requestId && onReport && <div className="support-request">
          {!reporting ? <button className="support-link" onClick={() => setReporting(true)}>Report this AI event</button> : <>
            <p>Send this event and its choices to the SIMLYFE developer for review. Your full life and credentials are not included.</p>
            <label>Report reason <select value={reason} onChange={e => setReason(e.target.value)}>
              <option value="offensive">Offensive content</option><option value="unsafe">Unsafe content</option><option value="other">Other issue</option>
            </select></label>
            <button className="btn btn-secondary" disabled={sending} onClick={submitReport}>{sending ? 'Sending…' : 'Send report'}</button>
            <button className="support-link" disabled={sending} onClick={() => setReporting(false)}>Cancel report</button>
          </>}
          {reportStatus && <p role="status">{reportStatus}</p>}
        </div>}
        <h3 className="mb-4 mt-2" style={{ lineHeight: '1.4' }}>{event.description}</h3>
        
        <div className="flex-column" style={{ gap: '0.8rem' }}>
          {(event.choices || []).map((choice, i) => (
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
