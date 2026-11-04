import { StrictMode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCloudAccount } from '../engine/cloud/useCloudAccount';

const backend = vi.hoisted(() => ({
  configured: true, auth: { currentUser: null }, db: {},
  getDoc: vi.fn(), setDoc: vi.fn(), getDocs: vi.fn(),
  signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(), signInAnonymously: vi.fn(),
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
    return () => {};
  },
  signInAnonymously: backend.signInAnonymously, signOut: backend.signOut,
  EmailAuthProvider: { credential: vi.fn() },
  linkWithCredential: vi.fn(), createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: backend.signInWithEmailAndPassword,
}));

const user = uid => ({ uid, isAnonymous: false, getIdToken: vi.fn().mockResolvedValue('fixture-token') });
const snapshot = data => ({ exists: () => data != null, data: () => data });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
function mountCloud(options) {
  const lifeRevisionRef = { current: 0 };
  const callbacks = {
    hydrateFromSave: vi.fn(), clearLocalLife: vi.fn(() => { lifeRevisionRef.current += 1; }),
    ignoreCloudLoadRef: { current: false }, setCareersData: vi.fn(), lifeRevisionRef,
  };
  return { ...renderHook(() => useCloudAccount(callbacks), options), ...callbacks };
}
async function ready() {
  const rendered = mountCloud();
  await waitFor(() => expect(rendered.result.current.authAccount?.uid).toBe('first'));
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  backend.configured = true;
  backend.auth.currentUser = user('first');
  backend.getDoc.mockReset().mockResolvedValue(snapshot(null));
  backend.getDocs.mockReset().mockResolvedValue({ empty: true });
  backend.setDoc.mockReset().mockResolvedValue(undefined);
  backend.signInWithEmailAndPassword.mockReset();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('acknowledged cloud save receipts', () => {
  it('adopts storage after a StrictMode effect restart', async () => {
    const { result } = mountCloud({ wrapper: StrictMode });
    await waitFor(() => expect(result.current.authAccount?.uid).toBe('first'));
    expect((await result.current.syncToCloud({ bank: 50 })).status).toBe('saved');
  });

  it('reports saved only after storage acknowledges the captured snapshot', async () => {
    const { result } = await ready();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    const payload = { career: { id: 'artist', salary: 40000 }, history: [{ age: 20, text: 'Hired' }] };
    let settled = false;
    const writing = result.current.syncToCloud(payload).then(receipt => { settled = true; return receipt; });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    payload.career.salary = 999999;
    payload.history[0].text = 'Changed after save request';
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(backend.setDoc.mock.calls[0]).toEqual([
      'users/first/saves/currentLife',
      { career: { id: 'artist', salary: 40000 }, history: [{ age: 20, text: 'Hired' }] },
      { merge: true },
    ]);
    pending.resolve();
    expect(await writing).toEqual({ status: 'saved', operationId: expect.any(String), errorClass: null });
  });

  it('returns skipped without writing when storage is unconfigured', async () => {
    backend.configured = false;
    const { result } = mountCloud();
    expect(await result.current.syncToCloud({ bank: 50 })).toEqual({
      status: 'skipped', operationId: expect.any(String), errorClass: null,
    });
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('returns a sanitized failed receipt after storage rejects', async () => {
    const { result } = await ready();
    backend.setDoc.mockRejectedValueOnce(Object.assign(new Error('private provider error'), { name: 'FirebaseError', code: 'permission-denied' }));
    const receipt = await result.current.syncToCloud({ bank: 50 });
    expect(receipt).toEqual({ status: 'failed', operationId: expect.any(String), errorClass: 'FirebaseError' });
    expect(JSON.stringify(receipt)).not.toContain('private');
  });

  it('returns failed rather than rejecting when the snapshot cannot be cloned', async () => {
    const { result } = await ready();
    expect(await result.current.syncToCloud({ history: [() => {}] })).toEqual({
      status: 'failed', operationId: expect.any(String), errorClass: 'UnknownError',
    });
    expect(backend.setDoc).not.toHaveBeenCalled();
  });

  it('emits started at enqueue and matches final diagnostic and receipt operation IDs', async () => {
    const { result } = await ready();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    const first = result.current.syncToCloud({ bank: 100 });
    const second = result.current.syncToCloud({ bank: 200 });
    const records = () => console.info.mock.calls.map(([, record]) => record).filter(record => record?.event === 'save_sync');
    expect(records().map(record => record.status)).toEqual(['started', 'started']);
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    pending.resolve();
    const receipts = await Promise.all([first, second]);
    for (const receipt of receipts) {
      expect(records().filter(record => record.operationId === receipt.operationId).map(record => record.status)).toEqual(['started', 'saved']);
    }
  });

  it('orders older merges before reset and new-life replacements', async () => {
    const { result } = await ready();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    const oldSave = result.current.syncToCloud({ character: { name: 'Old' }, bank: 500 });
    const options = { replace: true };
    const reset = result.current.syncToCloud({ character: null, bank: 0 }, options);
    const newborn = result.current.syncToCloud({ character: { name: 'New' }, bank: 0 }, { replace: true });
    options.replace = false;
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    pending.resolve();
    expect((await Promise.all([oldSave, reset, newborn])).map(receipt => receipt.status)).toEqual(['saved', 'saved', 'saved']);
    expect(backend.setDoc.mock.calls).toEqual([
      ['users/first/saves/currentLife', { character: { name: 'Old' }, bank: 500 }, { merge: true }],
      ['users/first/saves/currentLife', { character: null, bank: 0 }],
      ['users/first/saves/currentLife', { character: { name: 'New' }, bank: 0 }],
    ]);
  });

  it('continues queued replacement writes after an older write fails', async () => {
    const { result } = await ready();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    const first = result.current.syncToCloud({ bank: 500 });
    const reset = result.current.syncToCloud({ character: null, bank: 0 }, { replace: true });
    expect(backend.setDoc).toHaveBeenCalledTimes(1);
    pending.reject(new Error('private failure'));
    expect((await first).status).toBe('failed');
    expect((await reset).status).toBe('saved');
    expect(backend.setDoc.mock.calls[1]).toEqual(['users/first/saves/currentLife', { character: null, bank: 0 }]);
  });

  it('keeps old writes on their captured account without blocking another account', async () => {
    const { result } = await ready();
    const pending = deferred();
    backend.setDoc.mockReturnValueOnce(pending.promise);
    const old = result.current.syncToCloud({ bank: 100 });
    const queued = result.current.syncToCloud({ bank: 200 });
    backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('second') });
    await act(async () => { await result.current.signInWithEmail('fixture@example.com', 'fixture-password', 'signin'); });
    const other = result.current.syncToCloud({ bank: 900 });
    expect(backend.setDoc.mock.calls[1]).toEqual(['users/second/saves/currentLife', { bank: 900 }, { merge: true }]);
    expect((await other).status).toBe('saved');
    pending.resolve();
    await Promise.all([old, queued]);
    expect(backend.setDoc.mock.calls[2]).toEqual(['users/first/saves/currentLife', { bank: 200 }, { merge: true }]);
  });
});


describe('obsolete cloud load protection', () => {
  it('ignores a boot save after the state owner advances its life boundary', async () => {
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise);
    const { lifeRevisionRef, hydrateFromSave } = await ready();
    lifeRevisionRef.current += 1;
    await act(async () => pending.resolve(snapshot({ character: { name: 'Obsolete' } })));
    expect(hydrateFromSave).not.toHaveBeenCalled();
  });

  it('ignores a boot save belonging to the account replaced by sign-in', async () => {
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(snapshot({ character: { name: 'Current account' } }));
    const { result, hydrateFromSave } = await ready();
    backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('second') });
    await act(async () => { await result.current.signInWithEmail('fixture@example.com', 'fixture-password', 'signin'); });
    await act(async () => pending.resolve(snapshot({ character: { name: 'Obsolete boot account' } })));
    expect(hydrateFromSave.mock.calls).toEqual([[{ character: { name: 'Current account' } }]]);
  });

  it('ignores an account save after a reset or start boundary advances the life', async () => {
    const { result, lifeRevisionRef, hydrateFromSave } = await ready();
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise);
    backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('second') });
    let signingIn;
    await act(async () => { signingIn = result.current.signInWithEmail('fixture@example.com', 'fixture-password', 'signin'); });
    lifeRevisionRef.current += 1;
    await act(async () => { pending.resolve(snapshot({ character: { name: 'Obsolete' } })); await signingIn; });
    expect(hydrateFromSave).not.toHaveBeenCalled();
  });

  it('ignores a delayed account load after another account has been adopted', async () => {
    const { result, hydrateFromSave } = await ready();
    const pending = deferred();
    backend.getDoc.mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(snapshot({ character: { name: 'Third account' } }));
    backend.signInWithEmailAndPassword.mockResolvedValueOnce({ user: user('second') })
      .mockResolvedValueOnce({ user: user('third') });
    let firstSignin;
    await act(async () => { firstSignin = result.current.signInWithEmail('second@example.com', 'fixture-password', 'signin'); });
    await act(async () => { await result.current.signInWithEmail('third@example.com', 'fixture-password', 'signin'); });
    await act(async () => { pending.resolve(snapshot({ character: { name: 'Second account' } })); await firstSignin; });
    expect(hydrateFromSave.mock.calls).toEqual([[{ character: { name: 'Third account' } }]]);
  });
});


