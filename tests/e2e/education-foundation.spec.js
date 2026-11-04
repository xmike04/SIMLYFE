import { expect, test } from '@playwright/test';
import { buildLifeSave, INITIAL_EDUCATION, INITIAL_STATS } from '../../src/engine/lifeSave.js';
import { createFirebaseIdToken, mockFirebase } from './support/firebase.js';
import { applyFirestoreSave } from './support/firestoreWrites.js';
import { expectFullyInsideScrollport } from './support/scrollport.js';

const LEGACY_MEMORY = 'An existing memory from before education decisions.';
const PRESERVED = {
  flags: ['existing_milestone'],
  activitiesThisYear: { vacation__Staycation: 1 },
  schemaVersion: 1,
  narrativeMode: true,
};
const adultLife = buildLifeSave({
  character: { name: 'Jordan Education', gender: 'Female', country: 'United States', city: null },
  age: 18,
  bank: 100000,
  stats: { ...INITIAL_STATS },
  education: { ...INITIAL_EDUCATION, highSchool: true },
  history: [{ age: 17, text: LEGACY_MEMORY }],
  flags: PRESERVED.flags,
  activitiesThisYear: PRESERVED.activitiesThisYear,
});

// Only ACK changes the Node-held document. Reload cannot read a pending write.
// Apply the captured top-level mask (or replacement) with the shared fixture.
const firestoreSource = `
  const cloud = globalThis.__educationCloud = { pending: [], writes: 0 };
  export function getFirestore() { return {}; }
  export function doc(_db, ...parts) { return parts.join('/'); }
  export function collection(_db, path) { return path; }
  export async function getDoc() {
    const save = await globalThis.__readAcknowledgedEducationSave();
    return { exists: () => save !== null, data: () => save };
  }
  export async function getDocs() { return { empty: true, docs: [] }; }
  export function setDoc(path, save, options) {
    cloud.writes += 1;
    return new Promise((resolve, reject) => {
      cloud.pending.push({ path, save: structuredClone(save), options, resolve, reject });
    });
  }
  cloud.acknowledge = async () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending cloud write');
    await globalThis.__commitAcknowledgedEducationSave(write.save, write.options);
    write.resolve();
  };
  cloud.fail = () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending cloud write');
    write.reject(new Error('private test provider failure'));
  };
`;

