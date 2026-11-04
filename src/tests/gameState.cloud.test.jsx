import { StrictMode } from 'react';
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
async function ready(options = {}) {
  const rendered = renderHook(() => useGameState(), options);
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


describe('career command commit and feedback', () => {
  async function loadCareerLife(fields = {}, options) {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Career Player', fields)));
    const rendered = await ready(options);
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Career Player'));
    return rendered;
  }

  it('quotes without mutation and commits one coherent decision in StrictMode', async () => {
    const { result } = await loadCareerLife({}, { wrapper: StrictMode });
    const before = result.current.history;
    expect(result.current.quoteCareer('electrician')).toMatchObject({ eligible: true, preview: { baseSalary: 42000 } });
    expect(result.current.history).toBe(before);
    expect(backend.setDoc).not.toHaveBeenCalled();
    let outcome;
    act(() => { outcome = result.current.chooseCareer('electrician', { actionId: 'first-job' }); });
    expect(outcome.result.status).toBe('committed');
    expect(result.current.career.id).toBe('electrician');
    expect(result.current.careerMeta.yearsInRole).toBe(0);
    expect(result.current.history.at(-1).action.id).toBe('first-job');
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({
      career: result.current.career, careerMeta: result.current.careerMeta, history: result.current.history,
    });
    await waitFor(() => expect(result.current.lastCareerAction.saveStatus).toBe('saved'));
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it('preserves earned compensation, tenure and PIP on active selection', async () => {
    const role = { id: 'barista', title: 'Barista', salary: 22000 };
    const meta = { yearsInRole: 7, isOnPIP: true, financialStressFlag: true, unemploymentYearsLeft: 0 };
    const { result } = await loadCareerLife({ career: role, careerMeta: meta });
    let outcome;
    act(() => { outcome = result.current.chooseCareer('barista'); });
    expect(outcome.result.status).toBe('noop');
    expect(result.current.career).toEqual(role);
    expect(result.current.careerMeta).toEqual(meta);
    expect(result.current.history).toHaveLength(0);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('uses eager state for repeated same-tick commands and deduplicates after switching', async () => {
    const { result } = await loadCareerLife();
    act(() => {
      expect(result.current.chooseCareer('barista', { actionId: 'a' }).result.status).toBe('committed');
      expect(result.current.chooseCareer('barista', { actionId: 'b' }).result.status).toBe('noop');
      expect(result.current.chooseCareer('electrician', { actionId: 'c' }).result.status).toBe('committed');
      expect(result.current.chooseCareer('barista', { actionId: 'a' }).result.status).toBe('noop');
    });
    expect(result.current.career.id).toBe('electrician');
    expect(result.current.history).toHaveLength(2);
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
  });

  it('quits once, preserves financial stress and grants no voluntary unemployment benefit', async () => {
    const { result } = await loadCareerLife({ career: { id: 'barista', title: 'Barista', salary: 20000 }, careerMeta: { yearsInRole: 4, isOnPIP: true, financialStressFlag: true, unemploymentYearsLeft: 2 } });
    act(() => {
      expect(result.current.chooseCareer(null).result.status).toBe('committed');
      expect(result.current.chooseCareer(null).result.status).toBe('noop');
    });
    expect(result.current.career).toBeNull();
    expect(result.current.careerMeta).toEqual({ yearsInRole: 0, isOnPIP: false, financialStressFlag: true, unemploymentYearsLeft: 0 });
    expect(result.current.history).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it.each(['unknown-role', 'doctor'])('rejects %s without a consequence or save', async jobId => {
    const { result } = await loadCareerLife();
    let outcome;
    act(() => { outcome = result.current.chooseCareer(jobId); });
    expect(outcome.result.status).toBe('rejected');
    expect(result.current.career).toBeNull();
    expect(result.current.history).toHaveLength(0);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('shows pending until acknowledgment and keeps a committed career when saving fails', async () => {
    const { result } = await loadCareerLife();
    let reject;
    backend.setDoc.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    act(() => result.current.chooseCareer('barista'));
    expect(result.current.lastCareerAction).toMatchObject({ result: { status: 'committed' }, saveStatus: 'pending' });
    await act(async () => reject(new Error('private provider detail')));
    expect(result.current.career.id).toBe('barista');
    expect(result.current.lastCareerAction).toMatchObject({ result: { status: 'committed' }, saveStatus: 'failed' });
    expect(JSON.stringify(result.current.lastCareerAction)).not.toContain('private provider detail');
  });

  it('reset clears feedback and ignores an older acknowledgment', async () => {
    const { result } = await loadCareerLife();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    act(() => result.current.chooseCareer('barista'));
    act(() => result.current.resetLife());
    expect(result.current.lastCareerAction).toBeNull();
    await act(async () => pending.resolve());
    expect(result.current.character).toBeNull();
    expect(result.current.lastCareerAction).toBeNull();
    await waitFor(() => expect(backend.setDoc.mock.calls.at(-1)[1].career).toBeNull());
  });

  it('account switching clears feedback and ignores the previous account save acknowledgment', async () => {
    const { result } = await loadCareerLife();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    act(() => result.current.chooseCareer('barista'));
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Other life')));
    backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('other', false) });
    await act(async () => { await result.current.signInWithEmail('other@example.com', 'fixture-password', 'signin'); });
    expect(result.current.character.name).toBe('Other life');
    expect(result.current.lastCareerAction).toBeNull();
    await act(async () => pending.resolve());
    expect(result.current.lastCareerAction).toBeNull();
  });

  it('ignores an older save receipt when a newer career command is pending', async () => {
    const { result } = await loadCareerLife();
    const first = deferred();
    const second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => {
      result.current.chooseCareer('barista', { actionId: 'first' });
      result.current.chooseCareer('electrician', { actionId: 'second' });
    });
    await act(async () => first.resolve());
    expect(result.current.lastCareerAction).toMatchObject({ actionId: 'second', saveStatus: 'pending' });
    await act(async () => second.resolve());
    expect(result.current.lastCareerAction).toMatchObject({ actionId: 'second', saveStatus: 'saved' });
  });

  it('rejects careers during the annual await including a same-tick call', async () => {
    const { result } = await loadCareerLife();
    const pending = deferred();
    generateDynamicEvent.mockReturnValueOnce(pending.promise);
    let aging;
    act(() => {
      aging = result.current.ageUp();
      expect(result.current.chooseCareer('barista').result.status).toBe('rejected');
    });
    expect(result.current.career).toBeNull();
    await act(async () => { pending.resolve({ description: 'Continue', choices: [{ text: 'OK', effects: {} }] }); await aging; });
    act(() => expect(result.current.chooseCareer('barista').result.status).toBe('rejected'));
  });
});


describe('canonical career lifecycle and preview basis', () => {
  async function loaded(fields = {}) {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Basis Player', fields)));
    const rendered = await ready();
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Basis Player'));
    return rendered;
  }

  it('rejects changed circumstances after preview and explicitly revalidates a refreshed quote', async () => {
    const { result } = await loaded();
    const staleQuote = result.current.quoteCareer('electrician');
    act(() => result.current.debugMaxStats());
    await waitFor(() => expect(result.current.stats.smarts).toBe(100));
    backend.setDoc.mockClear();
    let stale;
    act(() => { stale = result.current.chooseCareer('electrician', { actionId: 'preview', expectedBasis: staleQuote.basis }); });
    expect(stale.result).toMatchObject({ status: 'rejected', code: 'stale_quote' });
    expect(stale.persistence).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    expect(result.current.career).toBeNull();
    const fresh = result.current.quoteCareer('electrician');
    let confirmed;
    act(() => { confirmed = result.current.chooseCareer('electrician', { actionId: 'confirm', expectedBasis: fresh.basis }); });
    expect(confirmed.result.status).toBe('committed');
    await act(async () => { expect((await confirmed.persistence).status).toBe('saved'); });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it('supports same-turn choose then quit with complete history in both snapshots', async () => {
    const { result } = await loaded();
    let chosen, quit;
    act(() => {
      chosen = result.current.chooseCareer('barista', { actionId: 'choose' });
      quit = result.current.chooseCareer(null, { actionId: 'quit' });
    });
    expect(chosen.result.patch.history).toHaveLength(1);
    expect(quit.result.patch.history).toHaveLength(2);
    expect(result.current.career).toBeNull();
    await act(async () => { await chosen.persistence; await quit.persistence; });
    expect(backend.setDoc).toHaveBeenCalledTimes(2);
    expect(backend.setDoc.mock.calls.at(-1)[1]).toMatchObject({ career: null, history: quit.result.patch.history });
  });

  it('rejects conflicting committed command identity without saving', async () => {
    const { result } = await loaded();
    let first;
    act(() => { first = result.current.chooseCareer('barista', { actionId: 'unique' }); });
    await act(async () => { await first.persistence; });
    backend.setDoc.mockClear();
    let conflict;
    act(() => { conflict = result.current.chooseCareer('electrician', { actionId: 'unique' }); });
    expect(conflict.result).toMatchObject({ status: 'rejected', code: 'action_id_conflict' });
    expect(conflict.persistence).toBeNull();
    expect(result.current.career.id).toBe('barista');
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('unmount invalidates a pending feedback completion without another render', async () => {
    const { result, unmount } = await loaded();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    let decision;
    act(() => { decision = result.current.chooseCareer('barista'); });
    const before = result.current.lastCareerAction;
    unmount();
    await act(async () => { pending.resolve(); await decision.persistence; });
    expect(result.current.lastCareerAction).toBe(before);
  });

  it('remounts from an acknowledged career snapshot and preserves metadata alongside legacy history', async () => {
    const legacy = { age: 20, text: 'An existing memory' };
    const { result, unmount } = await loaded({ history: [legacy] });
    let selection;
    act(() => { selection = result.current.chooseCareer('electrician', { actionId: 'restore' }); });
    await act(async () => { await selection.persistence; });
    const acknowledged = structuredClone(backend.setDoc.mock.calls.at(-1)[1]);
    unmount();
    backend.getDoc.mockResolvedValueOnce(snapshot(acknowledged));
    const reloaded = await ready();
    await waitFor(() => expect(reloaded.result.current.career?.id).toBe('electrician'));
    expect(reloaded.result.current.history[0]).toEqual(legacy);
    expect(reloaded.result.current.history[1].action.id).toBe('restore');
    expect(reloaded.result.current.careerMeta.yearsInRole).toBe(0);
    expect(reloaded.result.current.lastCareerAction).toBeNull();
    backend.setDoc.mockClear();
    act(() => expect(reloaded.result.current.chooseCareer('electrician', { actionId: 'restore' }).result.code).toBe('duplicate_action'));
    expect(backend.setDoc).not.toHaveBeenCalled();
  });
});

it('still adopts the remote career catalog when a life boundary suppresses a delayed boot save', async () => {
  const pending = deferred();
  const remoteCareer = { id: 'remote_teacher', title: 'Remote Teacher', type: 'full_time', salary: 51000, minAge: 22, statRequirements: {} };
  backend.getDoc.mockReturnValueOnce(pending.promise);
  backend.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ data: () => remoteCareer }] });
  const { result } = await ready();
  act(() => result.current.startLife('New Life', 'Female', 'US'));
  await act(async () => pending.resolve(snapshot(savedLife('Obsolete Life'))));
  expect(result.current.character.name).toBe('New Life');
  await waitFor(() => expect(result.current.careersData).toEqual([remoteCareer]));
});
