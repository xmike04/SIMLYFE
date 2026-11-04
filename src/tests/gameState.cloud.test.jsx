import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameState } from '../engine/gameState';
import { buildLifeSave, LIFE_SAVE_KEYS } from '../engine/lifeSave';
import { generateDynamicEvent } from '../engine/llmService';
import { getFirebaseIdToken } from '../engine/firebaseToken';

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
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
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


const offeredEvent = {
  version: 1, id: 'annual-30', age: 30, source: 'annual',
  description: 'A saved opportunity', choices: [{ text: 'Consider it', effects: { bank: 10 } }],
};
const continuityFixtures = [
  { name: 'versioned', fields: { flags: ['opportunity_seen'], activitiesThisYear: { 'vacation__Staycation': 1 }, currentEvent: offeredEvent }, flags: ['opportunity_seen'], counters: { 'vacation__Staycation': 1 }, source: 'annual', warning: false },
  { name: 'legacy', fields: { currentEvent: { description: 'Legacy opportunity', choices: [{ text: 'Continue', effects: {} }] } }, flags: [], counters: {}, source: 'legacy', warning: false },
  { name: 'missing', fields: {}, flags: [], counters: {}, source: null, warning: false },
  { name: 'malformed', fields: { flags: ['valid_flag', 'SECRET INVALID', 'valid_flag'], activitiesThisYear: { retained: 2, bad: 'SECRET INVALID' }, currentEvent: { description: 'SECRET INVALID', choices: [] } }, flags: ['valid_flag'], counters: { retained: 2 }, source: 'recovery', warning: true },
  { name: 'dead', fields: { isDead: true, currentEvent: offeredEvent, activitiesThisYear: { retained: 2 } }, flags: [], counters: {}, source: null, warning: true },
  { name: 'blank', fields: { character: null, currentEvent: offeredEvent, activitiesThisYear: { retained: 2 } }, flags: [], counters: {}, source: null, warning: true },
];

