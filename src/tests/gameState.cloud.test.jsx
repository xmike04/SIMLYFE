import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameState } from '../engine/gameState';
import { buildLifeSave, LIFE_SAVE_KEYS, INITIAL_EDUCATION } from '../engine/lifeSave';
import { generateDynamicEvent } from '../engine/llmService';
import { getFirebaseIdToken } from '../engine/firebaseToken';
import { applyFirestoreSave } from '../../tests/e2e/support/firestoreWrites.js';
import { advanceLifeYear } from '../engine/annual/advanceLifeYear';
import MainGame from '../components/MainGame';
import { ACTIVITY_MENUS } from '../config/activities';
import { WEALTH_TIERS } from '../config/wealthTiers';
import { ASSET_CATALOG } from '../config/assetCatalog';

const backend = vi.hoisted(() => ({
  configured: true, auth: { currentUser: null }, db: {},
  getDoc: vi.fn(), setDoc: vi.fn(), getDocs: vi.fn(), unsubscribe: vi.fn(),
  signInAnonymously: vi.fn(), linkWithPopup: vi.fn(), signInWithCredential: vi.fn(),
  signInWithPopup: vi.fn(), linkWithCredential: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(), signOut: vi.fn(), sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../config/firebase', () => ({
  get auth() { return backend.configured ? backend.auth : null; },
  get db() { return backend.configured ? backend.db : null; },
}));
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
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  backend.configured = true;
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  backend.auth.currentUser = user('guest');
  backend.getDoc.mockReset().mockResolvedValue(snapshot(null));
  backend.getDocs.mockResolvedValue({ empty: true });
  backend.setDoc.mockReset().mockResolvedValue(undefined);
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
    expect(options).toEqual({ mergeFields: Object.keys(save) });
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

  it('reset then newborn creation replaces a saved pending life and all prior continuity/history', async () => {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Prior life', {
      age: 30, flags: ['prior_flag'], activitiesThisYear: { vacation__Staycation: 1 },
      currentEvent: offeredEvent, history: [{ age: 20, text: 'Prior memory' }],
    })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.currentEvent?.id).toBe(offeredEvent.id));
    act(() => result.current.resetLife());
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0]).toHaveLength(2);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ character: null, flags: [], activitiesThisYear: {}, currentEvent: null, history: [] });
    act(() => result.current.startLife('Newborn', 'Female', 'US'));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    expect(backend.setDoc.mock.calls[1]).toHaveLength(2);
    const newborn = backend.setDoc.mock.calls[1][1];
    expect(newborn).toMatchObject({ character: { name: 'Newborn' }, age: 0, flags: [], activitiesThisYear: {}, currentEvent: null });
    expect(newborn.history).toHaveLength(1);
    expect(newborn.history[0].text).not.toContain('Prior memory');
    expect(result.current.history).toEqual(newborn.history);
    expect(generateDynamicEvent).not.toHaveBeenCalled();
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
    act(() => restored.result.current.handleChoice(restored.result.current.currentEvent.id, 0));
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
      act(() => restored.result.current.handleChoice(restored.result.current.currentEvent.id, 0));
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
    act(() => result.current.handleChoice(result.current.currentEvent.id, 0));
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

  it.each(['saved', 'pending'])('a newer untracked gig clears %s continuity feedback and old receipts cannot restore it', async status => {
    const { result } = await loaded({ flags: ['retained_flag'] });
    const first = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise);
    act(() => result.current.consumeYearlyActivity('health', 'Run', 1));
    if (status === 'saved') await act(async () => first.resolve());
    expect(result.current.lastContinuitySave.saveStatus).toBe(status);
    act(() => result.current.performGig('Newer gig', 500));
    expect(result.current.lastContinuitySave).toBeNull();
    if (status === 'pending') await act(async () => first.resolve());
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    expect(result.current.lastContinuitySave).toBeNull();
    expect(backend.setDoc.mock.calls[1][1]).toMatchObject({ bank: 12500, flags: ['retained_flag'], activitiesThisYear: { health__Run: 1 } });
  });

  it('an updater-based property writer clears a visible notice without render warnings or duplicate writes', async () => {
    const { result } = await loaded({ properties: [{ id: 'home', currentValue: 50000 }] }, { wrapper: StrictMode });
    act(() => result.current.consumeYearlyActivity('health', 'Run', 1));
    await waitFor(() => expect(result.current.lastContinuitySave?.saveStatus).toBe('saved'));
    act(() => result.current.modifyProperty('home', 1000));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    expect(result.current.lastContinuitySave).toBeNull();
    expect(result.current.properties[0].currentValue).toBe(51000);
    expect(backend.setDoc.mock.calls[1][1]).toMatchObject({ properties: [{ id: 'home', currentValue: 51000 }], activitiesThisYear: { health__Run: 1 } });
    expect(console.error).not.toHaveBeenCalled();
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


describe('generated offers are acknowledged with their originating life', () => {
  beforeEach(() => {
    generateDynamicEvent.mockReset().mockResolvedValue({ description: 'Fixture year', choices: [{ text: 'Continue', effects: {} }] });
    backend.setDoc.mockReset().mockResolvedValue(undefined);
  });
  const offer = { description: 'A meaningful opportunity', choices: [{ text: 'Accept', effects: { happiness: 3 } }], meta: { requestId: 'provider-request', model: 'fixture-model', latencyMs: 12, usage: { inputTokens: 20, outputTokens: 9, cachedInputTokens: 2, totalTokens: 29 } } };
  const friend = { id: 'friend', type: 'Friend', name: 'Alex', age: 30, status: 'friend', relation: 60, isAlive: true };
  async function loaded(fields = {}) {
    backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Offer Player', { age: 30, ...fields })));
    const rendered = await ready();
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Offer Player'));
    return rendered;
  }

  it('saves the complete calculated latest year and offered event together without an inference checkpoint or extra RNG', async () => {
    const initial = savedLife('Offer Player', {
      age: 30, flags: ['kept'], history: [{ age: 30, text: 'Prior memory' }],
      stats: { health: 80, happiness: 80, smarts: 70, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 },
      career: { id: 'fixture', title: 'Fixture', salary: 30000 },
      education: { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: 'bachelor', yearsInProgram: 1 },
      relationships: [friend], pets: [{ id: 'pet', speciesId: 'dog', name: 'Pup', age: 1, isAlive: true }],
      belongings: [{ id: 'fund', type: 'investment', subType: 'fund', currentValue: 1000, yearsOwned: 0, returnProfile: { base: .1, volatility: 0 } }],
      properties: [{ id: 'house', type: 'realEstate', currentValue: 10000, yearsOwned: 0, upkeep: 100 }],
      will: { allocations: [] }, activitiesThisYear: { health__Run: 1 },
    });
    const { result, unmount } = await loaded(initial);
    const generation = deferred(), acknowledgment = deferred();
    generateDynamicEvent.mockReturnValueOnce(generation.promise);
    // No render between the interaction marker commit and Age: annual reads the eager snapshot.
    const expectedInput = { ...initial, activitiesThisYear: { health__Run: 1, rel_interact__friend: 1 }, relationships: [{ ...friend, relation: 65 }] };
    const expectedRandom = vi.fn(() => .999);
    const expectedYear = advanceLifeYear(expectedInput, { randomFn: expectedRandom });
    const random = vi.spyOn(Math, 'random').mockReturnValue(.999);
    let aging;
    act(() => {
      result.current.modifyRelationship('friend', 5);
      aging = result.current.ageUp();
      result.current.ageUp();
      result.current.triggerActivityEvent('Must remain locked');
    });
    // The interaction write is the only write before generation completes.
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
    expect(generateDynamicEvent.mock.calls[0][0]).toMatchObject({
      age: 31, relationships: expectedInput.relationships, pets: initial.pets, history: initial.history,
    });
    expect(result.current.age).toBe(31);
    expect(result.current.relationships).toEqual(expectedYear.state.relationships);
    expect(result.current.lastContinuitySave.kind).toBe('activity');
    await waitFor(() => expect(result.current.lastContinuitySave.saveStatus).toBe('saved'));
    backend.setDoc.mockClear();
    backend.setDoc.mockReturnValueOnce(acknowledgment.promise);
    await act(async () => { generation.resolve(offer); await aging; });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const event = result.current.currentEvent;
    expect(event).toEqual({ ...offer, version: 1, id: expect.any(String), age: 31, source: 'annual' });
    expect(event.id).not.toBe(offer.meta.requestId);
    const save = backend.setDoc.mock.calls[0][1];
    expect(save).toEqual(buildLifeSave({ ...expectedInput, ...expectedYear.state, history: [...initial.history, ...expectedYear.history], activitiesThisYear: {}, currentEvent: event }));
    expect(random).toHaveBeenCalledTimes(expectedRandom.mock.calls.length + 1); // Existing death-check roll is unconditional.
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'year', saveStatus: 'pending', operationId: null });
    await act(async () => acknowledgment.resolve());
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'year', saveStatus: 'saved', operationId: expect.any(String) });
    unmount();
    backend.getDoc.mockResolvedValueOnce(snapshot(save));
    const restored = await ready();
    await waitFor(() => expect(restored.result.current.currentEvent).toEqual(event));
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it('emits exactly the existing death save with no event, empty counters, and no inference', async () => {
    const { result } = await loaded({ stats: { health: 1 }, activitiesThisYear: { old: 2 }, history: [{ age: 30, text: 'Prior memory' }] });
    vi.spyOn(Math, 'random').mockReturnValue(.999);
    await act(async () => { await result.current.ageUp(); });
    expect(generateDynamicEvent).not.toHaveBeenCalled();
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ age: 31, isDead: true, currentEvent: null, activitiesThisYear: {}, history: [{ age: 30, text: 'Prior memory' }, { age: 31, text: 'You passed away peacefully at age 31.' }] });
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'year', saveStatus: 'saved' });
  });

  it.each(['base-effects', 'zero-cost'])('saves an activity offer once after the latest %s snapshot and eagerly locks commands', async variant => {
    const { result } = await loaded();
    const generation = deferred(), acknowledgment = deferred();
    generateDynamicEvent.mockReturnValueOnce(generation.promise);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Offer identity used gameplay RNG'); });
    let request;
    act(() => {
      if (variant === 'base-effects') result.current.performActivity({ text: 'Quiet day', context: 'Quiet day', cost: 50, baseEffects: { happiness: 4 }, yearlyLimit: 1 }, 'test');
      else request = result.current.triggerActivityEvent('Free activity');
      result.current.triggerActivityEvent('Duplicate');
      result.current.ageUp();
    });
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
    const before = generateDynamicEvent.mock.calls[0][0];
    expect(before.bank).toBe(variant === 'base-effects' ? 11950 : 12000);
    if (variant === 'base-effects') expect(before.stats.happiness).toBe(84);
    await act(async () => {});
    backend.setDoc.mockClear();
    backend.setDoc.mockReturnValueOnce(acknowledgment.promise);
    await act(async () => {
      generation.resolve(offer);
      if (request) await request;
      // Continuation installed the event synchronously before a React render.
      await generation.promise;
      expect(result.current.consumeYearlyActivity('test', 'blocked', 1)).toBe(false);
    });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const event = result.current.currentEvent;
    expect(event).toEqual({ ...offer, version: 1, id: expect.any(String), age: 30, source: 'activity' });
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: before.bank, stats: before.stats, currentEvent: event, activitiesThisYear: variant === 'base-effects' ? { 'test__Quiet day': 1 } : {} });
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'event_offered', saveStatus: 'pending' });
    await act(async () => acknowledgment.resolve());
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'event_offered', saveStatus: 'saved' });
    expect(random).not.toHaveBeenCalled();
  });

  it.each(['annual', 'activity'])('saves a resolved real-client sanitized error as a no-effect %s offer', async kind => {
    const { generateDynamicEvent: realGenerate } = await vi.importActual('../engine/llmService');
    const errorOffer = await realGenerate({}); // Missing configuration returns the real sanitized error; no transport request.
    expect(errorOffer.description).toContain('LLM ERROR:');
    generateDynamicEvent.mockResolvedValueOnce(errorOffer);
    const { result } = await loaded();
    await act(async () => { await (kind === 'annual' ? result.current.ageUp() : result.current.triggerActivityEvent('Activity')); });
    expect(result.current.currentEvent).toMatchObject({ version: 1, source: kind, description: errorOffer.description, choices: [{ text: 'Understood', effects: {} }] });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1].currentEvent).toEqual(result.current.currentEvent);
    expect(result.current.lastContinuitySave.saveStatus).toBe('saved');
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
  });

  it.each(['annual', 'activity'])('retains an offered %s event in the session when its save fails', async kind => {
    const { result } = await loaded();
    const acknowledgment = deferred();
    backend.setDoc.mockReturnValueOnce(acknowledgment.promise);
    generateDynamicEvent.mockResolvedValueOnce(offer);
    await act(async () => { await (kind === 'annual' ? result.current.ageUp() : result.current.triggerActivityEvent('Free activity')); });
    const event = result.current.currentEvent;
    expect(result.current.lastContinuitySave).toMatchObject({ kind: kind === 'annual' ? 'year' : 'event_offered', saveStatus: 'pending', operationId: null });
    await act(async () => acknowledgment.reject(new Error('private write failure')));
    expect(result.current.lastContinuitySave).toMatchObject({ saveStatus: 'failed', operationId: expect.any(String) });
    expect(result.current.currentEvent).toBe(event);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
    act(() => expect(result.current.consumeYearlyActivity('test', 'blocked', 1)).toBe(false));
  });

  it('assigns fresh instance IDs even when the provider repeats its request metadata', async () => {
    const { result } = await loaded();
    generateDynamicEvent.mockResolvedValue(offer);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Offer identity used gameplay RNG'); });
    await act(async () => { await result.current.triggerActivityEvent('First'); });
    const firstId = result.current.currentEvent.id;
    act(() => result.current.handleChoice(result.current.currentEvent.id, 0));
    await act(async () => { await result.current.triggerActivityEvent('Second'); });
    expect(result.current.currentEvent.id).not.toBe(firstId);
    expect(result.current.currentEvent.meta).toEqual(offer.meta);
    expect(random).not.toHaveBeenCalled();
  });

  const cases = ['annual', 'activity'].flatMap(kind => ['resolve', 'reject'].flatMap(completion => ['resetLife', 'startLife', 'switch', 'signout', 'hydration', 'unmount'].map(boundary => ({ kind, completion, boundary }))));
  it.each(cases)('ignores obsolete $kind $completion across $boundary while a newer request owns the lock', async ({ kind, completion, boundary }) => {
    const boot = deferred();
    if (boundary === 'signout') backend.auth.currentUser = user('guest', false);
    let rendered;
    if (boundary === 'hydration') {
      backend.getDoc.mockReturnValueOnce(boot.promise);
      rendered = await ready();
    } else rendered = await loaded({ history: [{ age: 30, text: 'Origin history' }] });
    const old = deferred(), current = deferred();
    generateDynamicEvent.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const begin = () => kind === 'annual' ? rendered.result.current.ageUp() : rendered.result.current.triggerActivityEvent('Request');
    let oldRequest, newRequest;
    act(() => { oldRequest = begin(); });
    if (boundary === 'startLife' || boundary === 'resetLife') act(() => rendered.result.current[boundary]('Replacement', 'Female', 'US'));
    if (boundary === 'hydration') await act(async () => boot.resolve(snapshot(savedLife('Replacement'))));
    if (boundary === 'switch') {
      backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Replacement')));
      backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('other', false) });
      await act(async () => { await rendered.result.current.signInWithEmail('other@example.com', 'fixture-password', 'signin'); });
    }
    if (boundary === 'signout') await act(async () => { await rendered.result.current.signOutAccount(); });
    if (boundary === 'unmount') {
      rendered.unmount();
      backend.getDoc.mockResolvedValueOnce(snapshot(savedLife('Replacement')));
      rendered = await ready();
      await waitFor(() => expect(rendered.result.current.character?.name).toBe('Replacement'));
    }
    await act(async () => {}); // Flush any authorized replacement write before observing obsolete continuations.
    act(() => { newRequest = begin(); });
    const before = { character: rendered.result.current.character, age: rendered.result.current.age, history: rendered.result.current.history, bank: rendered.result.current.bank, education: rendered.result.current.education };
    backend.setDoc.mockClear();
    console.error.mockClear();
    await act(async () => {
      if (completion === 'resolve') old.resolve({ description: 'Obsolete choice', choices: [{ text: 'Old', effects: {} }] });
      else old.reject(new Error('private obsolete failure'));
      await oldRequest;
    });
    expect(rendered.result.current).toMatchObject(before);
    expect(rendered.result.current.currentEvent).toBeNull();
    expect(rendered.result.current.isAging).toBe(true);
    expect(rendered.result.current.lastContinuitySave).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    act(() => {
      expect(rendered.result.current.chooseCareer('barista').result.code).toBe('action_locked');
      expect(rendered.result.current.consumeYearlyActivity('test', 'blocked', 1)).toBe(false);
      rendered.result.current.enrollInDegree('bachelor');
    });
    expect(rendered.result.current.education).toEqual(before.education);
    expect(backend.setDoc).not.toHaveBeenCalled();
    await act(async () => { current.resolve(offer); await newRequest; });
    expect(rendered.result.current.currentEvent).toMatchObject({ version: 1, source: kind, description: offer.description });
    expect(rendered.result.current.isAging).toBe(false);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][0]).toBe(`users/${boundary === 'switch' ? 'other' : boundary === 'signout' ? 'fresh-guest' : 'guest'}/saves/currentLife`);
    expect(backend.setDoc.mock.calls[0][1].currentEvent).toEqual(rendered.result.current.currentEvent);
    expect(backend.setDoc.mock.calls[0][1].history.some(entry => entry.text === 'Origin history')).toBe(false);
  });
});