it('detaches transport immediately after sign-out while preserving already captured queued writes', async () => {
  const { result, clearLocalLife } = await ready();
  const first = deferred(), provider = deferred(), anonymous = deferred();
  backend.setDoc.mockReturnValueOnce(first.promise);
  const writing = result.current.syncToCloud({ bank: 10 });
  const queued = result.current.syncToCloud({ bank: 20 });
  backend.signOut.mockImplementationOnce(async () => { await provider.promise; backend.auth.currentUser = null; });
  backend.signInAnonymously.mockReturnValueOnce(anonymous.promise);
  let signingOut;
  await act(async () => { signingOut = result.current.signOutAccount(); });
  await act(async () => provider.resolve());
  expect(clearLocalLife).toHaveBeenCalledTimes(1);
  expect(result.current.authAccount).toBeNull();
  expect((await result.current.syncToCloud({ bank: 999 })).status).toBe('skipped');
  await act(async () => { first.resolve(); await writing; await queued; });
  expect(backend.setDoc.mock.calls).toEqual([
    ['users/first/saves/currentLife', { bank: 10 }, { merge: true }],
    ['users/first/saves/currentLife', { bank: 20 }, { merge: true }],
  ]);
  await act(async () => { anonymous.resolve({ user: { ...user('new-guest'), isAnonymous: true } }); await signingOut; });
  expect(clearLocalLife).toHaveBeenCalledTimes(1);
  expect(result.current.authAccount.uid).toBe('new-guest');
});
