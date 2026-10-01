import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNativeGoogleCredential, isNativeGoogleCancellation } from '../platform/nativeGoogle';

const native = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock('@capacitor-firebase/authentication', () => ({ FirebaseAuthentication: { signInWithGoogle: native.signIn } }));
const credential = vi.fn((idToken, accessToken) => ({ idToken, accessToken }));
const authApi = { GoogleAuthProvider: { credential } };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('VITE_ANDROID_GOOGLE_AUTH_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
describe('native Google credential adapter', () => {
  it('returns a JS credential and explicitly avoids a second native Firebase session', async () => {
    native.signIn.mockResolvedValue({ credential: { idToken: 'fixture-id', accessToken: 'fixture-access' } });
    expect(await getNativeGoogleCredential(authApi)).toEqual({ idToken: 'fixture-id', accessToken: 'fixture-access' });
    expect(native.signIn).toHaveBeenCalledWith({ skipNativeAuth: true });
  });
  it('does not invoke native auth when the build has no OAuth configuration', async () => {
    vi.stubEnv('VITE_ANDROID_GOOGLE_AUTH_ENABLED', 'false');
    await expect(getNativeGoogleCredential(authApi)).rejects.toMatchObject({ code: 'auth/native-google-unavailable' });
    expect(native.signIn).not.toHaveBeenCalled();
  });
  it('rejects incomplete native credentials before trying to link the guest', async () => {
    native.signIn.mockResolvedValue({ credential: {} });
    await expect(getNativeGoogleCredential(authApi)).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(credential).not.toHaveBeenCalled();
  });
  it('recognizes platform cancellation without exposing provider messages', () => {
    expect(isNativeGoogleCancellation({ code: 'CANCELED' })).toBe(true);
    expect(isNativeGoogleCancellation({ message: 'User cancelled sign-in' })).toBe(true);
    expect(isNativeGoogleCancellation({ code: 'auth/network-request-failed' })).toBe(false);
  });
});
