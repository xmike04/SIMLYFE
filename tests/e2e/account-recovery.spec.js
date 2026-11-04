import { expect, test } from '@playwright/test';
import { expectFullyInsideScrollport } from './support/scrollport.js';
import { buildLifeSave, INITIAL_EDUCATION } from '../../src/engine/lifeSave.js';
import { createFirebaseIdToken, mockFirebase } from './support/firebase.js';
import { applyFirestoreSave } from './support/firestoreWrites.js';

const guest = 'recovery-guest';
const identified = 'recovery-identified';
const freshGuest = 'recovery-new-guest';
const pathFor = uid => `users/${uid}/saves/currentLife`;
const original = {
  ...buildLifeSave({ character: { name: 'Legacy_Name 42', gender: 'Female', country: 'United States' }, age: 25,
    bank: 54321, history: [{ age: 18, text: 'A preserved education memory.' }], flags: ['existing_milestone'],
    activitiesThisYear: { vacation__Staycation: 1 }, education: { ...INITIAL_EDUCATION, highSchool: true, bachelor: true },
  }), schemaVersion: 1, narrativeMode: true,
};
const authSource = `
  const auth = { currentUser: null };
  const user = value => value && { ...value, getIdToken: async () => 'controlled-recovery-token' };
  export function getAuth() { return auth; }
  export function onAuthStateChanged(_auth, callback, error) {
    let active = true;
    globalThis.__recoveryAuth('restore').then(value => {
      if (active) { auth.currentUser = user(value); callback(auth.currentUser); }
    }).catch(reason => { if (active) error(reason); });
    return () => { active = false; };
  }
  async function change(action) {
    auth.currentUser = user(await globalThis.__recoveryAuth(action));
    return { user: auth.currentUser };
  }
  export function signInAnonymously() { return change('anonymous'); }
  export function signInWithEmailAndPassword() { return change('signin'); }
  export async function signOut() { await change('signout'); }
`;
const firestoreSource = `
  const cloud = globalThis.__recoveryCloud = { pending: [] };
  export function getFirestore() { return {}; }
  export function doc(_db, ...parts) { return parts.join('/'); }
  export function collection(_db, path) { return path; }
  export async function getDocs() { return { empty: true, docs: [] }; }
  export async function getDoc(path) {
    const result = await globalThis.__recoveryRead(path);
    if (result.fail) throw new Error('PRIVATE_RECOVERY_PROVIDER_DETAILS');
    return { exists: () => result.exists, data: () => result.data };
  }
  export async function setDoc(path, save, options) {
    await globalThis.__recoveryWriteAttempt(path);
    return new Promise(resolve => cloud.pending.push({ path, save: structuredClone(save), options, resolve }));
  }
  cloud.acknowledge = async () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No recovery write pending');
    await globalThis.__recoveryAck(write.path, write.save, write.options);
    write.resolve();
  };
`;

