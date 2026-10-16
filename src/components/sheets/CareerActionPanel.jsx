import React, { useRef, useState } from 'react';
import { DEGREE_LABELS } from '../../engine/mechanics/education';
import { createDiagnosticId } from '../../engine/diagnostics';

const messages = {
  career_selected: 'Your new role is confirmed. Salary is paid during annual progression.',
  career_quit: 'You left your role. Future years will no longer pay its salary.',
  stale_quote: 'Your circumstances or the career terms changed. Review the updated details before confirming again.',
  action_locked: 'Finish the current event or year before changing careers.',
  dead: 'This life has ended.',
  already_employed_here: 'You already hold this role. Your salary and tenure are unchanged.',
  already_unemployed: 'You are already unemployed.',
  duplicate_action: 'This decision was already recorded.',
};
const saveLabels = { pending: 'Saving…', saved: 'Saved to cloud', failed: 'Not saved to cloud', skipped: 'Cloud save unavailable' };
const signed = value => value > 0 ? `+${value}` : String(value).replace('-', '−');

export default function CareerActionPanel({ quote, chooseCareer, lastCareerAction, refreshQuote, onCancel, onContinue }) {
  const [attempt, setAttempt] = useState(null);
  const confirming = useRef(false);
  const feedback = lastCareerAction?.actionId === attempt?.actionId ? lastCareerAction : attempt;
  const completed = feedback && feedback.result.status !== 'rejected';
  const { preview, targetId } = quote;
  const confirm = () => {
    if (confirming.current || completed || !quote.eligible) return;
    confirming.current = true;
    const actionId = createDiagnosticId('operation');
    const response = chooseCareer(targetId, { actionId, expectedBasis: quote.basis });
    const result = response?.result;
    setAttempt({ actionId, result: result ?? { status: 'rejected', code: 'invalid_command' }, saveStatus: result?.status === 'committed' ? 'pending' : 'not_requested' });
    if (result?.code === 'stale_quote') refreshQuote();
    confirming.current = result?.status !== 'rejected' && !!result;
  };
  return (
    <section className="career-action-panel" aria-label="Career decision">
      <h3>{targetId === null ? 'Leave your current role' : preview.title}</h3>
      {targetId === null ? <p>You will lose future income from {preview.previousTitle}. Quitting does not create unemployment benefits.</p> : <>
        <p>Catalog salary: <strong>${preview.salary.toLocaleString()}/yr</strong></p>
        <p>City-adjusted gross estimate: <strong>${preview.grossSalary.toLocaleString()}/yr</strong>, before taxes and living costs.</p>
        <p>Annual role effects: Health {signed(preview.healthDelta)} · Happiness {signed(preview.happinessDelta)}. Other life events and aging also apply.</p>
        <p>Requirements: Age {preview.requirements.minAge}+ · {DEGREE_LABELS[preview.requirements.degree] ?? 'No degree required'} · Networking {preview.requirements.networking}+
          {Object.entries(preview.requirements.stats).map(([stat, minimum]) => ` · ${stat} ${minimum}+`)}</p>
        {preview.previousTitle && <p>This replaces your role as {preview.previousTitle} and starts tenure at zero.</p>}
      </>}
      <p>Immediate cost: $0.</p>
      {!quote.eligible && <p role="alert">{quote.reason}</p>}
      {feedback && <div role={feedback.result.status === 'rejected' || feedback.saveStatus === 'failed' ? 'alert' : 'status'}>
        <p>{messages[feedback.result.code] ?? quote.reason ?? 'This decision could not be completed.'}</p>
        {saveLabels[feedback.saveStatus] && <p>{saveLabels[feedback.saveStatus]}</p>}
        {feedback.saveStatus === 'failed' && <p>Your career changed in this session. Reloading may restore an older save.</p>}
      </div>}
      {!completed && <div className="career-action-buttons">
        <button className="glass-panel" disabled={!quote.eligible} onClick={confirm}>Confirm career change</button>
        <button className="glass-panel" onClick={onCancel}>Cancel</button>
      </div>}
      {completed && <button className="glass-panel" onClick={onContinue}>Continue</button>}
    </section>
  );
}
