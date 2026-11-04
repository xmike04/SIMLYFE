import React from 'react';
import { DEGREE_LABELS } from '../../engine/mechanics/education';
import { educationActionReason } from './educationActionMessages';

const money = amount => `$${amount.toLocaleString()}`;

export function EducationActionFeedback({ feedback, onContinue }) {
  if (!feedback) return null;
  const result = feedback.result;
  const committed = result?.status === 'committed';
  const messages = {
    pending: 'Saving…',
    saved: 'Saved to cloud.',
    failed: 'Not saved to cloud. Your enrollment remains in this session. Reloading uses the last acknowledged save.',
    skipped: 'Cloud save unavailable. Your enrollment remains in this session. Reloading uses the last acknowledged save.',
    not_requested: 'No save requested.',
  };
  return (
    <section className="glass-panel education-feedback" role={result?.status === 'rejected' ? 'alert' : 'status'} aria-label="Education outcome">
      <strong>Education outcome</strong>
      <p>{committed ? result.patch?.history?.at(-1)?.text || 'You enrolled in your degree program.' : educationActionReason(result?.code)}</p>
      <p className="education-detail">{messages[feedback.saveStatus] || 'Save status unavailable.'}</p>
      <button className="btn btn-secondary" onClick={onContinue}>Continue</button>
    </section>
  );
}

export default function EducationActionPanel({ quote, isSaving, onConfirm, onCancel }) {
  const preview = quote?.preview;
  return (
    <section className="glass-panel education-decision" aria-label="Education decision preview">
      <h4>Review Enrollment</h4>
      {!preview ? <p role="alert">{educationActionReason()}</p> : <>
        <strong>{preview.label}</strong>
        <p>Prerequisite: {DEGREE_LABELS[preview.prerequisiteDegree] || preview.prerequisiteDegree} — {preview.prerequisiteMet ? 'met' : 'not met'}</p>
        <p>Program length: {preview.programYears} years</p>
        <dl className="education-costs">
          <div><dt>Pay now: {money(preview.firstYearTuition)}</dt><dd>First year of tuition</dd></div>
          <div><dt>Annual tuition: {money(preview.annualTuition)}</dt></div>
          <div><dt>Remaining tuition: {money(preview.remainingTuition)}</dt></div>
          <div><dt>Total tuition: {money(preview.totalTuition)}</dt></div>
          <div><dt>Balance before enrollment: {money(preview.bankBefore)}</dt></div>
          <div><dt>Balance after enrollment: {money(preview.bankAfterEnrollment)}</dt></div>
        </dl>
        <p>Later tuition is charged on Age clicks and may make your balance negative.</p>
        <p>{preview.ageUpsToCompletion} later Age clicks to completion, projected at age {preview.completionAge}.</p>
        <p className="education-detail">Projected age assumes uninterrupted annual progression in this life.</p>
        <strong>Completion bonuses</strong>
        <ul><li>Smarts: +{preview.completionSmartsBonus}</li><li>Happiness: +{preview.completionHappinessBonus}</li></ul>
        {preview.annualHappinessEffect < 0 && <>
          <p>{preview.ageUpsToCompletion} annual ticks of −{Math.abs(preview.annualHappinessEffect)} happiness, including the completion tick; the completion bonus follows that tick.</p>
          <p>No immediate happiness debit on enrollment. Happiness changes clamp to 0–100, so the net change depends on your happiness.</p>
        </>}
        {!quote.eligible && <p className="education-rejection">{educationActionReason(quote.code, quote)}</p>}
      </>}
      <div className="education-decision-controls">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={!preview || !quote?.eligible || isSaving} onClick={onConfirm}>Confirm enrollment</button>
      </div>
    </section>
  );
}
