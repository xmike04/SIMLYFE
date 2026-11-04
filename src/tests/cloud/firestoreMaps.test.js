// @vitest-environment node
import { createServer } from 'node:http';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getFirestore, setDoc, terminate } from 'firebase/firestore/lite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyFirestoreSave } from '../../../tests/e2e/support/firestoreWrites.js';

// This is a narrow REST commit fixture, not Google's backend or an emulator.
// Masks below come from the installed public SDK. Interpret only simple paths
// needed here, according to the documented REST updateMask contract.
function applyWireWrite(prior, write) {
  const incoming = write.update.fields;
  if (!write.updateMask) return structuredClone(incoming);
  const next = structuredClone(prior);
  for (const path of write.updateMask.fieldPaths) {
    expect(path).toMatch(/^[A-Za-z_][A-Za-z_0-9]*(\.[A-Za-z_][A-Za-z_0-9]*)*$/);
    const segments = path.split('.');
    let target = next, source = incoming;
    for (const segment of segments.slice(0, -1)) {
      target = (target[segment] ??= { mapValue: { fields: {} } }).mapValue.fields;
      source = source[segment]?.mapValue?.fields ?? {};
    }
    const key = segments.at(-1);
    if (Object.hasOwn(source, key)) target[key] = structuredClone(source[key]);
    else delete target[key];
  }
  return next;
}
function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decode(item)]));
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  if (Object.hasOwn(value, 'integerValue')) return Number(value.integerValue);
  if (Object.hasOwn(value, 'nullValue')) return null;
  return value.stringValue ?? value.booleanValue ?? value.doubleValue;
}
const ordinary = { version: 1, id: 'new-offer', age: 30, source: 'annual', description: 'An ordinary opportunity', choices: [{ text: 'Continue', effects: {} }] };

