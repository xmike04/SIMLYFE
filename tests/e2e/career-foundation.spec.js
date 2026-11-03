import { expect, test } from '@playwright/test';
import { buildLifeSave, INITIAL_EDUCATION, INITIAL_STATS } from '../../src/engine/lifeSave.js';
import { createFirebaseIdToken, mockFirebase } from './support/firebase.js';

const LEGACY_MEMORY = 'An existing memory from before career decisions.';
const catalog = [
  {
    id: 'teacher', title: 'Teacher', type: 'full_time', sector: 'education', tier: 1,
    salary: 50000, healthEffect: -16, happinessEffect: -8, minAge: 22,
    requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 },
  },
  {
    id: 'lecturer', title: 'College Lecturer', type: 'full_time', sector: 'education', tier: 1,
    salary: 55000, healthEffect: -8, happinessEffect: 0, minAge: 22,
    requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 },
  },
];
const adultLife = buildLifeSave({
  character: { name: 'Jordan Career', gender: 'Female', country: 'United States', city: null },
  age: 30,
  bank: 12000,
  stats: { ...INITIAL_STATS, smarts: 70, health: 80 },
  education: { ...INITIAL_EDUCATION, bachelor: true },
  networking: 30,
  history: [{ age: 20, text: LEGACY_MEMORY }],
});

// The Node test process owns the acknowledged snapshot. A real page reload
// reads that snapshot through getDoc; unacknowledged requests never replace it.
const firestoreSource = `
  const catalog = ${JSON.stringify(catalog)};
  const cloud = globalThis.__careerCloud = { pending: [], writes: 0 };
  export function getFirestore() { return {}; }
  export function doc(_db, ...parts) { return parts.join('/'); }
  export function collection(_db, path) { return path; }
  export async function getDoc() {
    const save = await globalThis.__readAcknowledgedCareerSave();
    return { exists: () => save !== null, data: () => save };
  }
  export async function getDocs() {
    return { empty: false, docs: catalog.map(career => ({ data: () => career })) };
  }
  export function setDoc(path, save, options) {
    cloud.writes += 1;
    return new Promise((resolve, reject) => {
      cloud.pending.push({ path, save: structuredClone(save), options, resolve, reject });
    });
  }
  cloud.acknowledge = async () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending cloud write');
    await globalThis.__commitAcknowledgedCareerSave(write.save, write.options);
    write.resolve();
  };
  cloud.fail = () => {
    const write = cloud.pending.shift();
    if (!write) throw new Error('No pending cloud write');
    write.reject(new Error('private test provider failure'));
  };
`;

