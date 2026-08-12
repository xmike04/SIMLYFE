/**
 * Firebase App Check activation decision — pure so it can be unit-tested
 * (config/firebase.js is mocked wholesale in tests).
 *
 * App Check activates only when VITE_FIREBASE_APPCHECK_SITE_KEY holds a real
 * reCAPTCHA v3 site key. VITE_FIREBASE_APPCHECK_DEBUG_TOKEN supports local
 * dev against enforced projects: "true" asks the SDK to mint a debug token
 * (printed to the console), any other non-empty value is used verbatim.
 * Registration and enforcement live in the Firebase console — see
 * docs/architecture.md#security-rules.
 */
export function getAppCheckSetup(env) {
  const siteKey = env?.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (typeof siteKey !== 'string' || !siteKey || siteKey.startsWith('PLACEHOLDER')) {
    return { enabled: false, siteKey: null, debugToken: null };
  }
  const rawDebug = env?.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
  const debugToken = rawDebug === 'true'
    ? true
    : (typeof rawDebug === 'string' && rawDebug ? rawDebug : null);
  return { enabled: true, siteKey, debugToken };
}