// Real command boundaries: never trust caller effects, and clear a pending identity eagerly.
describe('canonical pending choice resolution', () => {
  const opportunity = {
    version: 1, id: 'annual-30', age: 30, source: 'annual', description: 'A saved opportunity',
    choices: [{ text: 'Consider the opportunity', effects: { bank: 20000 } }],
  };
  async function loaded(fields = {}, options) {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Choice Player', { age: 30, bank: 250, currentEvent: opportunity, ...fields })));
    const rendered = await ready(options);
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Choice Player'));
    return rendered;
  }
  async function remount(save, unmount) {
    unmount();
    return loaded(save);
  }

  it('commits a restored choice once in the same tick and remounts its acknowledged cleared snapshot', async () => {
    const { result, unmount } = await loaded();
    let first, duplicate;
    act(() => {
      first = result.current.handleChoice('annual-30', 0);
      duplicate = result.current.handleChoice('annual-30', 0);
    });
    expect(first).toMatchObject({ status: 'committed', code: 'event_resolved' });
    expect(duplicate).toEqual({ status: 'noop', code: 'no_pending_event', persistence: null });
    expect(result.current.bank).toBe(20250);
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.history.filter(x => x.text.includes('Consider the opportunity'))).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: 20250, currentEvent: null });
    await act(async () => expect(await first.persistence).toMatchObject({ status: 'saved' }));
    const restored = await remount(backend.setDoc.mock.calls[0][1], unmount);
    expect(restored.result.current.currentEvent).toBeNull();
    act(() => expect(restored.result.current.handleChoice('annual-30', 0)).toEqual(duplicate));
    expect(restored.result.current.bank).toBe(20250);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it.each([-1, 0.5, 1, NaN, '0', undefined, null, { text: 'Forged', effects: { bank: 100000 } }])('rejects invalid choice index %# without any outcome, randomness, or write', async index => {
    const { result } = await loaded();
    const before = { bank: result.current.bank, stats: result.current.stats, history: result.current.history, event: result.current.currentEvent };
    const random = vi.spyOn(Math, 'random');
    act(() => expect(result.current.handleChoice('annual-30', index)).toEqual({ status: 'rejected', code: 'invalid_choice', persistence: null }));
    expect(result.current.bank).toBe(before.bank);
    expect(result.current.stats).toEqual(before.stats);
    expect(result.current.history).toEqual(before.history);
    expect(result.current.currentEvent).toEqual(before.event);
    expect(random).not.toHaveBeenCalled();
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it.each(['old-event', { text: 'Forged', effects: { bank: 100000 } }])('rejects wrong IDs and the former object API %#', async id => {
    const { result } = await loaded();
    const random = vi.spyOn(Math, 'random');
    act(() => expect(result.current.handleChoice(id, 0)).toEqual({ status: 'rejected', code: 'stale_event', persistence: null }));
    expect(result.current.bank).toBe(250);
    expect(result.current.history).toEqual([]);
    expect(random).not.toHaveBeenCalled();
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('rejects an old callback after a different offer with identical choice text', async () => {
    const { result } = await loaded();
    const oldHandleChoice = result.current.handleChoice;
    const oldCallback = () => oldHandleChoice('annual-30', 0);
    await act(async () => { await oldCallback().persistence; });
    generateDynamicEvent.mockResolvedValueOnce({ description: 'Another opportunity', choices: opportunity.choices });
    await act(async () => { await result.current.triggerActivityEvent('A fresh opportunity'); });
    const newEvent = result.current.currentEvent;
    const count = backend.setDoc.mock.calls.length;
    const random = vi.spyOn(Math, 'random');
    act(() => expect(oldCallback()).toEqual({ status: 'rejected', code: 'stale_event', persistence: null }));
    expect(result.current.currentEvent).toEqual(newEvent);
    expect(result.current.bank).toBe(20250);
    expect(result.current.history).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(count);
    expect(random).not.toHaveBeenCalled();
  });

  it('retains the local outcome on failed save while reload honestly restores the older pending snapshot', async () => {
    const acknowledged = savedLife('Choice Player', { age: 30, bank: 250, currentEvent: opportunity });
    const { result, unmount } = await loaded();
    backend.setDoc.mockRejectedValueOnce({ code: 'unavailable' });
    let resolution;
    act(() => { resolution = result.current.handleChoice('annual-30', 0); });
    await act(async () => expect(await resolution.persistence).toMatchObject({ status: 'failed' }));
    expect(result.current.bank).toBe(20250);
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.lastContinuitySave).toMatchObject({ kind: 'event_resolved', saveStatus: 'failed' });
    const restored = await remount(acknowledged, unmount);
    expect(restored.result.current.bank).toBe(250);
    expect(restored.result.current.currentEvent).toEqual(opportunity);
    expect(restored.result.current.history).toEqual([]);
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it('keeps unavailable saved choices locked until explicit no-effect clearing', async () => {
    const { result } = await loaded({ currentEvent: { description: 'Damaged', choices: [] }, stats: { health: 0, happiness: 80 }, flags: ['retained'] });
    const recovery = result.current.currentEvent;
    const before = { stats: result.current.stats, relationships: result.current.relationships };
    await act(async () => {
      await result.current.ageUp();
      await result.current.triggerActivityEvent('Do not generate');
      expect(result.current.performActivity({ text: 'Quiet', effects: { bank: 100 } }, 'other')).toBe('blocked_busy');
    });
    expect(recovery.source).toBe('recovery');
    expect(generateDynamicEvent).not.toHaveBeenCalled();
    expect(backend.setDoc).not.toHaveBeenCalled();
    const random = vi.spyOn(Math, 'random');
    let resolution;
    act(() => { resolution = result.current.handleChoice(recovery.id, 0); });
    expect(resolution).toMatchObject({ status: 'committed', code: 'event_cleared' });
    expect(result.current.bank).toBe(250);
    expect(result.current.stats).toEqual(before.stats);
    expect(result.current.relationships).toEqual(before.relationships);
    expect(result.current.flags).toEqual(['retained']);
    expect(result.current.isDead).toBe(false);
    expect(result.current.history).toEqual([{ age: 30, text: 'Recovery: Cleared an unavailable saved choice without applying an outcome.' }]);
    expect(result.current.currentEvent).toBeNull();
    expect(random).not.toHaveBeenCalled();
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: 250, currentEvent: null, history: result.current.history });
    await act(async () => { await resolution.persistence; });
  });

  it('does not turn a missing event into recovery or request a save', async () => {
    const { result } = await loaded({ currentEvent: null });
    act(() => expect(result.current.handleChoice('annual-30', 0)).toEqual({ status: 'noop', code: 'no_pending_event', persistence: null }));
    expect(result.current.currentEvent).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  const spouse = { id: 'spouse', name: 'Alex', age: 30, type: 'Spouse', status: 'married', isAlive: true, relation: 80 };
  const children = [
    { id: 'child-1', name: 'Ava', age: 10, type: 'Child', status: 'family', isAlive: true, relation: 80, custodyWith: 'player' },
    { id: 'child-2', name: 'Liam', age: 18, type: 'Child', status: 'family', isAlive: true, relation: 80 },
  ];
  async function divorce(options, relationships = [spouse, ...children]) {
    const rendered = await loaded({ bank: 50000, currentEvent: null, stats: { health: 80, happiness: 80 }, relationships }, options);
    act(() => expect(rendered.result.current.breakUp('spouse')).toBe('ok'));
    return rendered;
  }

  it('produces one coherent versioned custody save from real divorce, even under StrictMode', async () => {
    const { result } = await divorce({ wrapper: StrictMode });
    await waitFor(() => expect(result.current.lastContinuitySave?.saveStatus).toBe('saved'));
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const payload = backend.setDoc.mock.calls[0][1];
    expect(payload).toMatchObject({ bank: 42500, stats: { happiness: 65 }, currentEvent: { version: 1, age: 30, source: 'custody', isCustodyBattle: true, exId: 'spouse', childIds: ['child-1', 'child-2'] } });
    expect(payload.currentEvent.id).not.toBe('custody_battle');
    expect(payload.currentEvent.choices).toEqual([
      { text: 'Fight for full custody (hire lawyer, -$10,000)', effects: { bank: -10000 }, custodyOutcome: 'fight' },
      { text: 'Negotiate joint custody (-$3,000, $2,400/yr child support)', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
      { text: 'Let them have the kids', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
    ]);
    expect(payload.relationships).toEqual([{ ...spouse, type: 'Ex', status: 'ex' }, ...children]);
    expect(payload.history).toEqual([{ age: 30, text: 'Relationships: You divorced Alex. It cost $7,500 and left you heartbroken.' }]);
    expect(result.current.currentEvent).toEqual(payload.currentEvent);
    expect(result.current.bank).toBe(42500);
    expect(result.current.stats.happiness).toBe(65);
    expect(result.current.lastContinuitySave.kind).toBe('event_offered');
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it('blocks invalid custody preparation without committing any divorce field', async () => {
    const { result } = await loaded({ bank: 50000, currentEvent: null, stats: { happiness: 80 }, relationships: [spouse, ...children, { ...children[0] }] });
    act(() => expect(result.current.breakUp('spouse')).toBe('blocked'));
    expect(result.current.bank).toBe(50000);
    expect(result.current.stats.happiness).toBe(80);
    expect(result.current.relationships[0]).toEqual(spouse);
    expect(result.current.history).toEqual([]);
    expect(result.current.currentEvent).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it.each([
    { index: 0, randomValue: 0.79, bank: 32500, happiness: 65, legal: 'Legal: You won full custody of your children. The judge ruled in your favor.', exCustody: false, support: false, draws: 1 },
    { index: 0, randomValue: 0.80, bank: 32500, happiness: 65, legal: 'Legal: You lost the custody battle. The judge awarded full custody to your ex.', exCustody: true, support: false, draws: 1 },
    { index: 1, randomValue: 0.50, bank: 39500, happiness: 65, legal: 'Legal: Joint custody agreed. You pay $2,400/yr in child support.', exCustody: false, support: true, draws: 0 },
    { index: 2, randomValue: 0.50, bank: 42500, happiness: 45, legal: 'Legal: You signed away custody. You may see them on holidays.', exCustody: true, support: false, draws: 0 },
  ])('resolves restored custody index $index at RNG $randomValue exactly once', async fixture => {
    const produced = await divorce();
    await waitFor(() => expect(produced.result.current.lastContinuitySave?.saveStatus).toBe('saved'));
    const payload = backend.setDoc.mock.calls[0][1];
    const restored = await remount(payload, produced.unmount);
    const { result } = restored;
    backend.setDoc.mockClear();
    const random = vi.spyOn(Math, 'random').mockReturnValue(fixture.randomValue);
    let resolution;
    act(() => {
      resolution = result.current.handleChoice(payload.currentEvent.id, fixture.index);
      expect(result.current.handleChoice(payload.currentEvent.id, fixture.index)).toEqual({ status: 'noop', code: 'no_pending_event', persistence: null });
    });
    expect(resolution).toMatchObject({ status: 'committed', code: 'event_resolved' });
    expect(result.current.bank).toBe(fixture.bank);
    expect(result.current.stats.happiness).toBe(fixture.happiness);
    const expectedChildren = fixture.exCustody ? children.map(child => ({ ...child, custodyWith: 'ex' })) : children;
    expect(result.current.relationships).toEqual([{ ...spouse, type: 'Ex', status: 'ex', ...(fixture.support ? { childSupport: 2400 } : {}) }, ...expectedChildren]);
    expect(result.current.history).toHaveLength(3);
    expect(result.current.history[1]).toEqual({ age: 30, text: fixture.legal });
    expect(result.current.history[2].text).toBe(`Event: ${payload.currentEvent.description} -> You chose: ${payload.currentEvent.choices[fixture.index].text}`);
    expect(result.current.currentEvent).toBeNull();
    expect(random).toHaveBeenCalledTimes(fixture.draws);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: fixture.bank, currentEvent: null, relationships: result.current.relationships, history: result.current.history, stats: result.current.stats });
    await act(async () => { await resolution.persistence; });
  });
});


describe('acknowledged canonical maps after rejected clears', () => {
  function storage(initial) {
    let acknowledged = structuredClone(initial);
    const pending = [];
    backend.getDoc.mockImplementation(async () => snapshot(structuredClone(acknowledged)));
    backend.setDoc.mockImplementation((_path, payload, options) => {
      const receipt = deferred();
      pending.push({ payload, options, ...receipt });
      return receipt.promise;
    });
    return {
      read: () => structuredClone(acknowledged),
      async settle(success) {
        await waitFor(() => expect(pending).toHaveLength(1));
        const write = pending.shift();
        await act(async () => {
          if (success) { acknowledged = applyFirestoreSave(acknowledged, write.payload, write.options); write.resolve(); }
          else write.reject(new Error('expected rejected canonical-map clear'));
        });
      },
    };
  }
  const initial = fields => ({ ...savedLife('Map Player', { age: 30, ...fields }), schemaVersion: 1, narrativeMode: true });
  async function restore() {
    const rendered = await ready();
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Map Player'));
    return rendered;
  }

  it('a later acknowledged counter map removes old-year keys after failed annual and event clears', async () => {
    const cloud = storage(initial({ activitiesThisYear: { health__Run: 1, vacation__Staycation: 1 } }));
    const { result, unmount } = await restore();
    await act(async () => { await result.current.ageUp(); });
    expect(result.current.activitiesThisYear).toEqual({});
    await cloud.settle(false); // annual reset failed; backend retains both old counters
    act(() => result.current.handleChoice(result.current.currentEvent.id, 0));
    await cloud.settle(false); // unlock the offer without an intervening successful empty reset
    expect(cloud.read().activitiesThisYear).toEqual({ health__Run: 1, vacation__Staycation: 1 });
    act(() => expect(result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(true));
    await cloud.settle(true);
    expect(backend.setDoc).toHaveBeenCalledTimes(3);
    expect(cloud.read()).toMatchObject({ age: 31, activitiesThisYear: { health__Run: 1 }, schemaVersion: 1, narrativeMode: true });
    expect(cloud.read().activitiesThisYear).toEqual({ health__Run: 1 });
    unmount();
    const restored = await restore();
    expect(restored.result.current.activitiesThisYear).toEqual({ health__Run: 1 });
    act(() => expect(restored.result.current.consumeYearlyActivity('health', 'Run', 1)).toBe(false));
    act(() => expect(restored.result.current.consumeYearlyActivity('vacation', 'Staycation', 1)).toBe(true));
    await cloud.settle(true);
  });

  it.each(['custody', 'ordinary-meta'])('a later ordinary offer replaces %s fields after a failed event clear', async previous => {
    const custody = {
      version: 1, id: 'old-custody', age: 30, source: 'custody', description: 'A saved custody hearing',
      isCustodyBattle: true, exId: 'ex', childIds: ['child'],
      choices: [
        { text: 'Fight', effects: { bank: -10000 }, custodyOutcome: 'fight' },
        { text: 'Negotiate', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
        { text: 'Surrender', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
      ],
      meta: { requestId: 'old-request', model: 'old-model', latencyMs: 1, usage: { inputTokens: 4 } },
    };
    const oldEvent = previous === 'custody' ? custody : { ...offeredEvent, meta: custody.meta };
    const cloud = storage(initial({ currentEvent: oldEvent, relationships: [
      { id: 'ex', name: 'Alex', age: 30, type: 'Ex', status: 'ex', isAlive: true, relation: 50 },
      { id: 'child', name: 'Sam', age: 7, type: 'Child', status: 'family', isAlive: true, relation: 70 },
    ] }));
    const { result, unmount } = await restore();
    act(() => result.current.handleChoice(oldEvent.id, previous === 'custody' ? 1 : 0));
    await cloud.settle(false);
    expect(cloud.read().currentEvent).toEqual(oldEvent);
    generateDynamicEvent.mockResolvedValueOnce({ description: 'New ordinary opportunity', choices: [{ text: 'Continue', effects: {} }] });
    await act(async () => { await result.current.triggerActivityEvent('A new activity'); });
    const offered = structuredClone(result.current.currentEvent);
    expect(offered.source).toBe('activity');
    expect(offered).not.toHaveProperty('meta');
    await cloud.settle(true);
    expect(backend.setDoc).toHaveBeenCalledTimes(2);
    expect(cloud.read().currentEvent).toEqual(offered);
    expect(cloud.read()).toMatchObject({ bank: previous === 'custody' ? 9000 : 12010, schemaVersion: 1, narrativeMode: true });
    expect(cloud.read().relationships).toEqual(result.current.relationships);
    expect(cloud.read().history).toEqual(result.current.history);
    if (previous === 'custody') expect(cloud.read().relationships[0].childSupport).toBe(2400);
    unmount();
    const restored = await restore();
    expect(restored.result.current.currentEvent).toEqual(offered);
    expect(restored.result.current.currentEvent.source).not.toBe('recovery');
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
  });
});

// These tests catch duplicate tuition, stale closure commits, and feedback from an obsolete life.
describe('education command commit and lifecycle-scoped receipts', () => {
  const preserved = { flags: ['opportunity_seen'], activitiesThisYear: { vacation__Staycation: 1 }, currentEvent: null };
  async function loadEducationLife(fields = {}, options) {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Education Player', {
      age: 18, bank: 100000, education: { ...INITIAL_EDUCATION, highSchool: true }, ...preserved, ...fields,
    })));
    const rendered = await ready(options);
    await waitFor(() => expect(rendered.result.current.character?.name).toBe('Education Player'));
    return rendered;
  }

  it('quotes without writing and confirms exactly once in StrictMode', async () => {
    const { result } = await loadEducationLife({}, { wrapper: StrictMode });
    const history = result.current.history;
    expect(result.current.quoteEducation('bachelor')).toMatchObject({ eligible: true, preview: { firstYearTuition: 20000, bankAfterEnrollment: 80000 } });
    expect(result.current.history).toBe(history);
    expect(result.current.bank).toBe(100000);
    expect(backend.setDoc).not.toHaveBeenCalled();
    let decision;
    act(() => { decision = result.current.enrollInDegree('bachelor', {
      actionId: 'first-degree', expectedBasis: result.current.quoteEducation('bachelor').basis,
    }); });
    expect(decision.result.status).toBe('committed');
    expect(result.current.bank).toBe(80000);
    expect(result.current.education.currentDegree.yearsInProgram).toBe(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const [path, save, options] = backend.setDoc.mock.calls[0];
    expect(path).toBe('users/guest/saves/currentLife');
    expect(save).toMatchObject({ bank: 80000, education: result.current.education, history: result.current.history, ...preserved });
    expect(Object.keys(save).sort()).toEqual([...LIFE_SAVE_KEYS].sort());
    expect(options).toEqual({ mergeFields: Object.keys(save) });
    await waitFor(() => expect(result.current.lastEducationAction.saveStatus).toBe('saved'));
    expect(generateDynamicEvent).not.toHaveBeenCalled();
  });

  it.each(['education-first', 'career-first'])('serializes %s snapshots while acknowledging each domain independently', async order => {
    const { result } = await loadEducationLife();
    const first = deferred(), second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let education, career;
    act(() => {
      if (order === 'career-first') career = result.current.chooseCareer('barista', { actionId: 'career' });
      education = result.current.enrollInDegree('bachelor', { actionId: 'education' });
      if (order === 'education-first') career = result.current.chooseCareer('barista', { actionId: 'career' });
    });
    expect(education.result.status).toBe('committed');
    expect(career.result.status).toBe('committed');
    expect(result.current.bank).toBe(80000);
    expect(result.current.career.id).toBe('barista');
    expect(result.current.history.map(entry => entry.action.id)).toEqual(order === 'education-first' ? ['education', 'career'] : ['career', 'education']);
    expect(result.current.lastEducationAction.saveStatus).toBe('pending');
    expect(result.current.lastCareerAction.saveStatus).toBe('pending');
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    const firstDecision = order === 'education-first' ? education : career;
    await act(async () => { first.resolve(); expect(await firstDecision.persistence).toMatchObject({ status: 'saved' }); });
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    const [, combined, options] = backend.setDoc.mock.calls[1];
    expect(combined).toMatchObject({ ...preserved, bank: 80000, education: result.current.education, career: result.current.career, history: result.current.history });
    expect(options).toEqual({ mergeFields: Object.keys(combined) });
    expect(result.current.lastEducationAction.saveStatus).toBe(order === 'education-first' ? 'saved' : 'pending');
    expect(result.current.lastCareerAction.saveStatus).toBe(order === 'career-first' ? 'saved' : 'pending');
    await act(async () => { second.resolve(); expect(await (order === 'education-first' ? career : education).persistence).toMatchObject({ status: 'saved' }); });
    expect(result.current.lastEducationAction.saveStatus).toBe('saved');
    expect(result.current.lastCareerAction.saveStatus).toBe('saved');
  });

  it.each(['education-first', 'career-first'])('rejects a cross-domain ID conflict for %s without a second write', async order => {
    const { result } = await loadEducationLife();
    let committed, conflict;
    act(() => {
      committed = order === 'education-first'
        ? result.current.enrollInDegree('bachelor', { actionId: 'shared-id' })
        : result.current.chooseCareer('barista', { actionId: 'shared-id' });
      conflict = order === 'education-first'
        ? result.current.chooseCareer('barista', { actionId: 'shared-id' })
        : result.current.enrollInDegree('bachelor', { actionId: 'shared-id' });
    });
    expect(conflict.result).toMatchObject({ status: 'rejected', code: 'action_id_conflict' });
    expect(conflict.persistence).toBeNull();
    expect(result.current.history).toHaveLength(1);
    expect(result.current.bank).toBe(order === 'education-first' ? 80000 : 100000);
    await act(async () => { await committed.persistence; });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it('keeps a duplicate pending receipt visible without charging or saving twice', async () => {
    const { result } = await loadEducationLife();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    let first, duplicate;
    act(() => { first = result.current.enrollInDegree('bachelor', { actionId: 'once' }); });
    const feedback = result.current.lastEducationAction;
    act(() => { duplicate = result.current.enrollInDegree('bachelor', { actionId: 'once' }); });
    expect(duplicate.result).toMatchObject({ status: 'noop', code: 'duplicate_action' });
    expect(duplicate.persistence).toBeNull();
    expect(result.current.lastEducationAction).toBe(feedback);
    expect(result.current.bank).toBe(80000);
    expect(result.current.history).toHaveLength(1);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(); await first.persistence; });
    expect(result.current.lastEducationAction.saveStatus).toBe('saved');
  });

  it('rejects a second fresh ID in the same turn without a second charge, history entry, or write', async () => {
    const { result } = await loadEducationLife();
    let first, second;
    act(() => {
      first = result.current.enrollInDegree('bachelor', { actionId: 'first' });
      second = result.current.enrollInDegree('associate', { actionId: 'second' });
    });
    expect(second.result).toMatchObject({ status: 'rejected', code: 'already_enrolled' });
    expect(second.persistence).toBeNull();
    expect(result.current.lastEducationAction).toMatchObject({ actionId: 'second', saveStatus: 'not_requested' });
    expect(result.current.bank).toBe(80000);
    expect(result.current.education.currentDegree.type).toBe('bachelor');
    expect(result.current.history).toHaveLength(1);
    await act(async () => { await first.persistence; });
    expect(result.current.lastEducationAction).toMatchObject({ actionId: 'second', saveStatus: 'not_requested' });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'])('keeps enrollment committed while deferred storage completes by %s', async completion => {
    const { result } = await loadEducationLife();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    let decision;
    act(() => { decision = result.current.enrollInDegree('bachelor', { actionId: 'receipt' }); });
    const committed = { bank: result.current.bank, education: result.current.education, history: result.current.history };
    expect(result.current.lastEducationAction).toMatchObject({ actionId: 'receipt', result: { status: 'committed' }, saveStatus: 'pending' });
    await act(async () => {
      pending[completion](completion === 'reject' ? new Error('SECRET provider rejection') : undefined);
      expect(await decision.persistence).toMatchObject({ status: completion === 'resolve' ? 'saved' : 'failed', operationId: expect.any(String) });
    });
    expect(result.current).toMatchObject(committed);
    expect(result.current.lastEducationAction.saveStatus).toBe(completion === 'resolve' ? 'saved' : 'failed');
    expect(JSON.stringify(result.current.lastEducationAction)).not.toContain('SECRET');
  });

  it('reports skipped when Firebase is unconfigured without requiring an age gate', async () => {
    backend.configured = false;
    const { result } = renderHook(() => useGameState());
    act(() => result.current.startLife('Offline', 'Female', 'US'));
    act(() => result.current.debugGrantDegree('highSchool'));
    act(() => result.current.debugModifyBank(100000));
    let decision;
    act(() => { decision = result.current.enrollInDegree('bachelor'); });
    expect(decision.result.status).toBe('committed');
    await act(async () => { expect(await decision.persistence).toMatchObject({ status: 'skipped' }); });
    expect(result.current.lastEducationAction.saveStatus).toBe('skipped');
    expect(result.current.bank).toBe(80000);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it.each([
    { fields: { bank: 19999 }, target: 'bachelor', code: 'insufficient_funds' },
    { fields: { education: { ...INITIAL_EDUCATION } }, target: 'bachelor', code: 'prerequisite_required' },
    { fields: {}, target: 'highSchool', code: 'unknown_degree' },
    { fields: { isDead: true }, target: 'bachelor', code: 'dead' },
  ])('rejects $code without history or persistence', async ({ fields, target, code }) => {
    const { result } = await loadEducationLife(fields);
    const before = { bank: result.current.bank, education: result.current.education, history: result.current.history };
    let decision;
    act(() => { decision = result.current.enrollInDegree(target); });
    expect(decision.result).toMatchObject({ status: 'rejected', code });
    expect(decision.persistence).toBeNull();
    expect(result.current).toMatchObject(before);
    expect(result.current.lastEducationAction.saveStatus).toBe('not_requested');
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('rejects a captured stale quote and commits only after explicit refreshed confirmation', async () => {
    const { result } = await loadEducationLife();
    const quote = result.current.quoteEducation('bachelor');
    act(() => result.current.debugModifyBank(100));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    backend.setDoc.mockClear();
    let stale, fresh;
    act(() => { stale = result.current.enrollInDegree('bachelor', { actionId: 'stale', expectedBasis: quote.basis }); });
    expect(stale.result).toMatchObject({ status: 'rejected', code: 'stale_quote' });
    expect(stale.persistence).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    act(() => { fresh = result.current.enrollInDegree('bachelor', { actionId: 'fresh', expectedBasis: result.current.quoteEducation('bachelor').basis }); });
    await act(async () => { await fresh.persistence; });
    expect(result.current.bank).toBe(80100);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it.each(['startLife', 'resetLife', 'hydration', 'switch', 'signout', 'unmount'])('invalidates both pending domain receipts across %s', async boundary => {
    if (boundary === 'signout') backend.auth.currentUser = user('signed-in', false);
    const { result, unmount } = await loadEducationLife();
    const first = deferred(), second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let education, career;
    act(() => {
      education = result.current.enrollInDegree('bachelor', { actionId: 'old-education' });
      career = result.current.chooseCareer('barista', { actionId: 'old-career' });
    });
    const before = { education: result.current.lastEducationAction, career: result.current.lastCareerAction };
    expect(before.education.saveStatus).toBe('pending');
    expect(before.career.saveStatus).toBe('pending');
    async function settleOldReceipts() {
      await act(async () => { first.resolve(); await education.persistence; });
      await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
      await act(async () => { second.resolve(); await career.persistence; });
    }
    if (boundary === 'startLife' || boundary === 'resetLife') act(() => result.current[boundary]('New', 'Female', 'US'));
    if (boundary === 'switch' || boundary === 'hydration') {
      const load = deferred();
      backend.getDoc.mockReturnValueOnce(load.promise);
      backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('other', false) });
      let switching;
      await act(async () => { switching = result.current.signInWithEmail('other@example.com', 'fixture-password', 'signin'); });
      expect(result.current.character).toBeNull();
      expect(result.current.lastEducationAction).toBeNull();
      expect(result.current.lastCareerAction).toBeNull();
      if (boundary === 'hydration') {
        await settleOldReceipts();
        expect(result.current.lastEducationAction).toBeNull();
        expect(result.current.lastCareerAction).toBeNull();
      }
      // Reach hydration through a genuine clear/load, never an inaccessible product setter.
      await act(async () => { load.resolve(snapshot(savedLife('Other life'))); await switching; });
      expect(result.current.character.name).toBe('Other life');
    }
    if (boundary === 'signout') await act(async () => { await result.current.signOutAccount(); });
    if (boundary === 'unmount') unmount();
    else {
      expect(result.current.lastEducationAction).toBeNull();
      expect(result.current.lastCareerAction).toBeNull();
    }
    if (boundary !== 'hydration') await settleOldReceipts();
    expect(result.current.lastEducationAction).toBe(boundary === 'unmount' ? before.education : null);
    expect(result.current.lastCareerAction).toBe(boundary === 'unmount' ? before.career : null);
  });

  it('boot hydration clears rejected pre-hydration domain feedback without manufacturing a valid blank life', async () => {
    const boot = deferred();
    backend.getDoc.mockReturnValueOnce(boot.promise);
    const { result } = await ready();
    act(() => {
      expect(result.current.enrollInDegree('bachelor').result).toMatchObject({ status: 'rejected', code: 'invalid_state' });
      expect(result.current.chooseCareer('barista').result.status).toBe('rejected');
    });
    expect(result.current.lastEducationAction.saveStatus).toBe('not_requested');
    expect(result.current.lastCareerAction.saveStatus).toBe('not_requested');
    await act(async () => { boot.resolve(snapshot(savedLife('Hydrated life'))); });
    expect(result.current.character.name).toBe('Hydrated life');
    expect(result.current.lastEducationAction).toBeNull();
    expect(result.current.lastCareerAction).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('remounts the actual acknowledged enrollment once and replays without a save', async () => {
    const legacy = { age: 17, text: 'Finished school' };
    const { result, unmount } = await loadEducationLife({ history: [legacy] });
    let decision;
    act(() => { decision = result.current.enrollInDegree('bachelor', { actionId: 'restore-education' }); });
    await act(async () => { await decision.persistence; });
    const acknowledged = structuredClone(backend.setDoc.mock.calls[0][1]);
    unmount();
    const reloaded = await loadEducationLife(acknowledged);
    expect(reloaded.result.current.bank).toBe(80000);
    expect(reloaded.result.current.education.currentDegree.yearsInProgram).toBe(1);
    expect(reloaded.result.current.history).toEqual([legacy, decision.result.patch.history[1]]);
    expect(reloaded.result.current.lastEducationAction).toBeNull();
    expect(reloaded.result.current.lastCareerAction).toBeNull();
    expect(reloaded.result.current.flags).toEqual(preserved.flags);
    expect(reloaded.result.current.activitiesThisYear).toEqual(preserved.activitiesThisYear);
    backend.setDoc.mockClear();
    let replay;
    act(() => { replay = reloaded.result.current.enrollInDegree('bachelor', { actionId: 'restore-education' }); });
    expect(replay.result).toMatchObject({ status: 'noop', code: 'duplicate_action' });
    expect(replay.persistence).toBeNull();
    expect(reloaded.result.current.bank).toBe(80000);
    expect(reloaded.result.current.history).toHaveLength(2);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('rejects education during the annual await and unresolved offer, including the same tick', async () => {
    const { result } = await loadEducationLife();
    const pending = deferred();
    generateDynamicEvent.mockReturnValueOnce(pending.promise);
    let aging, locked;
    act(() => {
      aging = result.current.ageUp();
      locked = result.current.enrollInDegree('bachelor');
    });
    expect(locked.result).toMatchObject({ status: 'rejected', code: 'action_locked' });
    expect(locked.persistence).toBeNull();
    expect(backend.setDoc).not.toHaveBeenCalled();
    act(() => expect(result.current.enrollInDegree('bachelor').result.code).toBe('action_locked'));
    await act(async () => { pending.resolve({ description: 'Continue', choices: [{ text: 'OK', effects: {} }] }); await aging; });
    const writes = backend.setDoc.mock.calls.length;
    act(() => {
      const blocked = result.current.enrollInDegree('bachelor');
      expect(blocked.result).toMatchObject({ status: 'rejected', code: 'action_locked' });
      expect(blocked.persistence).toBeNull();
    });
    expect(backend.setDoc).toHaveBeenCalledTimes(writes);
    expect(result.current.education.currentDegree).toBeNull();
  });

  it('honors an event installed before the same act has rendered', async () => {
    const { result } = await loadEducationLife();
    let blocked;
    await act(async () => {
      await result.current.triggerActivityEvent('A new opportunity');
      blocked = result.current.enrollInDegree('bachelor');
    });
    expect(blocked.result).toMatchObject({ status: 'rejected', code: 'action_locked' });
    expect(blocked.persistence).toBeNull();
    expect(result.current.education.currentDegree).toBeNull();
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
  });

  it('clears the eager choice lock and commits against the latest post-choice bank and history', async () => {
    const { result } = await loadEducationLife({ currentEvent: {
      version: 1, id: 'tuition-gift', age: 18, source: 'annual', description: 'A tuition gift',
      choices: [{ text: 'Accept gift', effects: { bank: 20000, flags: ['gift_received'] } }],
    } });
    const first = deferred(), second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let choice, education;
    act(() => {
      choice = result.current.handleChoice('tuition-gift', 0);
      const quote = result.current.quoteEducation('bachelor');
      expect(quote.preview.bankBefore).toBe(120000);
      education = result.current.enrollInDegree('bachelor', { actionId: 'after-choice', expectedBasis: quote.basis });
    });
    expect(education.result.status).toBe('committed');
    expect(result.current.bank).toBe(100000);
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].text).toContain('Accept gift');
    expect(result.current.history[1].action.beforeBank).toBe(120000);
    expect(result.current.lastContinuitySave).toBeNull();
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(); await choice.persistence; });
    expect(result.current.lastContinuitySave).toBeNull();
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    expect(backend.setDoc.mock.calls[1][1]).toMatchObject({ bank: 100000, currentEvent: null, flags: ['opportunity_seen', 'gift_received'], history: result.current.history });
    await act(async () => { second.resolve(); await education.persistence; });
  });

  it.each(['pending', 'saved'])('enrollment supersedes %s continuity feedback and obsolete receipts cannot restore it', async status => {
    const { result } = await loadEducationLife();
    const first = deferred(), second = deferred();
    backend.setDoc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => result.current.consumeYearlyActivity('health', 'Run', 1));
    if (status === 'saved') await act(async () => first.resolve());
    expect(result.current.lastContinuitySave.saveStatus).toBe(status);
    let education;
    act(() => { education = result.current.enrollInDegree('bachelor'); });
    expect(result.current.lastEducationAction.saveStatus).toBe('pending');
    expect(result.current.lastContinuitySave).toBeNull();
    if (status === 'pending') await act(async () => first.resolve());
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    expect(result.current.lastContinuitySave).toBeNull();
    expect(backend.setDoc.mock.calls[1][1]).toMatchObject({ flags: preserved.flags, activitiesThisYear: { ...preserved.activitiesThisYear, health__Run: 1 }, currentEvent: null });
    await act(async () => { second.resolve(); await education.persistence; });
    expect(result.current.lastEducationAction.saveStatus).toBe('saved');
    expect(result.current.lastContinuitySave).toBeNull();
  });
});


describe('accepted skill training through MainGame and the real owner', () => {
  it('preserves insufficient-funds slot ordering, guard rejection, skill cap, and legacy training', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Training Player', { bank: 20, stats: { looks: 10, acting: 99, athleticism: 40 } })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Training Player'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const model = ACTIVITY_MENUS.mind_body.find(item => item.specialAction === 'model_lesson');
    act(() => expect(result.current.performSkillTraining(model, 'mind_body').status).toBe('blocked_guard'));
    expect(random).not.toHaveBeenCalled();
    expect(backend.setDoc).not.toHaveBeenCalled();
    const lesson = ACTIVITY_MENUS.mind_body.find(item => item.specialAction === 'act_lesson');
    const event = deferred();
    generateDynamicEvent.mockReturnValue(event.promise);
    act(() => expect(result.current.performSkillTraining({ ...lesson, yearlyLimit: 1 }, 'mind_body').status).toBe('blocked_cost'));
    expect(result.current.activitiesThisYear).toEqual({ [`mind_body__${lesson.text}`]: 1 });
    expect(result.current.bank).toBe(20);
    expect(result.current.stats.acting).toBe(99);
    expect(generateDynamicEvent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ bank: 20 }), "Tried to train skills, but couldn't afford the lessons.");
    act(() => expect(result.current.performSkillTraining(lesson, 'mind_body').status).toBe('blocked_busy'));
    await act(async () => event.resolve({ description: 'No funds', choices: [{ text: 'OK', effects: {} }] }));
    await act(async () => result.current.handleChoice(result.current.currentEvent.id, 0).persistence);
    act(() => expect(result.current.trainHiddenSkill('acting')).toBe(8));
    expect(result.current.stats.acting).toBe(100);
    act(() => { result.current.trainHiddenSkill('athleticism'); result.current.trainHiddenSkill('athleticism'); });
    expect(result.current.stats.athleticism).toBe(56);
  });
  const examples = [
    ['Go to the Gym', 'athleticism', 100, 3],
    ['Go for a Run', 'athleticism', 100, 8],
    ['Acting Lessons ($50)', 'acting', 50, 3],
    ['Voice Lessons ($50)', 'voice', 50, 3],
    ['Modeling Classes ($50)', 'modeling', 50, 3],
  ];
  it.each(examples)('%s saves one complete base outcome before generation, surviving later failed offer save', async (text, skill, balance, gain) => {
    const initial = savedLife('Training Player', { bank: 100, stats: { happiness: 50, health: 80, looks: 60, athleticism: 40, acting: 40, voice: 40, modeling: 40 } });
    let acknowledged = structuredClone(initial);
    backend.getDoc.mockImplementation(async () => snapshot(structuredClone(acknowledged)));
    const baseAck = deferred();
    backend.setDoc.mockImplementationOnce(async (_path, save, options) => {
      await baseAck.promise;
      acknowledged = applyFirestoreSave(acknowledged, save, options);
    }).mockRejectedValueOnce(new Error('offer failed'));
    const event = deferred();
    generateDynamicEvent.mockReturnValue(event.promise);
    if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {};
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    let engine;
    function Connected() { engine = useGameState(); return engine.character ? <MainGame engine={engine} /> : null; }
    const ui = render(<StrictMode><Connected /></StrictMode>);
    await screen.findByText('Training Player');
    vi.spyOn(Math, 'random').mockReturnValue(gain === 8 ? 0.999 : 0);
    fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mind & Body/ }));
    const button = screen.getByRole('button', { name: name => name.startsWith(text) });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(engine.stats[skill]).toBe(40 + gain);
    expect(engine.bank).toBe(balance);
    expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
    expect(generateDynamicEvent.mock.calls[0][0]).toMatchObject({ bank: balance, stats: { [skill]: 40 + gain } });
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    const item = ACTIVITY_MENUS.mind_body.find(item => item.text === text);
    const counters = item.yearlyLimit ? { [`mind_body__${text}`]: 1 } : {};
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: balance, stats: { [skill]: 40 + gain }, activitiesThisYear: counters, currentEvent: null });
    if (item.cost) expect(screen.getByText(content => content.endsWith(`Skill +${gain}`))).toBeInTheDocument();
    await act(async () => baseAck.resolve());
    await act(async () => event.resolve({ description: 'Training offer', choices: [{ text: 'Continue', effects: {} }] }));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(2));
    ui.unmount();
    scroll.mockRestore();
    const reloaded = await ready();
    await waitFor(() => expect(reloaded.result.current.character?.name).toBe('Training Player'));
    expect(reloaded.result.current.stats[skill]).toBe(40 + gain);
    expect(reloaded.result.current.bank).toBe(balance);
    expect(reloaded.result.current.activitiesThisYear).toEqual(counters);
    expect(reloaded.result.current.currentEvent).toBeNull();
    if (item.yearlyLimit) {
      act(() => expect(reloaded.result.current.performSkillTraining(item, 'mind_body').status).toBe('blocked_yearly'));
      expect(generateDynamicEvent).toHaveBeenCalledTimes(1);
      expect(backend.setDoc).toHaveBeenCalledTimes(2);
    }
  });
});

describe('coherent relationship milestone outcomes', () => {
  const partner = { id: 'partner', name: 'Partner', age: 30, status: 'dating', type: 'Lover', relation: 80, isAlive: true };
  it.each([
    ['child', /Have a Child/, 70, 50000, 'Child'],
    ['friend', /Meet Someone New/, 55, 50000, 'Friend'],
    ['dating', /Break Up/, 35, 50000, 'Ex'],
    ['married', /File for Divorce/, 35, 42500, 'Ex'],
  ])('%s saves and acknowledges happiness, bank, relationship and memory together through its real UI', async (scenario, action, happiness, balance, type) => {
    let acknowledged = savedLife('Milestone Player', { age: 30, bank: 50000, stats: { happiness: 50 }, flags: ['kept'], activitiesThisYear: { kept: 1 }, history: [{ age: 0, text: 'Born' }], relationships: [{ ...partner, status: scenario === 'married' ? 'married' : 'dating' }] });
    backend.getDoc.mockImplementation(async () => snapshot(structuredClone(acknowledged)));
    const receipt = deferred();
    backend.setDoc.mockImplementation(async (_path, save, options) => {
      await receipt.promise;
      acknowledged = applyFirestoreSave(acknowledged, save, options);
    });
    let engine;
    function Connected() { engine = useGameState(); return engine.character ? <MainGame engine={engine} /> : null; }
    const ui = render(<StrictMode><Connected /></StrictMode>);
    await screen.findByText('Milestone Player');
    fireEvent.click(screen.getByRole('button', { name: /Relationships/ }));
    if (scenario !== 'friend') fireEvent.click(screen.getByRole('button', { name: /Partner/ }));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(engine.stats.happiness).toBe(happiness);
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    const save = backend.setDoc.mock.calls[0][1];
    expect(save).toMatchObject({ bank: balance, stats: { happiness }, flags: ['kept'], activitiesThisYear: { kept: 1 }, currentEvent: null });
    expect(save.relationships.some(rel => rel.type === type)).toBe(true);
    expect(save.history).toHaveLength(2);
    expect(save.history).toEqual(engine.history);
    expect(save.relationships).toEqual(engine.relationships);
    await act(async () => receipt.resolve());
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    ui.unmount();
    const reload = await ready();
    await waitFor(() => expect(reload.result.current.character?.name).toBe('Milestone Player'));
    expect(reload.result.current.stats.happiness).toBe(happiness);
    expect(reload.result.current.bank).toBe(balance);
    expect(reload.result.current.relationships).toEqual(save.relationships);
    expect(reload.result.current.history).toEqual(save.history);
  });

  it.each([['haveChild', 95, 100], ['meetFriend', 98, 100], ['breakUp', 2, 0]])('%s preserves happiness clamping', async (command, happiness, expected) => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Clamp Player', { age: 30, stats: { happiness }, relationships: [partner] })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Clamp Player'));
    act(() => result.current[command]('partner'));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0][1].stats.happiness).toBe(expected);
    expect(result.current.stats.happiness).toBe(expected);
  });

  it('chains child, friend and breakup from the eager snapshot without losing an outcome', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Chained Player', { age: 30, bank: 50000, stats: { happiness: 50 }, relationships: [partner], history: [] })));
    const { result } = await ready({ wrapper: StrictMode });
    await waitFor(() => expect(result.current.character?.name).toBe('Chained Player'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    act(() => { result.current.haveChild('partner'); result.current.meetFriend(); result.current.breakUp('partner'); });
    expect(result.current.stats.happiness).toBe(60);
    expect(result.current.relationships.map(rel => rel.type)).toEqual(['Ex', 'Child', 'Friend']);
    expect(result.current.history).toHaveLength(3);
    expect(random).toHaveBeenCalledTimes(5);
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(3));
    expect(backend.setDoc.mock.calls[2][1]).toMatchObject({ stats: { happiness: 60 }, relationships: result.current.relationships, history: result.current.history });
  });
});


