const EDUCATION_ACTION_REASONS = Object.freeze({
  stale_quote: 'Enrollment details changed. Review the updated preview and confirm again.',
  invalid_command: 'This enrollment decision is invalid. Close the preview and try again.',
  invalid_state: 'Your education details are unavailable. Close the preview and try again.',
  dead: 'This life has ended.',
  unknown_degree: 'This degree is no longer available.',
  already_enrolled: 'Finish your current degree before enrolling in another.',
  prerequisite_required: 'Complete the required degree before enrolling.',
  insufficient_funds: 'You need enough money for the first year of tuition.',
  action_locked: 'Finish the current event or year before enrolling.',
  action_id_conflict: 'This confirmation belongs to a different decision. Close the preview and try again.',
  duplicate_action: 'This enrollment was already applied.',
});

export function educationActionReason(code, refreshedQuote) {
  if (refreshedQuote && refreshedQuote.code === code && typeof refreshedQuote.reason === 'string' && refreshedQuote.reason.trim()) return refreshedQuote.reason;
  return Object.hasOwn(EDUCATION_ACTION_REASONS, code)
    ? EDUCATION_ACTION_REASONS[code]
    : 'The enrollment could not be completed. Close the preview and try again.';
}