describe('installed public Firestore SDK masks against loopback commit fixture', () => {
  let server, app, db, ref, remote, rejected, requests;
  const read = () => decode({ mapValue: { fields: remote } });
  const mask = () => requests.at(-1).updateMask?.fieldPaths;
  async function write(payload, options, fail = false) {
    const before = read();
    rejected = fail;
    if (fail) {
      await expect(setDoc(ref, payload, options)).rejects.toMatchObject({ code: 'permission-denied' });
      expect(read()).toEqual(before);
    } else {
      await setDoc(ref, payload, options);
      // Both browser fixtures use this helper; check its semantics independently
      // against the SDK's real wire mask, including selected fields and replace.
      expect(read()).toEqual(applyFirestoreSave(before, payload, options));
    }
  }
  beforeEach(async () => {
    remote = {}; rejected = false; requests = [];
    server = createServer(async (request, response) => {
      expect(request.socket.localAddress).toBe('127.0.0.1');
      expect(request.url).toBe('/v1/projects/demo-simlyfe-masks/databases/(default)/documents:commit');
      let body = '';
      for await (const part of request) body += part;
      const commit = JSON.parse(body);
      expect(commit.writes).toHaveLength(1);
      requests.push(commit.writes[0]);
      response.setHeader('content-type', 'application/json');
      if (rejected) {
        rejected = false;
        response.writeHead(403);
        response.end(JSON.stringify({ error: { code: 403, status: 'PERMISSION_DENIED', message: 'Expected loopback fixture rejection' } }));
        return;
      }
      remote = applyWireWrite(remote, commit.writes[0]);
      response.end(JSON.stringify({ commitTime: '2026-11-04T00:00:00.000000000Z', writeResults: [{ updateTime: '2026-11-04T00:00:00.000000000Z' }] }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    app = initializeApp({ projectId: 'demo-simlyfe-masks' }, 'loopback-map-characterization');
    db = getFirestore(app);
    connectFirestoreEmulator(db, '127.0.0.1', server.address().port);
    ref = doc(db, 'users', 'fixture', 'saves', 'currentLife');
  });
  afterEach(async () => {
    if (db) await terminate(db);
    if (app) await deleteApp(app);
    if (server) await new Promise(resolve => server.close(resolve));
  });

  it('replaces counters with a parent mask after a failed reset; legacy leaf merge retains stale keys', async () => {
    await write({ activitiesThisYear: { Run: 1, Staycation: 1 }, schemaVersion: 1, narrativeMode: true });
    await write({ activitiesThisYear: {} }, { mergeFields: ['activitiesThisYear'] }, true);
    expect(mask()).toEqual(['activitiesThisYear']);
    await write({ activitiesThisYear: { Run: 1 } }, { merge: true });
    expect(mask()).toEqual(['activitiesThisYear.Run']);
    expect(read().activitiesThisYear).toEqual({ Run: 1, Staycation: 1 });
    await write({ activitiesThisYear: { Run: 1 } }, { mergeFields: ['activitiesThisYear'] });
    expect(mask()).toEqual(['activitiesThisYear']);
    expect(read()).toEqual({ activitiesThisYear: { Run: 1 }, schemaVersion: 1, narrativeMode: true });
    expect(requests).toHaveLength(4);
  });

  it('replaces custody and omitted metadata after failed null clear and a later nonempty ordinary offer', async () => {
    await write({ currentEvent: { ...ordinary, id: 'old-custody', source: 'custody', isCustodyBattle: true, exId: 'ex', childIds: ['child'], choices: [
      { text: 'Fight', effects: { bank: -10000 }, custodyOutcome: 'fight' },
      { text: 'Negotiate', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
      { text: 'Surrender', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
    ], meta: { requestId: 'old', model: 'old-model', latencyMs: 1 } }, schemaVersion: 1 });
    await write({ currentEvent: null }, { mergeFields: ['currentEvent'] }, true);
    expect(mask()).toEqual(['currentEvent']);
    await write({ currentEvent: ordinary }, { merge: true });
    expect(mask()).toEqual(['currentEvent.age', 'currentEvent.choices', 'currentEvent.description', 'currentEvent.id', 'currentEvent.source', 'currentEvent.version']);
    expect(read().currentEvent).toMatchObject({ isCustodyBattle: true, exId: 'ex', childIds: ['child'], meta: { requestId: 'old', model: 'old-model', latencyMs: 1 } });
    await write({ currentEvent: ordinary }, { mergeFields: ['currentEvent'] });
    expect(mask()).toEqual(['currentEvent']);
    expect(read()).toEqual({ currentEvent: ordinary, schemaVersion: 1 });
    expect(requests).toHaveLength(4);
  });

  it('clears empty maps/null and replaces arrays/scalars under both supported option forms', async () => {
    await write({ activitiesThisYear: { Run: 1 }, currentEvent: ordinary, flags: ['old'], bank: 1, schemaVersion: 1 });
    await write({ activitiesThisYear: {}, currentEvent: null, flags: ['new'], bank: 50 }, { merge: true });
    expect(mask()).toEqual(['activitiesThisYear', 'bank', 'currentEvent', 'flags']);
    expect(read()).toEqual({ activitiesThisYear: {}, currentEvent: null, flags: ['new'], bank: 50, schemaVersion: 1 });
    await write({ activitiesThisYear: {}, currentEvent: null }, { mergeFields: ['activitiesThisYear', 'currentEvent'] });
    expect(mask()).toEqual(['activitiesThisYear', 'currentEvent']);
  });

  it('creates missing documents with a literal top-level mask and fully replaces without options', async () => {
    const payload = { bank: 50, activitiesThisYear: { Run: 1 }, currentEvent: ordinary };
    await write(payload, { mergeFields: Object.keys(payload) });
    expect(mask()).toEqual(['activitiesThisYear', 'bank', 'currentEvent']);
    expect(read()).toEqual(payload);
    await write({ schemaVersion: 1, narrativeMode: true }, { mergeFields: ['schemaVersion', 'narrativeMode'] });
    await write({ character: null, activitiesThisYear: {}, currentEvent: null });
    expect(mask()).toBeUndefined();
    expect(read()).toEqual({ character: null, activitiesThisYear: {}, currentEvent: null });
  });

  it('applies only selected top-level fields without replacing the whole document', async () => {
    await write({ bank: 1, activitiesThisYear: { Run: 1 }, schemaVersion: 1 });
    await write({ bank: 50, activitiesThisYear: { Staycation: 1 } }, { mergeFields: ['bank'] });
    expect(mask()).toEqual(['bank']);
    expect(read()).toEqual({ bank: 50, activitiesThisYear: { Run: 1 }, schemaVersion: 1 });
  });
});

describe('narrow acknowledged-document fixture contract', () => {
  it.each([['bank.child'], ['`bank`'], [{ field: 'bank' }]])('rejects unsupported nested/escaped/object masks %j', field => {
    expect(() => applyFirestoreSave({ bank: 1 }, { bank: 50 }, { mergeFields: [field] })).toThrow('literal top-level mergeFields');
  });
  it('rejects incompatible/unknown options and absent mask fields', () => {
    expect(() => applyFirestoreSave({}, { bank: 1 }, { merge: true, mergeFields: ['bank'] })).toThrow('Unsupported');
    expect(() => applyFirestoreSave({}, { bank: 1 }, { mergeFields: ['missing'] })).toThrow('absent');
  });
});
