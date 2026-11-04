import { expect, test } from '@playwright/test';
import { buildLifeSave, INITIAL_STATS } from '../../src/engine/lifeSave.js';
import { createFirebaseIdToken, mockFirebase } from './support/firebase.js';
import { applyFirestoreSave } from './support/firestoreWrites.js';
import { expectFullyInsideScrollport } from './support/scrollport.js';

const MEMORY = 'A text-only memory from an older life save.';
const event = {
  version: 1, id: 'saved-offer', age: 30, source: 'annual',
  description: 'A neighbor offers you a small paid project.',
  choices: [{ text: 'Accept the paid project', effects: { bank: 250, flags: ['project_done'] } }, { text: 'Decline the paid project', effects: {} }],
};
const adult = buildLifeSave({
  character: { name: 'Jordan Continuity', gender: 'Female', country: 'United States', city: null },
  age: 30, bank: 20000, stats: { ...INITIAL_STATS, health: 70, happiness: 60 },
  history: [{ age: 20, text: MEMORY }], flags: ['legacy_memory'],
});
// Only acknowledge() advances the Node-owned document. Reload discards page-local
// writes and rehydrates the last acknowledged document, including across failures.
const firestoreSource = `
  const cloud = globalThis.__continuityCloud = { pending: [], writes: 0 };
  export function getFirestore() { return {}; }
  export function doc(_db, ...parts) { return parts.join('/'); }
  export function collection(_db, path) { return path; }
  export async function getDoc() {
    const save = await globalThis.__readAcknowledgedContinuitySave();
    return { exists: () => save !== null, data: () => save };
  }
  export async function getDocs() { return { empty: true, docs: [] }; }
  export function setDoc(path, save, options) {
    cloud.writes += 1;
    return new Promise((resolve, reject) => cloud.pending.push({ path, save: structuredClone(save), options, resolve, reject }));
  }
  cloud.acknowledge = async () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending continuity write');
    await globalThis.__commitAcknowledgedContinuitySave(write.save, write.options);
    write.resolve();
  };
  cloud.fail = () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending continuity write');
    write.reject(new Error('expected private continuity fixture failure'));
  };
`;
async function bootContinuity(page, fields = {}) {
  let acknowledged = structuredClone({ ...adult, schemaVersion: 1, narrativeMode: true, ...fields });
  // undefined intentionally represents absent fields in an older replacement.
  for (const key of Object.keys(acknowledged)) if (acknowledged[key] === undefined) delete acknowledged[key];
  await page.exposeFunction('__readAcknowledgedContinuitySave', () => structuredClone(acknowledged));
  await page.exposeFunction('__commitAcknowledgedContinuitySave', (save, options) => {
    acknowledged = applyFirestoreSave(acknowledged, save, options);
  });
  const firebaseRequests = await mockFirebase(page, createFirebaseIdToken(), { firestoreSource });
  const aiRequests = [];
  await page.route('https://playwright.supabase.co/**', async route => {
    aiRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      event: { description: `Controlled opportunity ${aiRequests.length}.`, choices: [{ text: 'Continue with the opportunity', effects: {} }] },
      meta: { requestId: `fixture-${aiRequests.length}`, model: 'controlled-fixture', latencyMs: 1 },
    }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jordan Continuity' })).toBeVisible();
  return { aiRequests, firebaseRequests };
}
const acknowledgedSave = page => page.evaluate(() => globalThis.__readAcknowledgedContinuitySave());
const status = page => page.getByRole('status', { name: 'Progress save status' });
const offer = page => page.getByRole('heading', { name: event.description, exact: true });
async function acknowledge(page) {
  await expect.poll(() => page.evaluate(() => globalThis.__continuityCloud.pending.length)).toBe(1);
  await page.evaluate(() => globalThis.__continuityCloud.acknowledge());
}
async function evidence(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true, animations: 'disabled' });
}
async function openStaycation(page) {
  await page.getByRole('button', { name: /Activities/ }).click();
  await page.getByRole('button', { name: /Vacation/ }).click();
  return page.getByRole('button', { name: /^Staycation/ });
}
function noNetworkGeneration(fixture) {
  expect(fixture.aiRequests).toHaveLength(0);
  expect(fixture.firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
}

async function expectInsideScrollport(locator) {
  await locator.scrollIntoViewIfNeeded();
  return expectFullyInsideScrollport(locator);
}

test('A: acknowledged ordinary choice restores unchanged and resolves once', async ({ page }, testInfo) => {
  const fixture = await bootContinuity(page, { currentEvent: event });
  await page.reload();
  await expect(offer(page)).toBeVisible();
  await expect(page.getByRole('button', { name: event.choices[0].text, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: event.choices[1].text, exact: true })).toBeVisible();
  for (const name of [/Job/, /Assets/, /Relationships/, /Activities/, /^\+ Age$/]) await expect(page.getByRole('button', { name })).toBeDisabled();
  await evidence(page, testInfo, 'restored-choice');
  const accept = page.getByRole('button', { name: event.choices[0].text, exact: true });
  await accept.focus();
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Saving choice outcome…');
  expect((await acknowledgedSave(page)).bank).toBe(20000);
  await acknowledge(page);
  await expect(status(page)).toHaveText('Choice outcome saved to the cloud.');
  await evidence(page, testInfo, 'acknowledged-choice');
  await page.reload();
  await expect(offer(page)).toHaveCount(0);
  const saved = await acknowledgedSave(page);
  expect(saved.bank).toBe(20250);
  expect(saved).toMatchObject({ schemaVersion: 1, narrativeMode: true });
  expect(saved.flags).toEqual(['legacy_memory', 'project_done']);
  expect(saved.currentEvent).toBeNull();
  const line = `Event: ${event.description} -> You chose: ${event.choices[0].text}`;
  expect(saved.history.filter(entry => entry.text === line)).toHaveLength(1);
  await expect(page.getByText(line, { exact: true })).toHaveCount(1);
  await expect(page.getByText(MEMORY, { exact: true })).toBeVisible();
  noNetworkGeneration(fixture);
});

test('B: Staycation effects and allowance survive reload and reset with one annual offer', async ({ page }, testInfo) => {
  const fixture = await bootContinuity(page);
  await (await openStaycation(page)).click();
  await expect(status(page)).toContainText('Saving');
  expect((await acknowledgedSave(page)).activitiesThisYear).toEqual({});
  await acknowledge(page); // base effects/counter, before the queued offer
  await expect.poll(async () => (await acknowledgedSave(page)).activitiesThisYear).toEqual({ vacation__Staycation: 1 });
  let saved = await acknowledgedSave(page);
  expect(saved.stats.happiness).toBe(68);
  expect(saved.stats.health).toBe(74);
  expect(saved.bank).toBe(20000);
  expect(saved.currentEvent).toBeNull();
  await acknowledge(page); // complete offer
  await expect(status(page)).toContainText('saved to the cloud');
  await page.getByRole('button', { name: 'Continue with the opportunity', exact: true }).click();
  await acknowledge(page);
  await page.reload();
  await expect(await openStaycation(page)).toBeDisabled();
  await evidence(page, testInfo, 'staycation-retained');
  await page.getByRole('button', { name: '×', exact: true }).click();
  await page.getByRole('button', { name: /^\+ Age$/ }).click();
  await expect(page.getByRole('heading', { name: 'Controlled opportunity 2.' })).toBeVisible();
  await acknowledge(page);
  saved = await acknowledgedSave(page);
  expect(saved.age).toBe(31);
  expect(saved.activitiesThisYear).toEqual({});
  expect(fixture.aiRequests).toHaveLength(2);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Controlled opportunity 2.' })).toBeVisible();
  expect(fixture.aiRequests).toHaveLength(2);
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(0);
  await page.getByRole('button', { name: 'Continue with the opportunity', exact: true }).click();
  await acknowledge(page);
  await expect(await openStaycation(page)).toBeEnabled();
  expect(fixture.firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
});

test('C: custody negotiation restores its fee, support and legal outcome once', async ({ page }, testInfo) => {
  const custody = { ...event, id: 'custody-offer', source: 'custody', description: 'Decide custody with Alex.', isCustodyBattle: true, exId: 'ex', childIds: ['child'], choices: [
    { text: 'Fight for custody', effects: { bank: -10000 }, custodyOutcome: 'fight' },
    { text: 'Negotiate joint custody', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
    { text: 'Surrender custody', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
  ] };
  const fixture = await bootContinuity(page, { currentEvent: custody, relationships: [
    { id: 'ex', name: 'Alex', type: 'Ex', status: 'ex', age: 30, relation: 30, isAlive: true },
    { id: 'child', name: 'Sam', type: 'Child', status: 'family', age: 7, relation: 70, isAlive: true },
  ] });
  await page.reload();
  await page.getByRole('button', { name: 'Negotiate joint custody', exact: true }).click();
  await expect(status(page)).toContainText('Saving');
  await acknowledge(page);
  await page.reload();
  const saved = await acknowledgedSave(page);
  expect(saved.bank).toBe(17000);
  expect(saved.relationships.find(rel => rel.id === 'ex').childSupport).toBe(2400);
  expect(saved.history.filter(entry => entry.text.startsWith('Legal:'))).toHaveLength(1);
  expect(saved.history.filter(entry => entry.text.startsWith('Event:'))).toHaveLength(1);
  expect(saved.currentEvent).toBeNull();
  await expect(page.getByText('Legal: Joint custody agreed. You pay $2,400/yr in child support.', { exact: true })).toBeVisible();
  await evidence(page, testInfo, 'custody-negotiated');
  noNetworkGeneration(fixture);
});

test('D: failed resolution keeps session outcome while reload restores the acknowledged offer; pending stays pending', async ({ page }, testInfo) => {
  const fixture = await bootContinuity(page, { currentEvent: event });
  await page.getByRole('button', { name: event.choices[0].text, exact: true }).click();
  await expect(status(page)).toHaveText('Saving choice outcome…');
  await expect(page.getByText(/Event: A neighbor offers/)).toHaveCount(1);
  await expect(page.getByText('$20,250', { exact: true })).toBeVisible();
  await page.evaluate(() => globalThis.__continuityCloud.fail());
  await expect(status(page)).toContainText('saving failed. Reloading may restore an older save.');
  await expect(status(page)).not.toContainText('saved to the cloud');
  await expect(page.getByText('expected private continuity fixture failure', { exact: true })).toHaveCount(0);
  await evidence(page, testInfo, 'resolution-failed');
  expect((await acknowledgedSave(page)).bank).toBe(20000);
  await page.reload();
  await expect(offer(page)).toBeVisible();
  await page.getByRole('button', { name: event.choices[0].text, exact: true }).click();
  await expect(status(page)).toHaveText('Saving choice outcome…');
  await evidence(page, testInfo, 'resolution-pending');
  expect(await page.evaluate(() => globalThis.__continuityCloud.pending.length)).toBe(1);
  await expect(status(page)).not.toContainText('saved to the cloud');
  await page.reload();
  await expect(offer(page)).toBeVisible();
  await expect(page.getByText('$20,000', { exact: true })).toBeVisible();
  expect((await acknowledgedSave(page)).bank).toBe(20000);
  noNetworkGeneration(fixture);
});

for (const mode of ['malformed', 'unsupported', 'older-writer-merge']) {
  test(`E: ${mode} requires explicit no-effect recovery`, async ({ page }, testInfo) => {
    const fields = mode === 'malformed' ? { currentEvent: { ...event, choices: [{ text: 'Unsafe', effects: { bank: 999999 } }] } }
      : mode === 'unsupported' ? { currentEvent: { ...event, version: 99 } }
        : { age: 31, currentEvent: event, activitiesThisYear: { vacation__Staycation: 1 } };
    const fixture = await bootContinuity(page, fields);
    const recovery = page.getByRole('heading', { name: 'This saved choice is unavailable. Clearing it applies no outcome and keeps your loaded life.', exact: true });
    await expect(recovery).toBeVisible();
    expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(0);
    await expect(page.getByRole('button', { name: /Activities/ })).toBeDisabled();
    await evidence(page, testInfo, `recovery-${mode}`);
    const clear = page.getByRole('button', { name: 'Clear unavailable choice', exact: true });
    await clear.focus();
    await page.keyboard.press('Enter');
    await acknowledge(page);
    await page.reload();
    await expect(recovery).toHaveCount(0);
    const saved = await acknowledgedSave(page);
    expect(saved.bank).toBe(20000);
    expect(saved.stats).toEqual(adult.stats);
    expect(saved.flags).toEqual(['legacy_memory']);
    expect(saved.currentEvent).toBeNull();
    expect(saved.history.at(-1).text).toBe('Recovery: Cleared an unavailable saved choice without applying an outcome.');
    if (mode === 'older-writer-merge') expect(saved.activitiesThisYear).toEqual({ vacation__Staycation: 1 });
    noNetworkGeneration(fixture);
  });
}

test('E: unversioned legacy offer wraps without inference and missing fields become defaults', async ({ page }) => {
  const legacy = { description: event.description, choices: event.choices };
  const fixture = await bootContinuity(page, { flags: undefined, activitiesThisYear: undefined, currentEvent: legacy });
  await expect(offer(page)).toBeVisible();
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(0);
  await page.getByRole('button', { name: event.choices[1].text, exact: true }).click();
  await acknowledge(page);
  const saved = await acknowledgedSave(page);
  expect(saved.flags).toEqual([]);
  expect(saved.activitiesThisYear).toEqual({});
  expect(saved.history[0]).toEqual({ age: 20, text: MEMORY });

  noNetworkGeneration(fixture);
});

test('E: older replacement missing continuity fields loads compatible defaults without writes', async ({ page }) => {
  const fixture = await bootContinuity(page, { flags: undefined, activitiesThisYear: undefined, currentEvent: undefined });
  await page.reload();
  await expect(page.getByText(MEMORY, { exact: true })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
  await expect(status(page)).toHaveCount(0);
  await expect(await openStaycation(page)).toBeEnabled();
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(0);
  const saved = await acknowledgedSave(page);
  expect(saved).not.toHaveProperty('flags');
  expect(saved).not.toHaveProperty('activitiesThisYear');
  expect(saved).not.toHaveProperty('currentEvent');
  noNetworkGeneration(fixture);
});

test('F: actual annual death exposes pending, failed and acknowledged year saves across reload', async ({ page }, testInfo) => {
  const fixture = await bootContinuity(page, {
    age: 99, isDead: false, currentEvent: null, bank: 0,
    properties: [], belongings: [], relationships: [], pets: [], career: null,
    activitiesThisYear: { vacation__Staycation: 1 },
  });
  await page.getByRole('button', { name: /^\+ Age$/ }).click();
  await expect(page.getByRole('heading', { name: 'The End.' })).toBeVisible();
  await expect(page.getByText('You died at age 100.', { exact: true })).toBeVisible();
  await expect(status(page)).toHaveCount(1);
  await expect(status(page)).toHaveText('Saving year progress…');
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(1);
  expect(await acknowledgedSave(page)).toMatchObject({ age: 99, isDead: false });
  await page.evaluate(() => globalThis.__continuityCloud.fail());
  await expect(status(page)).toHaveText('Year progress remains in this session, but saving failed. Reloading may restore an older save.');
  await evidence(page, testInfo, 'annual-death-failed');

  await page.reload();
  await expect(page.getByRole('button', { name: /^\+ Age$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The End.' })).toHaveCount(0);
  await expect(status(page)).toHaveCount(0);
  expect(await acknowledgedSave(page)).toMatchObject({ age: 99, isDead: false, activitiesThisYear: { vacation__Staycation: 1 } });
  await expect(page.getByText(MEMORY, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^\+ Age$/ }).click();
  await expect(status(page)).toHaveText('Saving year progress…');
  await acknowledge(page);
  await expect(status(page)).toHaveCount(1);
  await expect(status(page)).toHaveText('Year progress saved to the cloud.');
  const saved = await acknowledgedSave(page);
  expect(saved).toMatchObject({ age: 100, isDead: true, currentEvent: null, activitiesThisYear: {} });
  expect(saved.history.at(-1)).toEqual({ age: 100, text: 'You passed away peacefully at age 100.' });
  expect(saved.history.filter(entry => entry.text === 'You passed away peacefully at age 100.')).toHaveLength(1);
  await evidence(page, testInfo, 'annual-death-saved');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The End.' })).toBeVisible();
  await expect(page.getByText('You died at age 100.', { exact: true })).toBeVisible();
  await expect(status(page)).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(0);
  noNetworkGeneration(fixture);
});

for (const childCount of [0, 3]) {
  test(`F: rich annual-death summary with ${childCount} child bequests keeps the failed receipt and Live Again reachable`, async ({ page }, testInfo) => {
    const fixture = await bootContinuity(page, {
      age: 99, bank: 500000,
      career: { title: 'Software Engineer', salary: 100000 },
      properties: [{ currentValue: 100000 }],
      belongings: [{ subType: 'stock', currentValue: 50000 }],
      will: { allocations: [], draftedAtAge: 99 },
      relationships: Array.from({ length: childCount }, (_, i) => ({
        id: `child-${i}`, name: `Child ${i + 1}`, type: 'Child', status: 'family', age: 30, relation: 70, isAlive: true,
      })),
    });
    await page.getByRole('button', { name: /^\+ Age$/ }).click();
    await expect(page.getByRole('heading', { name: 'The End.' })).toBeVisible();
    await expect(status(page)).toHaveText('Saving year progress…');
    await expect.poll(() => page.evaluate(() => globalThis.__continuityCloud.pending.length)).toBe(1);
    await page.evaluate(() => globalThis.__continuityCloud.fail());
    await expect(status(page)).toHaveCount(1);
    await expect(status(page)).toHaveText('Year progress remains in this session, but saving failed. Reloading may restore an older save.');
    const receipt = await expectInsideScrollport(status(page));
    await evidence(page, testInfo, `rich-estate-${childCount}-failed-receipt`);
    const liveAgain = page.getByRole('button', { name: 'Live Again', exact: true });
    const restart = await expectInsideScrollport(liveAgain);
    await testInfo.attach('rich-estate-reachable-bounds', { body: JSON.stringify({ receipt, restart }, null, 2), contentType: 'application/json' });
    await evidence(page, testInfo, `rich-estate-${childCount}-live-again`);
    await liveAgain.click();
    const enter = page.getByRole('button', { name: 'Begin Your Life', exact: true });
    if (await enter.count()) await enter.click();
    await expect(page.getByRole('heading', { name: 'Start a Life', exact: true })).toBeVisible();
    await expect(status(page)).toHaveCount(0);
    noNetworkGeneration(fixture);
  });
}

test('F: actual Live Again and newborn replacement leave no prior continuity or history after reload', async ({ page }, testInfo) => {
  const fixture = await bootContinuity(page, { isDead: true, currentEvent: event, activitiesThisYear: { vacation__Staycation: 1 } });
  await page.getByRole('button', { name: 'Live Again', exact: true }).click();
  const enter = page.getByRole('button', { name: 'Begin Your Life', exact: true });
  if (await enter.count()) await enter.click();
  await acknowledge(page);
  expect(await acknowledgedSave(page)).toMatchObject({ character: null, flags: [], activitiesThisYear: {}, currentEvent: null, history: [] });
  expect(await acknowledgedSave(page)).not.toHaveProperty('schemaVersion');
  expect(await acknowledgedSave(page)).not.toHaveProperty('narrativeMode');
  await page.getByLabel('First and Last Name').fill('Newborn Continuity');
  await page.getByRole('button', { name: 'Start Life', exact: true }).click();
  await acknowledge(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Newborn Continuity' })).toBeVisible();
  const saved = await acknowledgedSave(page);
  expect(saved).toMatchObject({ age: 0, flags: [], activitiesThisYear: {}, currentEvent: null });
  expect(saved).not.toHaveProperty('schemaVersion');
  expect(saved).not.toHaveProperty('narrativeMode');
  expect(saved.history.some(entry => entry.text === MEMORY || entry.text.includes(event.description))).toBe(false);
  await expect(page.getByText(MEMORY, { exact: true })).toHaveCount(0);
  await evidence(page, testInfo, 'newborn-reloaded');
  noNetworkGeneration(fixture);
});

test('long valid legacy offer stays bounded and final choice is reachable by scrolling', async ({ page }, testInfo) => {
  const longDescription = ('A remembered moment deserves careful consideration. '.repeat(65) + 'x'.repeat(700)).slice(0, 4096);
  const finalLabel = 'Choose the final saved option ' + 'z'.repeat(130);
  const fixture = await bootContinuity(page, { currentEvent: { description: longDescription, choices: [
    { text: 'Keep considering the saved moment', effects: {} },
    { text: 'Take another path through the moment', effects: {} },
    { text: finalLabel, effects: { bank: 20 } },
  ] } });
  const heading = page.getByRole('heading', { name: longDescription, exact: true });
  await expect(heading).toBeVisible();
  const panel = heading.locator('..');
  const bounds = await panel.boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await evidence(page, testInfo, 'long-offer-top');
  const final = page.getByRole('button', { name: finalLabel, exact: true });
  await final.focus();
  await final.scrollIntoViewIfNeeded();
  await expect(final).toBeInViewport();
  expect(await panel.evaluate(el => el.scrollTop > 0)).toBe(true);
  await evidence(page, testInfo, 'long-offer-controls');
  await page.keyboard.press('Enter');
  await acknowledge(page);
  await page.reload();
  await expect(heading).toHaveCount(0);
  const saved = await acknowledgedSave(page);
  expect(saved.bank).toBe(20020);
  expect(saved.currentEvent).toBeNull();
  expect(saved.history.filter(entry => entry.text.includes(finalLabel))).toHaveLength(1);
  noNetworkGeneration(fixture);
});

test('failed custody clear and activity base write cannot contaminate the next acknowledged ordinary offer', async ({ page }, testInfo) => {
  const custody = { ...event, id: 'old-custody', source: 'custody', description: 'A saved custody hearing.', isCustodyBattle: true, exId: 'ex', childIds: ['child'],
    meta: { requestId: 'old-custody-meta', model: 'old-model', latencyMs: 1, usage: { inputTokens: 12 } },
    choices: [
      { text: 'Fight for custody', effects: { bank: -10000 }, custodyOutcome: 'fight' },
      { text: 'Negotiate joint custody', effects: { bank: -3000 }, custodyOutcome: 'negotiate' },
      { text: 'Surrender custody', effects: { happiness: -20 }, custodyOutcome: 'surrender' },
    ],
  };
  const fixture = await bootContinuity(page, { currentEvent: custody, relationships: [
    { id: 'ex', name: 'Alex', type: 'Ex', status: 'ex', age: 30, relation: 30, isAlive: true },
    { id: 'child', name: 'Sam', type: 'Child', status: 'family', age: 7, relation: 70, isAlive: true },
  ] });
  await page.getByRole('button', { name: 'Negotiate joint custody', exact: true }).click();
  await page.evaluate(() => globalThis.__continuityCloud.fail());
  await expect(status(page)).toContainText('saving failed');
  expect((await acknowledgedSave(page)).currentEvent).toEqual(custody);
  await (await openStaycation(page)).click();
  await expect.poll(() => page.evaluate(() => globalThis.__continuityCloud.pending.length)).toBe(1);
  await page.evaluate(() => globalThis.__continuityCloud.fail()); // avoid a successful intermediate null clear
  await expect.poll(() => page.evaluate(() => globalThis.__continuityCloud.pending.length)).toBe(1);
  const offered = await page.evaluate(() => globalThis.__continuityCloud.pending[0].save.currentEvent);
  expect(offered.source).toBe('activity');
  await acknowledge(page);
  await expect(status(page)).toContainText('saved to the cloud');
  const saved = await acknowledgedSave(page);
  expect(saved.currentEvent).toEqual(offered);
  expect(saved).toMatchObject({ bank: 17000, schemaVersion: 1, narrativeMode: true });
  expect(await page.evaluate(() => globalThis.__continuityCloud.writes)).toBe(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Controlled opportunity 1.', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear unavailable choice', exact: true })).toHaveCount(0);
  expect((await acknowledgedSave(page)).currentEvent).toEqual(offered);
  expect(fixture.aiRequests).toHaveLength(1);
  expect(fixture.firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
  await evidence(page, testInfo, 'ordinary-after-rejected-custody-clear');
});
