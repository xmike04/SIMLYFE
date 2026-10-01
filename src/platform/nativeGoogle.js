/** Obtain Google credentials only; the existing Firebase JS session owns the life. */
export async function getNativeGoogleCredential(authApi) {
  if (import.meta.env.VITE_ANDROID_GOOGLE_AUTH_ENABLED !== 'true') {
    const error = new Error('Android Google sign-in is not configured.');
    error.code = 'auth/native-google-unavailable';
    throw error;
  }
  const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  if (!idToken) {
    const error = new Error('Google sign-in did not return a credential.');
    error.code = 'auth/invalid-credential';
    throw error;
  }
  return authApi.GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
}

export function isNativeGoogleCancellation(error) {
  return /cancel/i.test(String(error?.code ?? '')) || /cancel/i.test(String(error?.message ?? ''));
}