async function bootAdult(page, fields = {}) {
  let acknowledged = structuredClone({ ...adultLife, ...fields });
  await page.exposeFunction('__readAcknowledgedCareerSave', () => structuredClone(acknowledged));
  await page.exposeFunction('__commitAcknowledgedCareerSave', (save, options) => {
    acknowledged = structuredClone(options?.merge ? { ...acknowledged, ...save } : save);
  });
  const firebaseRequests = await mockFirebase(page, createFirebaseIdToken(), { firestoreSource });
  const aiRequests = [];
  await page.route('https://playwright.supabase.co/**', async route => {
    aiRequests.push(route.request().url());
    await route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jordan Career' })).toBeVisible();
  return { firebaseRequests, aiRequests };
}

const acknowledgedSave = page => page.evaluate(() => globalThis.__readAcknowledgedCareerSave());
const outcome = page => page.getByLabel('Career outcome');
const preview = page => page.getByRole('region', { name: 'Career decision preview' });
const lifeHeader = page => page.getByRole('heading', { name: 'Jordan Career' }).locator('..');

async function openEducationCareers(page) {
  await page.getByRole('button', { name: /Job/ }).click();
  await page.getByRole('button', { name: /Full-Time/ }).click();
  await page.getByRole('button', { name: /Education/, exact: false }).click();
}

async function acknowledge(page) {
  await page.evaluate(() => globalThis.__careerCloud.acknowledge());
  await expect(outcome(page)).toContainText('Saved to cloud');
}

async function expectHistoryOnce(page, text) {
  await expect(page.getByText(LEGACY_MEMORY, { exact: true })).toBeVisible();
  await expect(page.getByText(text, { exact: true })).toHaveCount(1);
}

test('career previews and acknowledged selection, switch and quit survive reload', async ({ page }, testInfo) => {
  const { firebaseRequests, aiRequests } = await bootAdult(page);
  await openEducationCareers(page);
  await page.getByRole('button', { name: /^Teacher/ }).click();
  await expect(page.getByRole('heading', { name: 'Review Career Decision' })).toBeVisible();
  await expect(preview(page)).toContainText('Base annual salary: $50,000/yr');
  await expect(preview(page)).toContainText('Estimated annual gross in your city: $50,000/yr before tax.');
  await expect(preview(page)).toContainText('Immediate cost: $0');
  await expect(preview(page)).toContainText('Bachelor');
  await expect(preview(page)).toContainText('Age 22+');
  await expect(preview(page)).toContainText('Networking 20+');
  await expect(preview(page)).toContainText('Smarts 60+');
  await expect(preview(page)).toContainText('Health: −2 points/year');
  await expect(preview(page)).toContainText('Happiness: −1 points/year');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('career-preview.png'), fullPage: true, animations: 'disabled' });
  const confirm = page.getByRole('button', { name: 'Confirm career', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('career-preview-controls.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => globalThis.__careerCloud.writes)).toBe(0);
  expect((await acknowledgedSave(page)).career).toBeNull();
  await expect(lifeHeader(page).getByText(/Teacher \(/)).toHaveCount(0);

  await page.getByRole('button', { name: /^Teacher/ }).click();
  await page.getByRole('button', { name: 'Confirm career', exact: true }).click();
  await expect(outcome(page)).toContainText('Teacher');
  await expect(outcome(page)).toContainText('Saving');
  expect((await acknowledgedSave(page)).career).toBeNull();
  expect(await page.evaluate(() => globalThis.__careerCloud.writes)).toBe(1);
  await acknowledge(page);
  let saved = await acknowledgedSave(page);
  expect(saved.career.id).toBe('teacher');
  expect(saved.history.filter(entry => entry.action)).toHaveLength(1);
  expect(saved.history.at(-1).action.version).toBe(1);
  const selectionText = saved.history.at(-1).text;
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectHistoryOnce(page, selectionText);
  await page.reload();
  await expect(lifeHeader(page).getByText(/Teacher \(\$50,000\/yr\)/)).toBeVisible();
  await expectHistoryOnce(page, selectionText);
  await openEducationCareers(page);
  await expect(page.getByRole('button', { name: /^Teacher/ })).toBeDisabled();

  await page.getByRole('button', { name: /^College Lecturer/ }).click();
  await expect(preview(page)).toContainText('Replaces Teacher ($50,000/yr).');
  await expect(preview(page)).toContainText('Your tenure and promotion progress reset');
  await page.getByRole('button', { name: 'Confirm career', exact: true }).click();
  await expect(outcome(page)).toContainText('Saving');
  expect((await acknowledgedSave(page)).career.id).toBe('teacher');
  await acknowledge(page);
  saved = await acknowledgedSave(page);
  expect(saved.career.id).toBe('lecturer');
  expect(saved.history.filter(entry => entry.action)).toHaveLength(2);
  await page.reload();
  await expect(lifeHeader(page).getByText(/College Lecturer \(\$55,000\/yr\)/)).toBeVisible();
  await page.getByRole('button', { name: /Job/ }).click();

  await page.getByRole('button', { name: 'Quit Position', exact: true }).click();
  await expect(preview(page)).toContainText('Your $55,000/yr career salary ends when you quit.');
  await expect(preview(page)).toContainText('No unemployment benefits are granted for voluntary quitting.');
  await page.getByRole('button', { name: 'Confirm quit', exact: true }).click();
  await expect(outcome(page)).toContainText('Saving');
  expect((await acknowledgedSave(page)).career.id).toBe('lecturer');
  await acknowledge(page);
  saved = await acknowledgedSave(page);
  expect(saved.career).toBeNull();
  expect(saved.careerMeta.unemploymentYearsLeft).toBe(0);
  expect(saved.history.filter(entry => entry.action)).toHaveLength(3);
  const quitText = saved.history.at(-1).text;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jordan Career' })).toBeVisible();
  await expect(lifeHeader(page).getByText(/College Lecturer \(/)).toHaveCount(0);
  await expectHistoryOnce(page, selectionText);
  await expect(page.getByText(quitText, { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: /Job/ }).click();
  await expect(page.getByRole('button', { name: 'Quit Position', exact: true })).toHaveCount(0);
  expect(aiRequests).toHaveLength(0);
  expect(firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
});

test('save rejection retains the current outcome and reloads only acknowledged state', async ({ page }, testInfo) => {
  const { aiRequests } = await bootAdult(page);
  await openEducationCareers(page);
  await page.getByRole('button', { name: /^Teacher/ }).click();
  await page.getByRole('button', { name: 'Confirm career', exact: true }).click();
  await expect(outcome(page)).toContainText('Saving');
  await page.evaluate(() => globalThis.__careerCloud.fail());
  await expect(outcome(page)).toContainText('Not saved to cloud');
  await expect(outcome(page)).toContainText('Teacher');
  await expect(outcome(page)).not.toContainText('Saved to cloud');
  await expect(lifeHeader(page).getByText(/Teacher \(\$50,000\/yr\)/)).toBeVisible();
  await expect(page.getByText('private test provider failure')).toHaveCount(0);
  expect((await acknowledgedSave(page)).career).toBeNull();
  await page.screenshot({ path: testInfo.outputPath('career-save-failed.png'), fullPage: true, animations: 'disabled' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jordan Career' })).toBeVisible();
  await expect(lifeHeader(page).getByText(/Teacher \(/)).toHaveCount(0);
  expect((await acknowledgedSave(page)).history.filter(entry => entry.action)).toHaveLength(0);
  await expect(page.getByText(LEGACY_MEMORY, { exact: true })).toBeVisible();
  expect(aiRequests).toHaveLength(0);
});

test('initially ineligible career shows its requirement and cannot be confirmed', async ({ page }) => {
  const { aiRequests } = await bootAdult(page, { networking: 10 });
  await openEducationCareers(page);
  await page.getByRole('button', { name: /^Teacher/ }).click();
  await expect(preview(page)).toContainText('Networking 20+');
  await expect(preview(page)).toContainText('Requires Networking 20+');
  await expect(page.getByRole('button', { name: 'Confirm career', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => globalThis.__careerCloud.writes)).toBe(0);
  expect((await acknowledgedSave(page)).career).toBeNull();
  expect(aiRequests).toHaveLength(0);
});
