import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameState } from '../engine/gameState';
import { buildLifeSave, LIFE_SAVE_KEYS } from '../engine/lifeSave';
import { generateDynamicEvent } from '../engine/llmService';

const backend = vi.hoisted(() => ({
  auth: { currentUser: null }, db: {},
  getDoc: vi.fn(), setDoc: vi.fn(), getDocs: vi.fn(), unsubscribe: vi.fn(),
  signInAnonymously: vi.fn(), linkWithPopup: vi.fn(), signInWithCredential: vi.fn(),
  signInWithPopup: vi.fn(), linkWithCredential: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn(), sendPasswordResetEmail: vi.fn(),
}));
const native = vi.hoisted(() => ({ enabled: false, credential: vi.fn() }));
vi.mock('../platform/nativeRuntime', () => ({ isAndroidNative: () => native.enabled }));
vi.mock('../platform/nativeGoogle', () => ({
  getNativeGoogleCredential: native.credential,
  isNativeGoogleCancellation: error => error?.code === 'CANCELED',
}));
vi.mock('../config/firebase', () => ({ auth: backend.auth, db: backend.db }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...parts) => parts.join('/'), collection: (_db, path) => path,
  getDoc: backend.getDoc, setDoc: backend.setDoc, getDocs: backend.getDocs,
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth, callback) => {
    queueMicrotask(() => callback(auth.currentUser));
    return backend.unsubscribe;
  },
  GoogleAuthProvider: class { static credentialFromError(error) { return error.credential; } },
  EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
  ...Object.fromEntries(Object.entries(backend).filter(([, value]) => typeof value === 'function')),
}));

