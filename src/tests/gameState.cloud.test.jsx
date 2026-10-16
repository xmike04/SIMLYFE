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

const teacher = { id: 'fixture_teacher', title: 'Fixture Teacher', type: 'full_time', sector: 'education', salary: 50000, minAge: 22, requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 }, healthEffect: -16, happinessEffect: -8 };
async function careerReady(fields = {}) {
  backend.getDocs.mockResolvedValue({ empty: false, docs: [{ data: () => teacher }] });
  backend.getDoc.mockResolvedValue(snapshot(savedLife('Career Player', { age: 30, education: { highSchool: true, bachelor: true }, networking: 30, stats: { health: 80, happiness: 80, smarts: 70, looks: 50 }, ...fields })));
  const hook = await ready();
  await waitFor(() => expect(hook.result.current.careersData[0]?.id).toBe('fixture_teacher'));
  await waitFor(() => expect(hook.result.current.character?.name).toBe('Career Player'));
  return hook;
}

describe('career action foundation through the actual hook', () => {
  it('commits once with full history and returns an acknowledged receipt', async () => {
    const { result } = await careerReady();
    let selected, duplicate;
    act(() => {
      const expectedBasis = result.current.quoteCareer(teacher.id).basis;
      selected = result.current.chooseCareer(teacher.id, { actionId: 'select-1', expectedBasis });
      duplicate = result.current.chooseCareer(teacher.id, { actionId: 'select-1', expectedBasis });
    });
    expect(selected.result.status).toBe('committed');
    expect(duplicate.result.code).toBe('duplicate_action');
    expect(result.current.career.id).toBe(teacher.id);
    expect(result.current.bank).toBe(12000);
    expect(result.current.history).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ career: { id: teacher.id }, careerMeta: { yearsInRole: 0 }, history: [{ action: { id: 'select-1' } }] });
    await act(async () => { expect((await selected.persistence).status).toBe('saved'); });
    expect(result.current.lastCareerAction.saveStatus).toBe('saved');
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });
  it('uses the latest snapshot for same-turn selection then quitting and preserves FIFO replacement', async () => {
    const { result } = await careerReady();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    let selected, quit;
    act(() => {
      selected = result.current.chooseCareer(teacher.id);
      quit = result.current.chooseCareer(null);
      result.current.resetLife();
    });
    expect(selected.result.status).toBe('committed');
    expect(quit.result.record.beforeCareerId).toBe(teacher.id);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(); await quit.persistence; });
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(3));
    expect(backend.setDoc.mock.calls[1][1].history).toHaveLength(2);
    expect(backend.setDoc.mock.calls[2]).toHaveLength(2);
    expect(backend.setDoc.mock.calls[2][1]).toMatchObject({ character: null, career: null, history: [] });
    expect(result.current.lastCareerAction).toBeNull();
  });
  it('retains committed employment on save failure and never retries the action', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await careerReady();
    backend.setDoc.mockRejectedValueOnce(new Error('private provider failure'));
    let selected;
    act(() => { selected = result.current.chooseCareer(teacher.id); });
    await act(async () => { expect((await selected.persistence).status).toBe('failed'); });
    expect(result.current.career.id).toBe(teacher.id);
    expect(result.current.lastCareerAction.saveStatus).toBe('failed');
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(result.current.currentEvent).toBeNull();
  });
  it('rejects a stale quote with no save and no persistent failure history', async () => {
    const { result } = await careerReady();
    const quote = result.current.quoteCareer(teacher.id);
    act(() => result.current.debugMaxStats());
    backend.setDoc.mockClear();
    let attempted;
    act(() => { attempted = result.current.chooseCareer(teacher.id, { expectedBasis: quote.basis }); });
    expect(attempted.result.code).toBe('stale_quote');
    expect(attempted.persistence).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    expect(result.current.history).toHaveLength(0);
  });
  it('restores acknowledged employment and deduplicates its history after remount', async () => {
    const first = await careerReady();
    let selected;
    act(() => { selected = first.result.current.chooseCareer(teacher.id, { actionId: 'restored-id' }); });
    await act(async () => { await selected.persistence; });
    const saved = JSON.parse(JSON.stringify(backend.setDoc.mock.calls[0][1]));
    first.unmount();
    backend.getDoc.mockResolvedValue(snapshot(saved));
    const second = await ready();
    await waitFor(() => expect(second.result.current.career?.id).toBe(teacher.id));
    act(() => { expect(second.result.current.chooseCareer(teacher.id, { actionId: 'restored-id' }).result.code).toBe('duplicate_action'); });
    expect(second.result.current.history).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });
});

describe('career lifecycle feedback boundaries', () => {
  it('rejects a pre-render command during a newly started annual transition', async () => {
    const { result } = await careerReady();
    const pending = deferred();
    generateDynamicEvent.mockReturnValueOnce(pending.promise);
    const staleChoose = result.current.chooseCareer;
    let aging, rejected;
    act(() => {
      aging = result.current.ageUp();
      rejected = staleChoose(teacher.id);
    });
    expect(rejected.result.code).toBe('action_locked');
    expect(result.current.career).toBeNull();
    await act(async () => { pending.resolve({ description: 'Year fixture', choices: [{ text: 'Continue', effects: {} }] }); await aging; });
    act(() => { expect(result.current.chooseCareer(teacher.id).result.code).toBe('action_locked'); });
  });
  it('keeps a pending write on its original account and ignores its feedback after switching', async () => {
    const { result } = await careerReady();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    let selected;
    act(() => { selected = result.current.chooseCareer(teacher.id); });
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Other account')));
    backend.signInWithEmailAndPassword.mockResolvedValue({ user: user('other-account', false) });
    await act(async () => { await result.current.signInWithEmail('fixture@example.com', 'fixture-password', 'signin'); });
    expect(result.current.character.name).toBe('Other account');
    await act(async () => { pending.resolve(); await selected.persistence; });
    expect(result.current.lastCareerAction).toBeNull();
    expect(result.current.career).toBeNull();
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][0]).toBe('users/guest/saves/currentLife');
  });
});
