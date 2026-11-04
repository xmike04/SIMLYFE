const SUBJECTS = {
  activity: 'Activity progress',
  year: 'Year progress',
  event_offered: 'Pending choice',
  event_resolved: 'Choice outcome',
};

export default function ContinuitySaveStatus({ feedback }) {
  const subject = feedback && SUBJECTS[feedback.kind];
  if (!subject) return null;
  const messages = {
    pending: `Saving ${subject.toLowerCase()}…`,
    saved: `${subject} saved to the cloud.`,
    failed: `${subject} remains in this session, but saving failed. Reloading may restore an older save.`,
    skipped: `${subject} remains in this session, but cloud saving is unavailable. Reloading may restore an older save.`,
  };
  const message = messages[feedback.saveStatus];
  if (!message) return null;
  return (
    <p className={`continuity-save-status continuity-save-status--${feedback.saveStatus}`} role="status" aria-label="Progress save status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
