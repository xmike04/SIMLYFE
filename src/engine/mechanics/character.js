/** New-life admission only; existing saved names remain unchanged. JS length counts UTF-16 units. */
export function prepareCharacterName(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'invalid_name' };
  const name = raw.trim();
  if (name.length < 1 || name.length > 80) return { ok: false, reason: 'invalid_name' };
  return { ok: true, name };
}