describe('truthful gift previews and command admission', () => {
  const examples = [
    ['broke', 500, [5, 5, 5]], ['struggling', 1000, [5, 5, 10]],
    ['working', 10000, [5, 10, 20]], ['middle', 50000, [5, 10, 20]],
    ['upper_middle', 250000, [10, 20, 20]], ['wealthy', 1000000, [20, 20, 20]],
    ['rich', 10000000, [20, 20, 20]], ['ultra', 100000000, [20, 20, 20]],
  ].flatMap(([tierId, balance, gains]) => gains.map((gain, index) => [tierId, balance, index, gain]));
  it.each(examples)('%s gift %i index %i advertises the gain actually acknowledged and reloaded', async (tierId, balance, index, gain) => {
    const amount = WEALTH_TIERS.find(tier => tier.id === tierId).giftAmounts[index];
    let acknowledged = savedLife('Gift Player', { bank: balance, history: [], relationships: [{ id: 'friend', name: 'Gift Friend', type: 'Friend', status: 'friend', age: 30, isAlive: true, relation: 40 }] });
    backend.getDoc.mockImplementation(async () => snapshot(structuredClone(acknowledged)));
    backend.setDoc.mockImplementation(async (_path, save, options) => { acknowledged = applyFirestoreSave(acknowledged, save, options); });
    let engine;
    function Connected() { engine = useGameState(); return engine.character ? <MainGame engine={engine} /> : null; }
    const ui = render(<StrictMode><Connected /></StrictMode>);
    await screen.findByText('Gift Player');
    fireEvent.click(screen.getByRole('button', { name: /Relationships/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gift Friend/ }));
    const gift = screen.getByRole('button', { name: name => name.startsWith(`Gift $${amount.toLocaleString()} `) });
    expect(gift).toHaveTextContent(`+${gain} rel`);
    fireEvent.click(gift);
    await waitFor(() => expect(acknowledged.history).toHaveLength(1));
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(acknowledged.bank).toBe(balance - amount);
    expect(acknowledged.relationships[0].relation).toBe(40 + gain);
    expect(acknowledged.activitiesThisYear).toEqual({ rel_interact__friend: 1 });
    expect(acknowledged.history[0].text).toContain(`+${gain} Relation.`);
    expect(engine.lastContinuitySave.saveStatus).toBe('saved');
    ui.unmount();
    const reload = await ready();
    await waitFor(() => expect(reload.result.current.character?.name).toBe('Gift Player'));
    expect(reload.result.current.bank).toBe(balance - amount);
    expect(reload.result.current.relationships[0].relation).toBe(40 + gain);
    expect(reload.result.current.history).toEqual(acknowledged.history);
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, null, undefined, '200', {}, []].map(amount => [amount]))('rejects invalid gift %s before any mutation or save', async amount => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Gift Player', { bank: 1000, history: [], relationships: [{ id: 'friend', relation: 40 }] })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Gift Player'));
    act(() => expect(result.current.giftRelationship('friend', amount)).toBe('blocked'));
    expect(result.current.bank).toBe(1000);
    expect(result.current.relationships).toEqual([{ id: 'friend', relation: 40 }]);
    expect(result.current.activitiesThisYear).toEqual({});
    expect(result.current.history).toEqual([]);
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('caps a valid threshold gift at 100 while preserving the charged amount and advertised gain', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Gift Player', { bank: 1000, relationships: [{ id: 'friend', name: 'Friend', relation: 95 }] })));
    const { result } = await ready();
    await waitFor(() => expect(result.current.character?.name).toBe('Gift Player'));
    act(() => result.current.giftRelationship('friend', 200));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: 800, relationships: [{ relation: 100 }], history: [{ text: 'Relationships: You gifted Friend $200. +10 Relation.' }] });
  });
});