describe('continuity hydration and lifecycle ownership', () => {
  for (const mode of ['boot', 'switch']) {
    it.each(continuityFixtures)(`${mode} restores $name continuity without writes or inference`, async fixture => {
      const save = savedLife('Target life', { age: 30, ...fixture.fields });
      // Exercise genuinely absent fields in old documents, not builder defaults.
      if (fixture.name === 'missing' || fixture.name === 'legacy') {
        delete save.flags;
        delete save.activitiesThisYear;
        if (fixture.name === 'missing') delete save.currentEvent;
      }
      if (mode === 'boot') backend.getDoc.mockResolvedValueOnce(snapshot(save));
      else backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Origin life', {
        age: 30, flags: ['origin_flag'], activitiesThisYear: { origin: 3 }, currentEvent: offeredEvent,
      })));
      const { result } = await ready();
      if (mode === 'switch') {
        await waitFor(() => expect(result.current.character?.name).toBe('Origin life'));
        backend.getDoc.mockResolvedValueOnce(snapshot(save));
        backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('target', false) });
        await act(async () => { await result.current.signInWithEmail('target@example.com', 'fixture-password', 'signin'); });
      } else await waitFor(() => expect(backend.getDoc).toHaveBeenCalled());
      await waitFor(() => expect(result.current.flags).toEqual(fixture.flags));
      expect(result.current.activitiesThisYear).toEqual(fixture.counters);
      expect(result.current.currentEvent?.source ?? null).toBe(fixture.source);
      expect(result.current.lastContinuitySave).toBeNull();
      if (fixture.source) {
        if (fixture.source === 'annual') expect(result.current.currentEvent.id).toBe('annual-30');
        else expect(result.current.currentEvent.id).toEqual(expect.any(String));
        act(() => expect(result.current.chooseCareer('barista').result.code).toBe('action_locked'));
        if (fixture.source === 'recovery') {
          expect(result.current.currentEvent.description).toBe('This saved choice is unavailable. Clearing it applies no outcome and keeps your loaded life.');
          expect(result.current.currentEvent.choices).toEqual([{ text: 'Clear unavailable choice', effects: {} }]);
        }
      }
      const diagnostics = [...console.info.mock.calls, ...console.warn.mock.calls].map(([, record]) => record).filter(record => record?.event === 'save_load');
      expect(diagnostics.at(-1).status).toBe(fixture.warning ? 'loaded_with_warnings' : 'loaded');
      expect(JSON.stringify(diagnostics)).not.toContain('SECRET INVALID');
      expect(backend.setDoc).not.toHaveBeenCalled();
      expect(generateDynamicEvent).not.toHaveBeenCalled();
    });
  }

  it('retains normalized continuity in the next complete canonical snapshot', async () => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Snapshot life', {
      flags: ['opportunity_seen'], activitiesThisYear: { 'vacation__Staycation': 1 },
    })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Snapshot life'));
    act(() => result.current.performGig('Snapshot gig', 10));
    expect(backend.setDoc.mock.calls.at(-1)[1]).toMatchObject({
      flags: ['opportunity_seen'], activitiesThisYear: { 'vacation__Staycation': 1 }, currentEvent: null,
    });
  });

  it.each(['startLife', 'resetLife'])('%s clears restored continuity in state and replacement', async boundary => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Old life', {
      age: 30, flags: ['origin_flag'], activitiesThisYear: { origin: 3 }, currentEvent: offeredEvent,
    })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Old life'));
    act(() => result.current[boundary]('New life', 'Female', 'US'));
    expect(result.current.flags).toEqual([]);
    expect(result.current.activitiesThisYear).toEqual({});
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.lastContinuitySave).toBeNull();
    expect(backend.setDoc.mock.calls).toHaveLength(1);
    expect(backend.setDoc.mock.calls[0]).toHaveLength(2);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ flags: [], activitiesThisYear: {}, currentEvent: null });
  });

  it('keeps the origin life and transport when provider sign-out fails', async () => {
    backend.auth.currentUser = user('owner', false);
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Origin life', { flags: ['origin_flag'] })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Origin life'));
    const provider = deferred();
    backend.signOut.mockReturnValueOnce(provider.promise);
    let signingOut;
    await act(async () => { signingOut = result.current.signOutAccount(); });
    expect(result.current.character.name).toBe('Origin life');
    await act(async () => { provider.reject(new Error('private failure')); expect(await signingOut).toEqual({ ok: false, reason: 'error' }); });
    expect(result.current.flags).toEqual(['origin_flag']);
    expect(result.current.authAccount.uid).toBe('owner');
    act(() => result.current.performGig('Retained transport', 10));
    expect(backend.setDoc.mock.calls.at(-1)[0]).toBe('users/owner/saves/currentLife');
  });

  it.each([['activity', 'resolve'], ['activity', 'reject'], ['annual', 'resolve'], ['annual', 'reject']])('clears the life at provider sign-out and ignores an old %s %s while guest setup is pending', async (kind, completion) => {
    backend.auth.currentUser = user('owner', false);
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Origin life', { flags: ['origin_flag'], activitiesThisYear: { origin: 3 } })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Origin life'));
    const generation = deferred(), provider = deferred(), anonymous = deferred();
    generateDynamicEvent.mockReturnValueOnce(generation.promise);
    backend.signOut.mockImplementationOnce(async () => { await provider.promise; backend.auth.currentUser = null; });
    backend.signInAnonymously.mockReturnValueOnce(anonymous.promise);
    let request, signingOut;
    act(() => { request = kind === 'annual' ? result.current.ageUp() : result.current.triggerActivityEvent('Origin request'); });
    await act(async () => { signingOut = result.current.signOutAccount(); });
    expect(result.current.character.name).toBe('Origin life');
    await act(async () => provider.resolve());
    expect(result.current.character).toBeNull();
    expect(result.current.flags).toEqual([]);
    expect(result.current.activitiesThisYear).toEqual({});
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.lastContinuitySave).toBeNull();
    expect(result.current.lastCareerAction).toBeNull();
    expect(result.current.authAccount).toBeNull();
    expect(await getFirebaseIdToken()).toBeNull();
    expect(result.current.isAging).toBe(false);
    await act(async () => {
      if (completion === 'resolve') generation.resolve({ description: 'Obsolete choice', choices: [{ text: 'Continue', effects: {} }] });
      else generation.reject(new Error('private generation failure'));
      await request;
    });
    expect(result.current.currentEvent).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    await act(async () => { anonymous.reject(new Error('private anonymous failure')); expect(await signingOut).toEqual({ ok: false, reason: 'error' }); });
    expect(result.current.character).toBeNull();
    expect(result.current.authAccount).toBeNull();
    backend.signInAnonymously.mockResolvedValueOnce({ user: user('retry-guest') });
    await act(async () => expect(await result.current.signOutAccount()).toEqual({ ok: true, mode: 'signed_out' }));
    expect(result.current.authAccount.uid).toBe('retry-guest');
    expect(result.current.character).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'])('an obsolete annual %s cannot mutate or unlock a newer life request', async completion => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Origin life')));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Origin life'));
    const old = deferred(), current = deferred();
    generateDynamicEvent.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    let oldRequest, newRequest;
    act(() => { oldRequest = result.current.ageUp(); });
    act(() => result.current.startLife('New life', 'Female', 'US'));
    act(() => { newRequest = result.current.triggerActivityEvent('Current request'); });
    backend.setDoc.mockClear();
    await act(async () => {
      if (completion === 'resolve') old.resolve({ description: 'Obsolete choice', choices: [{ text: 'Continue', effects: {} }] });
      else old.reject(new Error('private generation failure'));
      await oldRequest;
    });
    expect(result.current.character.name).toBe('New life');
    expect(result.current.age).toBe(0);
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.isAging).toBe(true);
    expect(backend.setDoc).not.toHaveBeenCalled();
    await act(async () => { current.resolve({ description: 'Current choice', choices: [{ text: 'Continue', effects: {} }] }); await newRequest; });
    expect(result.current.currentEvent.description).toBe('Current choice');
    expect(result.current.isAging).toBe(false);
  });
});

