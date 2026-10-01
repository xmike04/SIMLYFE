import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { contentReportPayload } from '../src/engine/cloud/supportRequests.js';

let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-simlyfe-support', firestore: { host: '127.0.0.1', port: 8089, rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });
const payload = () => ({ ...contentReportPayload({ description: 'Fixture AI event', choices: [{ text: 'Continue' }], meta: { requestId: 'fixture-request' } }, 'offensive'), createdAt: serverTimestamp() });
const ref = (db, uid = 'owner', id = 'event-fixture-request') => doc(db, 'users', uid, 'supportRequests', id);
test('owner can create and get an immutable report', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertSucceeds(setDoc(ref(db), payload())); await assertSucceeds(getDoc(ref(db)));
  await assertFails(setDoc(ref(db), payload())); await assertFails(deleteDoc(ref(db)));
});
test('foreign and unsigned identities cannot create or read a request', async () => {
  const foreign = env.authenticatedContext('other').firestore(), unsigned = env.unauthenticatedContext().firestore();
  for (const db of [foreign, unsigned]) { await assertFails(setDoc(ref(db), payload())); await assertFails(getDoc(ref(db))); }
});
test('clients cannot list the inbox even for their own account', async () => {
  const db = env.authenticatedContext('owner').firestore();
  await assertFails(getDocs(collection(db, 'users', 'owner', 'supportRequests')));
});
test('deletion requests are bound to one owner document and contain no life data', async () => {
  const db = env.authenticatedContext('owner').firestore();
  const deletion = { kind: 'account_deletion', reason: 'account_deletion', requestId: '', description: '', choiceTexts: [], createdAt: serverTimestamp() };
  await assertSucceeds(setDoc(ref(db, 'owner', 'account-deletion'), deletion));
  await assertFails(setDoc(ref(db, 'owner', 'another-deletion'), deletion));
});
test('forged timestamps, unknown fields and oversized event text are denied', async () => {
  const db = env.authenticatedContext('owner').firestore();
  for (const patch of [{ createdAt: Timestamp.fromMillis(1) }, { token: 'not-allowed' }, { description: 'x'.repeat(4097) }, { choiceTexts: ['x'.repeat(301)] }, { choiceTexts: [0] }, { reason: 'unknown' }, { requestId: 'other' }]) {
    await assertFails(setDoc(ref(db), { ...payload(), ...patch }));
  }
});
