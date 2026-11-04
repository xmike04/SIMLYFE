const MESSAGES = {
  pending: 'Saving progress…',
  saved: 'Progress saved to the cloud.',
  failed: 'Progress remains in this session, but saving failed. Reloading may restore an older save.',
  skipped: 'Progress remains in this session, but cloud saving is unavailable. Reloading may restore an older save.',
};

export default function ContinuitySaveStatus({ feedback }) {
  const message = feedback && MESSAGES[feedback.saveStatus];
  if (!message) return null;
  return (
    <p className={`continuity-save-status continuity-save-status--${feedback.saveStatus}`} role="status" aria-label="Progress save status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