async function fixture(page, { documents = { [guest]: original }, hold = [guest] } = {}) {
  const docs = new Map(Object.entries(documents).map(([uid, save]) => [pathFor(uid), structuredClone(save)]));
  const pending = [];
  const reads = [];
  const writes = [];
  const authActions = [];
  const held = new Set(hold);
  let current = guest;
  const describeUser = uid => uid ? { uid, isAnonymous: uid !== identified, providerData: uid === identified ? [{ providerId: 'password' }] : [] } : null;
  const snapshot = path => ({ exists: docs.has(path), data: structuredClone(docs.get(path)) });
  await page.exposeFunction('__recoveryAuth', action => {
    authActions.push(action);
    if (action === 'signin') current = identified;
    if (action === 'signout') current = null;
    if (action === 'anonymous') current = freshGuest;
    return describeUser(current);
  });
  await page.exposeFunction('__recoveryRead', path => {
    reads.push(path);
    if (!held.has(path.split('/')[1])) return snapshot(path);
    return new Promise(resolve => pending.push({ path, resolve }));
  });
  await page.exposeFunction('__recoveryWriteAttempt', path => writes.push(path));
  await page.exposeFunction('__recoveryAck', (path, save, options) => {
    docs.set(path, applyFirestoreSave(docs.get(path), save, options));
  });
  const network = await mockFirebase(page, createFirebaseIdToken(), { firestoreSource, authSource });
  const blocked = [];
  // This fixture permits only local modules/assets. Every external request is
  // counted and blocked, including AI, SDK backend and font requests.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.fallback();
    blocked.push(url.origin);
    await route.fulfill({ status: 403, body: 'Controlled offline recovery fixture' });
  });
  await page.goto('/');
  return {
    docs, reads, writes, authActions,
    async settle(uid, fail = false) {
      await expect.poll(() => pending.filter(read => read.path === pathFor(uid)).length).toBe(1);
      const index = pending.findIndex(read => read.path === pathFor(uid));
      const read = pending.splice(index, 1)[0];
      read.resolve(fail ? { fail: true } : snapshot(read.path));
    },
    release(uid) { held.delete(uid); },
    clean(expectedWrites = []) {
      expect(writes).toEqual(expectedWrites);
      expect(network.filter(request => ['identity', 'firestore'].includes(request.type))).toHaveLength(0);
      expect(blocked.filter(origin => !origin.includes('fonts.googleapis.com') && !origin.includes('fonts.gstatic.com'))).toEqual([]);
    },
  };
}
const loading = page => page.getByRole('status', { name: 'Saved life loading' });
const failed = page => page.getByRole('alert', { name: 'Saved life load failed' });
async function dismissSplash(page) {
  await page.getByRole('button', { name: 'Begin Your Life', exact: true }).click();
}
async function recoveryEvidence(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page.getByRole('button').all()) {
    await control.scrollIntoViewIfNeeded();
    await expectFullyInsideScrollport(control);
  }
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}
async function expectUnread(page) {
  await expect(page.getByRole('heading', { name: 'Start a Life', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Start Life|Live Again|\+ Age/ })).toHaveCount(0);
  await expect(page.getByText('PRIVATE_RECOVERY_PROVIDER_DETAILS')).toHaveCount(0);
}
async function signIn(page) {
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByPlaceholder('you@example.com').fill('recovery@example.com');
  await page.getByPlaceholder('Password (6+ characters)').fill('controlled-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('boot stays unread across repeated failures, then retry restores existing continuity and education without writes', async ({ page }, testInfo) => {
  const f = await fixture(page);
  const bytes = JSON.stringify(f.docs.get(pathFor(guest)));
  await dismissSplash(page);
  await expect(loading(page)).toHaveText('Loading your saved life…');
  await expectUnread(page);
  await recoveryEvidence(page, testInfo, 'boot-pending');
  for (let attempt = 0; attempt < 2; attempt++) {
    await f.settle(guest, true);
    await expect(failed(page)).toHaveText('We couldn’t load your saved life. It hasn’t been replaced. Try again.');
    await expectUnread(page);
    await recoveryEvidence(page, testInfo, `boot-failed-${attempt}`);
    const retry = page.getByRole('button', { name: 'Try again', exact: true });
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(loading(page)).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(JSON.stringify(f.docs.get(pathFor(guest)))).toBe(bytes);
  }
  await f.settle(guest);
  await expect(page.getByRole('heading', { name: original.character.name, exact: true })).toBeVisible();
  await expect(page.getByText('A preserved education memory.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Activities/ }).click();
  await page.getByRole('button', { name: /Vacation/ }).click();
  await expect(page.getByRole('button', { name: /^Staycation/ })).toBeDisabled();
  await page.getByRole('button', { name: '×', exact: true }).click();
  await page.getByRole('button', { name: /Job/ }).click();
  await page.getByRole('button', { name: /Education/ }).click();
  await expect(page.getByText(/✅.*HS Diploma.*Bachelor/)).toBeVisible();
  expect(f.docs.get(pathFor(guest)).education.bachelor).toBe(true);
  expect(f.reads).toEqual(Array(3).fill(pathFor(guest)));
  expect(f.authActions).toEqual(['restore']);
  expect(JSON.stringify(f.docs.get(pathFor(guest)))).toBe(bytes);
  f.clean();
});

test('confirmed missing permits one newborn replacement, with reload reading only the ACK', async ({ page }, testInfo) => {
  const f = await fixture(page, { documents: {} });
  await dismissSplash(page);
  await expect(loading(page)).toBeVisible();
  await expectUnread(page);
  await f.settle(guest);
  await page.getByLabel('First and Last Name').fill('Recovery Newborn');
  await page.getByRole('button', { name: 'Start Life', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recovery Newborn', exact: true })).toBeVisible();
  await expect.poll(() => f.writes.length).toBe(1);
  expect(f.docs.has(pathFor(guest))).toBe(false);
  await page.evaluate(() => globalThis.__recoveryCloud.acknowledge());
  expect(f.docs.get(pathFor(guest))).toMatchObject({ age: 0, currentEvent: null, activitiesThisYear: {}, flags: [] });
  f.release(guest);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Recovery Newborn', exact: true })).toBeVisible();
  await recoveryEvidence(page, testInfo, 'newborn-ack-reloaded');
  expect(f.writes).toEqual([pathFor(guest)]);
  f.clean([pathFor(guest)]);
});

test('explicit account switch fails safely, retries its destination, then signout waits for the new guest read', async ({ page }, testInfo) => {
  const second = { ...original, character: { ...original.character, name: 'Account Recovery Player' } };
  const f = await fixture(page, { documents: { [guest]: original, [identified]: second }, hold: [identified, freshGuest] });
  await expect(page.getByRole('heading', { name: original.character.name, exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('simlyfe_splash'))).toBeNull();
  const bytes = JSON.stringify([...f.docs]);
  await signIn(page);
  await expect(loading(page)).toBeVisible();
  await expectUnread(page);
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await recoveryEvidence(page, testInfo, 'switch-pending');
  await f.settle(identified, true);
  await expect(failed(page)).toBeVisible();
  await recoveryEvidence(page, testInfo, 'switch-failed');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await f.settle(identified);
  await expect(page.getByRole('heading', { name: second.character.name, exact: true })).toBeVisible();
  // Reload the same identified account into a pending read; signout remains an
  // escape even while getDoc is deferred and never modifies either old save.
  await page.reload();
  await dismissSplash(page);
  await expect(loading(page)).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.poll(() => f.reads.at(-1)).toBe(pathFor(freshGuest));
  await expect(loading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await expectUnread(page);
  await recoveryEvidence(page, testInfo, 'signout-new-guest-pending');
  await f.settle(freshGuest);
  await expect(page.getByRole('heading', { name: 'Start a Life', exact: true })).toBeVisible();
  await f.settle(identified, true); // late old failure cannot take over new readiness
  await expect(page.getByRole('heading', { name: 'Start a Life', exact: true })).toBeVisible();
  expect(JSON.stringify([...f.docs])).toBe(bytes);
  expect(f.authActions.filter(action => action === 'anonymous')).toHaveLength(1);
  f.clean();
});

test('invalid existing document refuses creation and remains byte-equivalent', async ({ page }, testInfo) => {
  const invalid = { character: null, bank: 999999 };
  const f = await fixture(page, { documents: { [guest]: invalid }, hold: [] });
  await dismissSplash(page);
  await expect(failed(page)).toBeVisible();
  await expectUnread(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(failed(page)).toBeVisible();
  expect(f.docs.get(pathFor(guest))).toEqual(invalid);
  await recoveryEvidence(page, testInfo, 'invalid-existing-refused');
  f.clean();
});

test('legitimate cleared-life record permits creation without rewriting on load', async ({ page }) => {
  const blank = buildLifeSave();
  const f = await fixture(page, { documents: { [guest]: blank }, hold: [] });
  await dismissSplash(page);
  await expect(page.getByRole('heading', { name: 'Start a Life', exact: true })).toBeVisible();
  expect(f.docs.get(pathFor(guest))).toEqual(blank);
  f.clean();
});