// Real command boundaries: snapshots are durable only after the mocked transport acknowledges.
describe('activity continuity commits and receipts', () => {
  const friend = { id: 'friend', name: 'Alex', age: 30, status: 'friend', type: 'Friend', relation: 50, isAlive: true };
  async function loaded(fields = {}, options) {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Continuity Player', { relationships: [friend], ...fields })));
    const rendered = await ready(options);
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Continuity Player'));
    return rendered;
  }
  async function remount(save, unmount) {
    unmount();
    backend.getDoc.mockResolvedValue(snapshot(save));
    const rendered = await ready();
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Continuity Player'));
    return rendered;
  }

  it('consumes a counter once before a React flush, saves once, and retains it after acknowledged remount', async () => {
    const { result, unmount } = await loaded();
    act(() => {
      expect(result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(true);
      expect(result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false);
      expect(result.current.consumeYearlyActivity('health', 'Unlimited', 0)).toBe(true);
    });
    await waitFor(() => expect(result.current.lastContinuitySave?.saveStatus).toBe('saved'));
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const save = backend.setDoc.mock.calls[0][1];
    expect(save.activitiesThisYear).toEqual({ health__Run: 1 });
    const restored = await remount(save, unmount);
    act(() => expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false));
    await act(async () => { await restored.result.current.ageUp(); });
    expect(restored.result.current.activitiesThisYear).toEqual({});
    act(() => restored.result.current.handleChoice(restored.result.current.currentEvent.choices[0]));
    act(() => {
      expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(true);
      expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false);
    });
  });

  it.each([false, true])('the completed annual save resets counters explicitly, including death=%s', async death => {
    const { result, unmount } = await loaded({ activitiesThisYear: { health__Run: 1 }, ...(death ? { stats: { health: 1 } } : {}) });
    const acknowledgment = deferred();
    backend.setDoc.mockReturnValueOnce(acknowledgment.promise);
    await act(async () => { await result.current.ageUp(); });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const save = backend.setDoc.mock.calls[0][1];
    expect(save.activitiesThisYear).toEqual({});
    expect(save.isDead).toBe(death);
    await act(async () => acknowledgment.resolve());
    const restored = await remount(save, unmount);
    expect(restored.result.current.activitiesThisYear).toEqual({});
    if (!death) {
      act(() => restored.result.current.handleChoice(restored.result.current.currentEvent.choices[0]));
      act(() => {
        expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(true);
        expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false);
      });
    }
  });

  it('blocks standalone consumption throughout annual generation and its offered event', async () => {
    const { result } = await loaded();
    const generation = deferred();
    generateDynamicEvent.mockReturnValueOnce(generation.promise);
    let aging;
    act(() => {
      aging = result.current.ageUp();
      expect(result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false);
      expect(result.current.consumeYearlyActivity('health', 'Unlimited', 0)).toBe(false);
    });
    expect(backend.setDoc).not.toHaveBeenCalled();
    await act(async () => { generation.resolve({ description: 'Year', choices: [{ text: 'OK', effects: {} }] }); await aging; });
    const writes = backend.setDoc.mock.calls.length;
    act(() => expect(result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false));
    expect(backend.setDoc).toHaveBeenCalledTimes(writes);
  });

  it.each(['staycation', 'counter-only'])('saves a coherent %s base commit before deferred generation', async variant => {
    const { ACTIVITY_MENUS } = await import('../config/activities');
    const item = variant === 'staycation' ? ACTIVITY_MENUS.vacation.find(item => item.text === 'Staycation')
      : { text: 'Counter only', context: 'A quiet activity', yearlyLimit: 1 };
    const { result } = await loaded({ stats: { health: 50, happiness: 50 } });
    const generation = deferred();
    generateDynamicEvent.mockReturnValueOnce(generation.promise);
    act(() => {
      expect(result.current.performActivity(item, 'vacation')).toBe('ok');
      expect(result.current.performActivity(item, 'vacation')).toBe('blocked_busy');
    });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({
      stats: variant === 'staycation' ? { health: 54, happiness: 58 } : { health: 50, happiness: 50 },
      activitiesThisYear: { [`vacation__${item.text}`]: 1 },
    });
    await act(async () => generation.resolve({ description: 'Activity', choices: [{ text: 'OK', effects: {} }] }));
    act(() => result.current.handleChoice(result.current.currentEvent.choices[0]));
    act(() => expect(result.current.performActivity(item, 'vacation')).toBe('blocked_yearly'));
  });

  it.each([5, -5])('commits relationship delta %s and only positive interaction markers once in StrictMode', async delta => {
    const { result } = await loaded({}, { wrapper: StrictMode });
    act(() => result.current.modifyRelationship('friend', delta));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ relationships: [{ ...friend, relation: 50 + delta }], activitiesThisYear: delta > 0 ? { rel_interact__friend: 1 } : {} });
  });

  it.each(['counter-first', 'relationship-first'])('preserves both mixed same-tick commands and untouched fields after reload: %s', async order => {
    const first = deferred();
    const initial = { flags: ['kept'], pets: [{ id: 'pet', name: 'Pup' }], will: { allocations: [] }, history: [{ age: 20, text: 'Memory' }] };
    const { result, unmount } = await loaded(initial);
    backend.setDoc.mockReturnValueOnce(first.promise);
    act(() => {
      const consume = () => result.current.consumeYearlyActivity('health', 'Run', 1);
      const interact = () => result.current.modifyRelationship('friend', 5);
      if (order === 'counter-first') { consume(); interact(); } else { interact(); consume(); }
    });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(result.current.lastContinuitySave?.saveStatus).toBe('saved'));
    expect(backend.setDoc).toHaveBeenCalledTimes(2);
    const save = backend.setDoc.mock.calls[1][1];
    expect(save).toEqual(savedLife('Continuity Player', { ...initial, activitiesThisYear: { health__Run: 1, rel_interact__friend: 1 }, relationships: [{ ...friend, relation: 55 }] }));
    expect(Object.keys(save).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
    const restored = await remount(save, unmount);
    expect(restored.result.current.activitiesThisYear).toEqual(save.activitiesThisYear);
    expect(restored.result.current.relationships).toEqual(save.relationships);
  });

  it('saves gift and normalized dating markers/history together with latest money and relations in StrictMode', async () => {
    const first = deferred();
    const { result } = await loaded({}, { wrapper: StrictMode });
    backend.setDoc.mockReturnValueOnce(first.promise);
    act(() => {
      expect(result.current.giftRelationship('friend', 1000)).toBe('ok');
      result.current.addRelationship({ id: 'date', name: 'Taylor', age: 31, relation: 60 });
      expect(result.current.giftRelationship('date', 200)).toBe('ok');
    });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve());
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(3));
    const datingSave = backend.setDoc.mock.calls[1][1];
    expect(datingSave).toMatchObject({ bank: 11000, activitiesThisYear: { rel_interact__friend: 1, rel_interact__date: 1 } });
    expect(datingSave.relationships[1]).toMatchObject({ id: 'date', status: 'dating', isAlive: true });
    expect(datingSave.history.at(-1).text).toContain('now dating Taylor');
    const save = backend.setDoc.mock.calls[2][1];
    expect(save.bank).toBe(10800);
    expect(save.relationships.map(r => r.relation)).toEqual([70, 70]);
    expect(save.history).toHaveLength(3);
    expect(save.history.at(-1).text).toContain('gifted Taylor $200');
    expect(save.activitiesThisYear).toEqual({ rel_interact__friend: 1, rel_interact__date: 1 });
  });

  it.each([['resolve', 'resolve', 'saved'], ['resolve', 'reject', 'failed'], ['reject', 'resolve', 'saved'], ['reject', 'reject', 'failed']])('keeps B pending when older A receipts %s, then B receipts %s', async (completion, latestCompletion, status) => {
    const { result } = await loaded();
    const first = deferred(), second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => {
      result.current.consumeYearlyActivity('health', 'Run', 1);
      result.current.modifyRelationship('friend', 5);
    });
    const pending = result.current.lastContinuitySave;
    expect(pending).toMatchObject({ kind: 'activity', saveStatus: 'pending', operationId: null });
    await act(async () => first[completion](completion === 'reject' ? new Error('private') : undefined));
    expect(backend.setDoc).toHaveBeenCalledTimes(2);
    expect(result.current.lastContinuitySave).toBe(pending);
    await act(async () => second[latestCompletion](latestCompletion === 'reject' ? new Error('private') : undefined));
    expect(result.current.lastContinuitySave).toMatchObject({ id: pending.id, kind: 'activity', saveStatus: status, operationId: expect.any(String) });
  });

  it.each(['startLife', 'resetLife', 'hydration', 'switch', 'signout', 'unmount'])('invalidates a deferred activity receipt across %s', async boundary => {
    const boot = deferred();
    if (boundary === 'signout') backend.auth.currentUser = user('signed-in', false);
    let rendered;
    if (boundary === 'hydration') {
      backend.getDoc.mockReturnValueOnce(boot.promise);
      rendered = await ready();
    } else rendered = await loaded();
    const { result, unmount } = rendered;
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    act(() => result.current.consumeYearlyActivity('health', 'Run', 1));
    const before = result.current.lastContinuitySave;
    expect(before?.saveStatus).toBe('pending');
    if (boundary === 'startLife' || boundary === 'resetLife') act(() => result.current[boundary]('New', 'Female', 'US'));
    if (boundary === 'hydration') await act(async () => boot.resolve(snapshot(savedLife())));
    if (boundary === 'switch') {
      backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Other')));
      backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('other', false) });
      await act(async () => { await result.current.signInWithEmail('other@example.com', 'fixture-password', 'signin'); });
    }
    if (boundary === 'signout') await act(async () => { await result.current.signOutAccount(); });
    if (boundary === 'unmount') unmount();
    else expect(result.current.lastContinuitySave).toBeNull();
    await act(async () => pending.resolve());
    expect(result.current.lastContinuitySave).toBe(boundary === 'unmount' ? before : null);
  });
});