async function bootEducation(page, fields = {}) {
  let acknowledged = structuredClone({ ...adultLife, ...PRESERVED, ...fields });
  await page.exposeFunction('__readAcknowledgedEducationSave', () => structuredClone(acknowledged));
  await page.exposeFunction('__commitAcknowledgedEducationSave', (save, options) => {
    acknowledged = applyFirestoreSave(acknowledged, save, options);
  });
  const firebaseRequests = await mockFirebase(page, createFirebaseIdToken(), { firestoreSource });
  const aiRequests = [];
  await page.route('https://playwright.supabase.co/**', async route => {
    aiRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jordan Education' })).toBeVisible();
  return { firebaseRequests, aiRequests };
}

const acknowledgedSave = page => page.evaluate(() => globalThis.__readAcknowledgedEducationSave());
const preview = page => page.getByRole('region', { name: 'Education decision preview' });
const outcome = page => page.getByLabel('Education outcome');
const lifeHeader = page => page.getByRole('heading', { name: 'Jordan Education' }).locator('..');
const enrollments = save => save.history.filter(entry => entry.action?.type === 'education.enroll');

async function openEducation(page) {
  await page.getByRole('button', { name: /Job/ }).click();
  await page.getByRole('button', { name: /Education/ }).click();
}

function expectNoExternalCalls({ aiRequests, firebaseRequests }) {
  expect(aiRequests).toHaveLength(0);
  expect(firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
}

test('education preview and acknowledged enrollment survive reload', async ({ page }, testInfo) => {
  const requests = await bootEducation(page);
  await openEducation(page);
  await page.getByRole('button', { name: /Enroll: Bachelor's Degree/ }).click();
  await expect(preview(page).getByRole('heading', { name: 'Review Enrollment' })).toBeVisible();
  for (const text of [
    'Prerequisite: HS Diploma — met', 'Program length: 4 years',
    'Pay now: $20,000', 'Annual tuition: $20,000', 'Remaining tuition: $60,000',
    'Total tuition: $80,000', 'Balance before enrollment: $100,000',
    'Balance after enrollment: $80,000',
    'Later tuition is charged on Age clicks and may make your balance negative.',
    '3 later Age clicks to completion, projected at age 21.',
    'Projected age assumes uninterrupted annual progression in this life.',
    'Smarts: +10', 'Happiness: +3',
  ]) await expect(preview(page)).toContainText(text);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('education-preview.png'), fullPage: true, animations: 'disabled' });
  const confirm = page.getByRole('button', { name: 'Confirm enrollment', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expectFullyInsideScrollport(confirm);
  await expectFullyInsideScrollport(cancel);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('education-preview-controls.png'), fullPage: true, animations: 'disabled' });
  await cancel.click();
  expect(await page.evaluate(() => globalThis.__educationCloud.writes)).toBe(0);
  expect((await acknowledgedSave(page)).bank).toBe(100000);

  await page.getByRole('button', { name: /Enroll: Bachelor's Degree/ }).click();
  await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click();
  await expect(outcome(page)).toContainText('Saving');
  expect(await page.evaluate(() => globalThis.__educationCloud.writes)).toBe(1);
  expect((await acknowledgedSave(page)).bank).toBe(100000);
  await expect(lifeHeader(page).getByText('$80,000', { exact: true })).toBeVisible();
  await page.evaluate(() => globalThis.__educationCloud.acknowledge());
  await expect(outcome(page)).toContainText('Saved to cloud');
  const saved = await acknowledgedSave(page);
  expect(saved).toMatchObject({ ...PRESERVED, bank: 80000, education: {
    ...INITIAL_EDUCATION, highSchool: true,
    currentDegree: { type: 'bachelor', yearsInProgram: 1, totalYears: 4, annualCost: 20000 },
  } });
  expect(enrollments(saved)).toHaveLength(1);
  expect(saved.history).toHaveLength(2);
  expect(enrollments(saved)[0].action).toMatchObject({ version: 1, targetId: 'bachelor', beforeBank: 100000, afterBank: 80000 });
  const enrollmentText = enrollments(saved)[0].text;
  await page.reload();
  await expect(lifeHeader(page).getByText('$80,000', { exact: true })).toBeVisible();
  await expect(page.getByText(LEGACY_MEMORY, { exact: true })).toHaveCount(1);
  await expect(page.getByText(enrollmentText, { exact: true })).toHaveCount(1);
  expect(await acknowledgedSave(page)).toMatchObject(PRESERVED);
  await openEducation(page);
  await expect(page.getByText("📖 Enrolled: Bachelor's Degree", { exact: true })).toBeVisible();
  await expect(page.getByText('Paid years: 1 of 4', { exact: true })).toBeVisible();
  await expect(page.getByText('Remaining tuition: $60,000', { exact: true })).toBeVisible();
  await expect(page.getByText('3 later Age clicks to completion.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Enroll:/ })).toHaveCount(0);
  await expect(page.getByText('Finish your current degree before enrolling in another.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => globalThis.__educationCloud.writes)).toBe(0);
  expect(enrollments(await acknowledgedSave(page))).toHaveLength(1);
  expectNoExternalCalls(requests);
});

test('failed enrollment save keeps session progress and reloads the acknowledged life', async ({ page }, testInfo) => {
  const requests = await bootEducation(page);
  await openEducation(page);
  await page.getByRole('button', { name: /Enroll: Bachelor's Degree/ }).click();
  await page.getByRole('button', { name: 'Confirm enrollment', exact: true }).click();
  await expect(outcome(page)).toContainText('Saving');
  expect(await page.evaluate(() => globalThis.__educationCloud.writes)).toBe(1);
  await page.evaluate(() => globalThis.__educationCloud.fail());
  await expect(outcome(page)).toContainText('Not saved to cloud');
  await expect(outcome(page)).toContainText('Your enrollment remains in this session. Reloading uses the last acknowledged save.');
  await expect(outcome(page)).not.toContainText('Saved to cloud');
  await expect(lifeHeader(page).getByText('$80,000', { exact: true })).toBeVisible();
  await expect(page.getByText("📖 Enrolled: Bachelor's Degree", { exact: true })).toBeVisible();
  await expect(page.getByText('private test provider failure')).toHaveCount(0);
  expect((await acknowledgedSave(page)).bank).toBe(100000);
  expect(enrollments(await acknowledgedSave(page))).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('education-save-failed.png'), fullPage: true, animations: 'disabled' });
  await page.reload();
  await expect(lifeHeader(page).getByText('$100,000', { exact: true })).toBeVisible();
  await expect(page.getByText(LEGACY_MEMORY, { exact: true })).toHaveCount(1);
  expect(await acknowledgedSave(page)).toMatchObject({ ...PRESERVED, bank: 100000, education: { currentDegree: null } });
  expect((await acknowledgedSave(page)).history).toEqual([{ age: 17, text: LEGACY_MEMORY }]);
  await openEducation(page);
  await expect(page.getByText(/📖 Enrolled:/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Enroll: Bachelor's Degree/ })).toBeEnabled();
  await expect(outcome(page)).toHaveCount(0);
  expectNoExternalCalls(requests);
});

test('funded PhD preview explains zero tuition, later happiness effects and completion', async ({ page }) => {
  const requests = await bootEducation(page, { bank: 0, education: { ...INITIAL_EDUCATION, highSchool: true, bachelor: true, master: true } });
  await openEducation(page);
  await page.getByRole('button', { name: /Enroll: PhD/ }).click();
  for (const text of [
    "Prerequisite: Master's Degree — met", 'Program length: 4 years',
    'Pay now: $0', 'Annual tuition: $0', 'Remaining tuition: $0', 'Total tuition: $0',
    'Balance before enrollment: $0', 'Balance after enrollment: $0',
    '3 later Age clicks to completion, projected at age 21.', 'Smarts: +3', 'Happiness: +3',
    '3 annual ticks of −20 happiness, including the completion tick; the completion bonus follows that tick.',
    'No immediate happiness debit on enrollment. Happiness changes clamp to 0–100, so the net change depends on your happiness.',
  ]) await expect(preview(page)).toContainText(text);
  const confirm = page.getByRole('button', { name: 'Confirm enrollment', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expectFullyInsideScrollport(confirm);
  await expectFullyInsideScrollport(page.getByRole('button', { name: 'Cancel', exact: true }));
  await expect(confirm).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => globalThis.__educationCloud.writes)).toBe(0);
  expect((await acknowledgedSave(page)).education.currentDegree).toBeNull();
  expectNoExternalCalls(requests);
});
