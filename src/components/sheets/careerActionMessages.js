const CAREER_ACTION_REASONS = Object.freeze({
  already_employed_here: 'You already work in this role. Your pay and progress are unchanged.',
  already_unemployed: 'You are already unemployed. Nothing changed.',
  duplicate_action: 'This career decision was already applied.',
  stale_quote: 'Career details changed. Review the updated preview and confirm again.',
  age_required: "You do not meet this role's minimum age requirement.",
  degree_required: 'You have not completed the degree required for this role.',
  networking_required: "Your networking is below this role's requirement.",
  stat_required: "Your stats do not meet this role's requirements.",
  unknown_career: 'This career is no longer available.',
  invalid_career: 'This career has invalid details and cannot be selected.',
  invalid_command: 'This career decision is invalid. Close the preview and try again.',
  action_id_conflict: 'This confirmation belongs to a different career decision. Close the preview and try again.',
  action_locked: 'Finish the current event or year before changing careers.',
  dead: 'This life has ended.',
});

/** Use a specific quoted requirement only when it explains this result's code. */
export function careerActionReason(code, quote) {
  if (quote?.code === code && typeof quote.reason === 'string' && quote.reason.trim()) return quote.reason;
  return Object.hasOwn(CAREER_ACTION_REASONS, code)
    ? CAREER_ACTION_REASONS[code]
    : 'This career decision could not be applied.';
}
