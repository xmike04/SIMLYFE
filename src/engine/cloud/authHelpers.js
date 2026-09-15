/** Game rules extracted from the state owner; keep runtime behavior here testable. */

/** Privacy-lean auth summary for the account UI — never fed into diagnostics. */
export function summarizeAuthUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    isAnonymous: !!user.isAnonymous,
    provider: user.isAnonymous ? 'anonymous' : (user.providerData?.[0]?.providerId ?? 'unknown'),
    name: user.displayName ?? null,
    email: user.email ?? null,
    photo: user.photoURL ?? null,
  };
}

/** Validate email/password input before any auth call — sanitized reasons only. */
export function prepareEmailCredential(email, password) {
  const cleanEmail = typeof email === 'string' ? email.trim() : '';
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, reason: 'invalid_email' };
  }
  if (typeof password !== 'string' || password.length < 6) {
    return { ok: false, reason: 'weak_password' };
  }
  return { ok: true, email: cleanEmail };
}