describe('coherent asset purchase memories', () => {
  it.each([
    ['vehicles', 'used_clunker', 6000, 3000, 'belongings', 'Shopping: Bought a Used Clunker for $3,000.'],
    ['property', 'studio_apt', 120000, 70000, 'properties', 'Real Estate: Purchased a Studio Apartment for $50,000.'],
  ])('%s commits one holding, debit and memory and restores its acknowledged save', async (category, catalogId, balance, after, field, memory) => {
    let acknowledged = savedLife('Asset Player', { bank: balance, history: [{ age: 0, text: 'Born' }], flags: ['kept'], activitiesThisYear: { kept: 1 } });
    backend.getDoc.mockImplementation(async () => snapshot(structuredClone(acknowledged)));
    backend.setDoc.mockImplementation(async (_path, save, options) => { acknowledged = applyFirestoreSave(acknowledged, save, options); });
    const hook = await ready({ wrapper: StrictMode });
    await waitFor(() => expect(hook.result.current.character?.name).toBe('Asset Player'));
    const item = Object.values(ASSET_CATALOG).flat().find(item => item.id === catalogId);
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    act(() => hook.result.current.buyAsset(category, item));
    await waitFor(() => expect(acknowledged[field]).toHaveLength(1));
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    expect(random).toHaveBeenCalledTimes(1);
    expect(acknowledged).toMatchObject({ bank: after, flags: ['kept'], activitiesThisYear: { kept: 1 }, currentEvent: null });
    expect(acknowledged[field][0]).toMatchObject({ catalogId, currentValue: item.cost, purchasePrice: item.cost, yearsOwned: 0 });
    expect(acknowledged.history).toEqual([{ age: 0, text: 'Born' }, { age: 33, text: memory }]);
    const assetId = acknowledged[field][0].id;
    hook.unmount();
    const reload = await ready({ wrapper: StrictMode });
    await waitFor(() => expect(reload.result.current.character?.name).toBe('Asset Player'));
    expect(reload.result.current.bank).toBe(after);
    expect(reload.result.current[field]).toHaveLength(1);
    expect(reload.result.current[field][0].id).toBe(assetId);
    expect(reload.result.current.history).toEqual(acknowledged.history);
  });

  it('saves the actual shop listing price and visible purchase memory from a native Buy button', async () => {
    backend.getDoc.mockResolvedValue(snapshot(savedLife('Shop Player', { bank: 120000, history: [] })));
    let engine;
    function Connected() { engine = useGameState(); return engine.character ? <MainGame engine={engine} /> : null; }
    render(<StrictMode><Connected /></StrictMode>);
    await screen.findByText('Shop Player');
    fireEvent.click(screen.getByRole('button', { name: /Assets/ }));
    fireEvent.click(screen.getByRole('button', { name: /Shopping/ }));
    fireEvent.click(screen.getByRole('button', { name: /Prestige Realty/ }));
    const listing = screen.getByText('Studio Loft (412 Maple Ave)').closest('.glass-panel');
    fireEvent.click(within(listing).getByRole('button', { name: 'Buy' }));
    await waitFor(() => expect(backend.setDoc).toHaveBeenCalledTimes(1));
    expect(backend.setDoc.mock.calls[0][1]).toMatchObject({ bank: 71500, properties: [{ name: 'Studio Loft (412 Maple Ave)', purchasePrice: 48500 }], history: [{ text: 'Real Estate: Purchased a Studio Loft (412 Maple Ave) for $48,500.' }] });
    expect(engine.history).toHaveLength(1);
  });
});