const user = (uid, isAnonymous = true) => ({ uid, isAnonymous, getIdToken: vi.fn().mockResolvedValue('fixture-id-token') });
const snapshot = data => ({ exists: () => data != null, data: () => data });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const savedLife = (name = 'Saved Player', fields = {}) => buildLifeSave({
  character: { name, gender: 'Female', country: 'US' }, age: 33, bank: 12000, ...fields,
});
async function ready() {
  const rendered = renderHook(() => useGameState());
  await waitFor(() => expect(rendered.result.current.authAccount).not.toBeNull());
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  native.enabled = false;
  native.credential.mockReset().mockResolvedValue('native-google-credential');
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  backend.auth.currentUser = user('guest');
  backend.getDoc.mockReset().mockResolvedValue(snapshot(null));
  backend.getDocs.mockResolvedValue({ empty: true });
  backend.setDoc.mockResolvedValue(undefined);
  backend.signInAnonymously.mockResolvedValue({ user: user('fresh-guest') });
  generateDynamicEvent.mockResolvedValue({ description: 'Fixture year', choices: [{ text: 'Continue', effects: {} }] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('cloud lifecycle contract through the game hook', () => {
  it('queues a life started before anonymous auth and writes its latest snapshot as a replacement', async () => {
    const authReady = deferred();
    backend.auth.currentUser = null;
    backend.signInAnonymously.mockReturnValueOnce(authReady.promise);
    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(backend.signInAnonymously).toHaveBeenCalled());
    act(() => result.current.startLife('Early Player', 'Female', 'US'));
    act(() => result.current.performGig('Early gig', 500));
    expect(backend.setDoc).not.toHaveBeenCalled();
    await act(async () => authReady.resolve({ user: user('boot-guest') }));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    const [path, save, ...options] = backend.setDoc.mock.calls[0];
    expect(path).toBe('users/boot-guest/saves/currentLife');
    expect(options).toEqual([]);
    expect(save.character.name).toBe('Early Player');
    expect(save.bank).toBe(500);
    expect(save.history.at(-1).text).toContain('Early gig');
    expect(Object.keys(save).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
  });

  it('a reset before auth replaces the queued life with a complete blank save', async () => {
    const authReady = deferred();
    backend.auth.currentUser = null;
    backend.signInAnonymously.mockReturnValueOnce(authReady.promise);
    const { result } = renderHook(() => useGameState());
    await waitFor(() => expect(backend.signInAnonymously).toHaveBeenCalled());
    act(() => result.current.startLife('Early Player', 'Female', 'US'));
    act(() => result.current.resetLife());
    await act(async () => authReady.resolve({ user: user('boot-guest') }));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0]).toHaveLength(2);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ character: null, age: 0, career: null, pets: [], isDead: false });
  });

  it('adopts the persisted account and hydrates its save without minting a guest', async () => {
    backend.auth.currentUser = user('returning-player', false);
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Saved Player'));
    expect(result.current.bank).toBe(12000);
    expect(backend.signInAnonymously).not.toHaveBeenCalled();
    expect(backend.getDoc).toHaveBeenCalledWith('users/returning-player/saves/currentLife');
    expect(backend.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('bootstraps a guest only when no persisted auth session exists', async () => {
    backend.auth.currentUser = null;
    const { result } = await ready();
    expect(result.current.authAccount.uid).toBe('fresh-guest');
    expect(backend.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it.each(['startLife', 'resetLife'])('%s wins over a delayed boot save and replaces every save field', async boundary => {
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise);
    const { result } = await ready();
    act(() => result.current[boundary]('New Player', 'Female', 'US'));
    await act(async () => pending.resolve(snapshot(savedLife('Late Player', { isDead: true }))));
    expect(result.current.character?.name ?? null).toBe(boundary === 'startLife' ? 'New Player' : null);
    expect(result.current.isDead).toBe(false);
    const write = backend.setDoc.mock.calls.at(-1);
    expect(write).toHaveLength(2); // replace: setDoc receives no merge options
    expect(Object.keys(write[1]).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
    expect(write[1]).toMatchObject({ age: 0, isDead: false, career: null, pets: [], will: null });
  });

  it('ordinary actions merge complete snapshots with the new state and existing character', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    act(() => result.current.performGig('Fixture gig', 500));
    const [path, save, options] = backend.setDoc.mock.calls.at(-1);
    expect(path).toBe('users/guest/saves/currentLife');
    expect(options).toEqual({ merge: true });
    expect(save.bank).toBe(12500);
    expect(save.character.name).toBe('Saved Player');
    expect(save.history.at(-1).text).toContain('Fixture gig');
    expect(Object.keys(save).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
  });

  it('Google linking preserves the guest uid and current life', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    backend.linkWithPopup.mockResolvedValue({ user: user('guest', false) });
    let outcome;
    await act(async () => { outcome = await result.current.signInWithGoogle(); });
    expect(outcome).toEqual({ ok: true, mode: 'linked' });
    expect(result.current.authAccount).toMatchObject({ uid: 'guest', isAnonymous: false });
    expect(result.current.character.name).toBe('Saved Player');
    expect(backend.getDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('Google collision loads the other uid and later writes target that account', async () => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Guest life')))
      .mockResolvedValueOnce(snapshot(savedLife('Account life', { bank: 900 })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    backend.linkWithPopup.mockRejectedValueOnce({ code: 'auth/credential-already-in-use', credential: 'fixture-credential' });
    backend.signInWithCredential.mockResolvedValue({ user: user('owner', false) });
    await act(async () => { expect(await result.current.signInWithGoogle()).toEqual({ ok: true, mode: 'switched' }); });
    expect(result.current.character.name).toBe('Account life');
    expect(result.current.bank).toBe(900);
    act(() => result.current.performGig('New account gig', 20));
    expect(backend.setDoc.mock.calls.at(-1)[0]).toBe('users/owner/saves/currentLife');
  });

  it('Android Google links the native credential to the guest and keeps its life', async () => {
    native.enabled = true;
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Android life')));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    backend.linkWithCredential.mockResolvedValue({ user: user('guest', false) });
    await act(async () => { expect(await result.current.signInWithGoogle()).toEqual({ ok: true, mode: 'linked' }); });
    expect(backend.linkWithCredential).toHaveBeenCalledWith(backend.auth.currentUser, 'native-google-credential');
    expect(backend.linkWithPopup).not.toHaveBeenCalled();
    expect(backend.signInWithPopup).not.toHaveBeenCalled();
    expect(result.current.character.name).toBe('Android life');
    expect(result.current.authAccount.uid).toBe('guest');
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('Android credential collision loads the account save and rebinds later writes', async () => {
    native.enabled = true;
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Guest life')))
      .mockResolvedValueOnce(snapshot(savedLife('Google life')));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    backend.linkWithCredential.mockRejectedValueOnce({ code: 'auth/credential-already-in-use' });
    backend.signInWithCredential.mockResolvedValue({ user: user('native-owner', false) });
    await act(async () => { expect(await result.current.signInWithGoogle()).toEqual({ ok: true, mode: 'switched' }); });
    expect(backend.signInWithCredential).toHaveBeenCalledWith(backend.auth, 'native-google-credential');
    expect(result.current.character.name).toBe('Google life');
    act(() => result.current.performGig('Android gig', 30));
    expect(backend.setDoc.mock.calls.at(-1)[0]).toBe('users/native-owner/saves/currentLife');
  });

  it.each([
    ['CANCELED', 'cancelled'],
    ['auth/native-google-unavailable', 'native_google_unavailable'],
  ])('Android %s leaves the guest and its save intact', async (code, reason) => {
    native.enabled = true;
    native.credential.mockRejectedValueOnce({ code });
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    await act(async () => { expect(await result.current.signInWithGoogle()).toEqual({ ok: false, reason }); });
    expect(result.current.authAccount.uid).toBe('guest');
    expect(result.current.character.name).toBe('Saved Player');
    expect(backend.setDoc).not.toHaveBeenCalled();
    expect(backend.linkWithPopup).not.toHaveBeenCalled();
  });

  it('email signup links the guest without replacing its life', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    backend.linkWithCredential.mockResolvedValue({ user: user('guest', false) });
    await act(async () => { expect(await result.current.signInWithEmail('fixture@example.com', 'fixture-password')).toEqual({ ok: true, mode: 'linked' }); });
    expect(result.current.character.name).toBe('Saved Player');
    expect(backend.getDoc).toHaveBeenCalledTimes(1);
  });

  it('email account switching clears the previous life while its save loads', async () => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Old life')));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise);
    backend.signInWithEmailAndPassword.mockResolvedValue({ user: user('email-owner', false) });
    let signin;
    await act(async () => { signin = result.current.signInWithEmail('fixture@example.com', 'fixture-password', 'signin'); });
    await waitFor(() => expect(result.current.character).toBeNull());
    await act(async () => { pending.resolve(snapshot(savedLife('New life'))); await signin; });
    expect(result.current.character.name).toBe('New life');
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('signout clears this device and starts a guest without overwriting the account save', async () => {
    backend.auth.currentUser = user('owner', false);
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    await act(async () => { expect(await result.current.signOutAccount()).toEqual({ ok: true, mode: 'signed_out' }); });
    expect(result.current.character).toBeNull();
    expect(result.current.authAccount.uid).toBe('fresh-guest');
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('holds mutations during the annual LLM await and saves the calculated year afterward', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife()));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character).not.toBeNull());
    const pending = deferred();
    generateDynamicEvent.mockReturnValueOnce(pending.promise);
    let aging;
    await act(async () => { aging = result.current.ageUp(); });
    expect(result.current.isAging).toBe(true);
    const bank = result.current.bank;
    act(() => result.current.performGig('Must be blocked', 99999));
    expect(result.current.bank).toBe(bank);
    await act(async () => { pending.resolve({ description: 'Fixture event', choices: [{ text: 'Continue', effects: {} }] }); await aging; });
    expect(result.current.age).toBe(34);
    expect(result.current.isAging).toBe(false);
    expect(backend.setDoc.mock.calls.at(-1)[1]).toMatchObject({ age: 34, bank });
  });
});
