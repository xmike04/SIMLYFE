import React from 'react';
import { DEGREE_LABELS } from '../../engine/mechanics/education';
import { careerActionReason } from './careerActionMessages';

const statLabel = stat => stat.charAt(0).toUpperCase() + stat.slice(1);
const signedPoints = value => value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0';
const money = amount => `$${amount.toLocaleString()}`;

export function CareerActionFeedback({ feedback, onContinue }) {
  if (!feedback) return null;
  const result = feedback.result;
  const resultText = result?.status === 'committed'
    ? result.patch?.history?.at(-1)?.text || 'Your career decision was applied.'
    : careerActionReason(result?.code);
  const saveMessages = {
    pending: 'Saving…',
    saved: 'Saved to cloud.',
    failed: 'Not saved to cloud. Your career changed in this session, but reloading may lose it.',
    skipped: 'Cloud save unavailable. Your career changed in this session, but reloading may lose it.',
    not_requested: 'No save requested.',
  };
  return (
    <section className="glass-panel career-feedback" role={result?.status === 'rejected' ? 'alert' : 'status'} aria-label="Career outcome">
      <strong>Career outcome</strong>
      <p>{resultText}</p>
      <p className="career-save-status">{saveMessages[feedback.saveStatus] || 'Save status unavailable.'}</p>
      <button className="btn btn-secondary" onClick={onContinue}>Continue</button>
    </section>
  );
}

export default function CareerActionPanel({ quote, isSaving, onConfirm, onCancel }) {
  if (!quote) return (
    <section className="glass-panel career-decision" aria-label="Career decision preview">
      <p>Career details are unavailable. Close this preview and try again.</p>
      <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
    </section>
  );
  const isQuit = quote.targetId === null;
  const preview = quote.preview;
  const requirements = preview.requirements;
  const isNoop = ['already_employed_here', 'already_unemployed'].includes(quote.code);
  return (
    <section className="glass-panel career-decision" aria-label="Career decision preview">
      <h4>{isQuit ? `Leave ${preview.previousTitle || 'your position'}?` : preview.title}</h4>
      {isQuit ? (
        <>
          <p>Your {money(preview.previousSalary ?? 0)}/yr career salary ends when you quit. Future job income stops.</p>
          <p>No unemployment benefits are granted for voluntary quitting.</p>
          <p>Your tenure and promotion progress end with this role.</p>
        </>
      ) : (
        <>
          <p className="career-salary">Base annual salary: {money(preview.baseSalary)}/yr</p>
          <p>Estimated annual gross in your city: {money(preview.grossSalary)}/yr before tax.</p>
          <p className="career-detail">Income tax applies during the yearly simulation. No salary is paid on confirmation.</p>
          <div>
            <strong>Requirements</strong>
            <ul>
              <li>Age {requirements.minAge}+</li>
              <li>{requirements.degree ? DEGREE_LABELS[requirements.degree] || requirements.degree : 'No degree required'}</li>
              <li>Networking {requirements.networking}+</li>
              {Object.entries(requirements.stats).map(([stat, minimum]) => (
                <li key={stat}>{statLabel(stat)} {minimum}+</li>
              ))}
            </ul>
          </div>
          {preview.previousTitle && !isNoop && (
            <div className="career-replacement">
              <p>Replaces {preview.previousTitle} ({money(preview.previousSalary ?? 0)}/yr).</p>
              <p>Your tenure and promotion progress reset for the new role. Any current performance plan ends.</p>
            </div>
          )}
        </>
      )}
      {preview.previousId === 'founder' && !isNoop && (
        <p className="career-replacement">Leaving your founder role gives up its equity and future dividends.</p>
      )}
      <p>Immediate cost: {money(preview.immediateCost)}</p>
      <div>
        <strong>{isQuit ? 'Annual career effects after quitting' : "This role's annual effects"}</strong>
        <ul>
          <li>Health: {signedPoints(preview.annualEffects.health)} points/year</li>
          <li>Happiness: {signedPoints(preview.annualEffects.happiness)} points/year</li>
        </ul>
        <p className="career-detail">These career effects are part of the yearly simulation, not a complete forecast of the year.</p>
      </div>
      {!quote.eligible && <p className="career-rejection">{careerActionReason(quote.code, quote)}</p>}
      {isNoop && <p>{careerActionReason(quote.code, quote)}</p>}
      <div className="career-decision-controls">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={!quote.eligible || isNoop || isSaving} onClick={onConfirm}>
          {isQuit ? 'Confirm quit' : 'Confirm career'}
        </button>
      </div>
    </section>
  );
}
