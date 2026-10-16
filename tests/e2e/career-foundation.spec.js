import { test, expect } from '@playwright/test';

const teacher = { id: 'teacher', title: 'Teacher', type: 'full_time', sector: 'education', salary: 50000, minAge: 22, requiresDegree: 'bachelor', requiresNetworking: 20, statRequirements: { smarts: 60 }, healthEffect: -16, happinessEffect: -8 };
const initialLife = () => ({ character: { name: 'Career Player', gender: 'Female', country: 'US', city: null }, age: 30, bank: 12000,
  stats: { health: 80, happiness: 80, smarts: 70, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 },
  history: [{ age: 20, text: 'An existing memory.' }], isDead: false, flags: [], career: null,
  careerMeta: { yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 },
  relationships: [], belongings: [], properties: [], education: { highSchool: true, bachelor: true }, networking: 30,
  economyCycle: { year: 0, phase: 'normal', yearsInPhase: 0 }, pets: [], will: null });

async function fixture(page, { fail = false, eligible = true } = {}) {
  let saved = initialLife();
  if (!eligible) saved.education = { highSchool: true };
  const writes = [], unexpected = [];
  await page.exposeBinding('careerFixtureLoad', () => saved);
  await page.exposeBinding('careerFixtureSave', (_source, path, value, options) => {
    if (path !== 'users/career-fixture/saves/currentLife') throw new Error('Unexpected fixture destination');
    if (fail) throw new Error('Fixture save rejected');
    saved = options?.merge ? { ...saved, ...value } : value;
    writes.push(structuredClone(value));
  });
  await page.route('**/node_modules/.vite/deps/firebase_auth.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const user = {uid:'career-fixture',isAnonymous:true,getIdToken:async()=> 'fixture-token'};
    export const getAuth = () => ({currentUser:user});
    export const onAuthStateChanged = (_auth, callback) => { queueMicrotask(()=>callback(user)); return ()=>{}; };
    export const signInAnonymously = async () => ({user});
  ` }));
  await page.route('**/node_modules/.vite/deps/firebase_firestore.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const getFirestore = () => ({});
    export const doc = (_db,...parts) => parts.join('/');
    export const collection = (_db,path) => path;
    export const getDoc = async () => { const saved = await window.careerFixtureLoad(); return {exists:()=>!!saved,data:()=>saved}; };
    export const getDocs = async () => ({empty:false,docs:[{data:()=>(${JSON.stringify(teacher)})}]});
    export const setDoc = async (path,value,options) => { await window.careerFixtureSave(path,value,options); };
  ` }));
  await page.route(/https:\/\/(firestore.googleapis.com|identitytoolkit.googleapis.com|.*supabase.co)\//, async route => {
    unexpected.push(route.request().url());
    await route.abort();
  });
  return { writes, unexpected, saved: () => saved };
}
async function openJobs(page) { await page.getByRole('button', { name: /Job$/ }).click(); }
async function previewTeacher(page) {
  await openJobs(page);
  await page.getByRole('button', { name: /Full-Time/ }).click();
  await page.getByRole('button', { name: /Education/ }).click();
  await page.getByRole('button', { name: /Teacher/ }).click();
}

test('career preview, acknowledged employment, quit and reload preserve one consequence per decision', async ({ page }, testInfo) => {
  const state = await fixture(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  await previewTeacher(page);
  await expect(page.getByText(/Health −2/)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  const contrast = await page.getByRole('button', { name: 'Confirm career change' }).evaluate(button => {
    const style = getComputedStyle(button);
    const luminance = color => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const a = luminance(style.color), b = luminance(style.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: testInfo.outputPath('career-preview.png') });
  await page.getByRole('button', { name: 'Confirm career change' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to cloud');
  expect(state.saved().career.id).toBe('teacher');
  expect(state.saved().history.filter(entry => entry.action)).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('career-saved.png') });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  await expect(page.getByText('An existing memory.')).toBeVisible();
  await openJobs(page);
  await expect(page.getByText('Teacher', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Quit Position' }).click();
  await expect(page.getByText(/lose future income/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm career change' }).click();
  await expect(page.getByRole('status')).toContainText('Saved to cloud');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  expect(state.saved().career).toBeNull();
  expect(state.saved().history.filter(entry => entry.action)).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
});

test('failed save reports the session change and reload restores the last acknowledged life', async ({ page }) => {
  const state = await fixture(page, { fail: true });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  await previewTeacher(page);
  await page.getByRole('button', { name: 'Confirm career change' }).click();
  await expect(page.getByRole('alert')).toContainText('Not saved to cloud');
  await expect(page.getByRole('alert')).toContainText('Your career changed in this session');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await openJobs(page);
  await expect(page.getByRole('button', { name: 'Quit Position' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  await openJobs(page);
  await expect(page.getByRole('button', { name: 'Quit Position' })).toHaveCount(0);
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('an ineligible career shows the requirement without allowing selection', async ({ page }) => {
  const state = await fixture(page, { eligible: false });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Career Player' })).toBeVisible();
  await openJobs(page);
  await page.getByRole('button', { name: /Full-Time/ }).click();
  await page.getByRole('button', { name: /Education/ }).click();
  await expect(page.getByRole('button', { name: /Teacher/ })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
