let idTokenProvider = null;

/**
 * Connects the lazily loaded Firebase Auth user to services that need an ID
 * token without pulling the Firebase SDK into the initial application bundle.
 */
export function setFirebaseIdTokenProvider(provider) {
  idTokenProvider = typeof provider === 'function' ? provider : null;
}

export async function getFirebaseIdToken() {
  if (!idTokenProvider) return null;
  const token = await idTokenProvider();
  return typeof token === 'string' && token.trim() ? token : null;
}
