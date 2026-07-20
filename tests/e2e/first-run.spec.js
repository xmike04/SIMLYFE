import { expect, test } from '@playwright/test';

const FIREBASE_PROJECT_ID = 'simlyfe-playwright';
const FIREBASE_USER_ID = 'playwright-anonymous-user';
const SUPABASE_PUBLISHABLE_KEY = 'test-publishable';

const mockedEvent = {
  description: 'A portfolio reviewer dares you to prove the loop works.',
  choices: [
    { text: 'Take the dare', effects: { happiness: 1, smarts: 1 } },
    { text: 'Play it safe', effects: { happiness: -1 } },
  ],
};

function encodeJwtSegment(value) {
  return btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function createFirebaseIdToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtSegment({ alg: 'RS256', kid: 'playwright-key', typ: 'JWT' });
  const payload = encodeJwtSegment({
    aud: FIREBASE_PROJECT_ID,
    auth_time: now,
    exp: now + 3600,
    firebase: {
      identities: {},
      sign_in_provider: 'anonymous',
    },
    iat: now,
    iss: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    sub: FIREBASE_USER_ID,
    user_id: FIREBASE_USER_ID,
  });

  return `${header}.${payload}.playwright-signature`;
}

async function mockFirebase(page, firebaseIdToken) {
  const requests = [];

  await page.route('**/node_modules/.vite/deps/firebase_firestore.js*', async (route) => {
    requests.push({ type: 'firestore-module', method: 'GET', url: route.request().url() });
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        const markCloudReady = () => {
          globalThis.__SIMLYFE_PLAYWRIGHT_FIRESTORE_READY__ = true;
        };

        export function getFirestore() {
          return { kind: 'playwright-firestore' };
        }

        export function doc(...segments) {
          return { kind: 'document', segments };
        }

        export function collection(...segments) {
          return { kind: 'collection', segments };
        }

        export async function getDoc() {
          markCloudReady();
          return { exists: () => false, data: () => undefined };
        }

        export async function getDocs() {
          markCloudReady();
          return { empty: true, docs: [] };
        }

        export async function setDoc() {
          markCloudReady();
        }
      `,
    });
  });

  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    requests.push({ type: 'identity', method: request.method(), url: request.url() });

    if (pathname.endsWith('/accounts:signUp')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          idToken: firebaseIdToken,
          refreshToken: 'playwright-refresh-token',
          expiresIn: '3600',
          localId: FIREBASE_USER_ID,
        }),
      });
      return;
    }

    if (pathname.endsWith('/accounts:lookup')) {
      const timestamp = String(Date.now());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [{
            localId: FIREBASE_USER_ID,
            createdAt: timestamp,
            lastLoginAt: timestamp,
            lastRefreshAt: new Date().toISOString(),
            providerUserInfo: [],
          }],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'PLAYWRIGHT_UNMOCKED_AUTH_REQUEST' } }),
    });
  });

  // The local module stub above owns cloud-save behavior for this contract
  // test. This route is a guard against accidental calls to the real backend.
  await page.route('https://firestore.googleapis.com/**', async (route) => {
    const request = route.request();
    requests.push({ type: 'firestore', method: request.method(), url: request.url() });
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 403,
          message: 'Playwright intentionally disables cloud saves.',
          status: 'PERMISSION_DENIED',
        },
      }),
    });
  });

  return requests;
}

async function mockSupabaseEvent(page) {
  const requests = [];

  await page.route('https://playwright.supabase.co/functions/v1/generate-event', async (route) => {
    const request = route.request();
    requests.push({
      headers: request.headers(),
      body: request.postDataJSON(),
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        event: mockedEvent,
        meta: {
          requestId: '00000000-0000-4000-8000-000000000001',
          model: 'gpt-4.1-nano',
          latencyMs: 1,
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            totalTokens: 20,
          },
        },
      }),
    });
  });

  return requests;
}

async function closeSheet(page) {
  await page.getByRole('button', { name: '×' }).click();
}

async function ageUpAndResolveEvent(page) {
  await page.getByRole('button', { name: /age/i }).click();
  await expect(page.getByRole('heading', { name: mockedEvent.description })).toBeVisible();
  await page.getByRole('button', { name: 'Take the dare' }).click();
}

test('first-run flow reaches core gameplay sheets with mocked AI events', async ({ page }) => {
  const firebaseIdToken = createFirebaseIdToken();
  const firebaseRequests = await mockFirebase(page, firebaseIdToken);
  const supabaseRequests = await mockSupabaseEvent(page);
  await page.goto('/');

  await expect.poll(
    () => firebaseRequests.some(request => request.url.includes('/accounts:signUp')),
    { message: 'anonymous Firebase sign-in should complete' },
  ).toBe(true);
  await expect.poll(
    () => page.evaluate(() => globalThis.__SIMLYFE_PLAYWRIGHT_FIRESTORE_READY__ === true),
    { message: 'cloud initialization should install the Firebase ID-token provider' },
  ).toBe(true);

  await expect(page.getByText('SIMLYFE')).toBeVisible();
  await expect(page.getByText('AI Events')).toBeVisible();
  await expect(page.getByText('🐛')).toHaveCount(0);
  await page.getByRole('button', { name: 'Begin Your Life' }).click();

  await page.getByLabel('First and Last Name').fill('Morgan Case');
  await page.getByRole('button', { name: 'Start Life' }).click();

  await expect(page.getByRole('heading', { name: 'Morgan Case' })).toBeVisible();
  await expect(page.getByText(/Age: 0/)).toBeVisible();

  for (let i = 0; i < 18; i += 1) {
    await ageUpAndResolveEvent(page);
  }

  await expect(page.getByText(/Age: 18/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Morgan Case' })).toBeVisible();
  await expect(page.getByText('🐛')).toHaveCount(0);

  await page.getByRole('button', { name: /relationships/i }).click();
  await expect(page.getByRole('heading', { name: 'Relationships' })).toBeVisible();
  await closeSheet(page);

  await page.getByRole('button', { name: /activities/i }).click();
  await expect(page.getByRole('heading', { name: 'Activities' })).toBeVisible();
  await closeSheet(page);

  await page.getByRole('button', { name: /job/i }).click();
  await expect(page.getByRole('heading', { name: 'Career & Income' })).toBeVisible();
  await closeSheet(page);

  await page.getByRole('button', { name: /assets/i }).click();
  await expect(page.getByRole('heading', { name: '🏦 Assets' })).toBeVisible();
  await closeSheet(page);

  expect(supabaseRequests).toHaveLength(18);
  expect(firebaseRequests.filter(request => request.type === 'firestore')).toHaveLength(0);
  for (const request of supabaseRequests) {
    expect(request.headers.authorization).toBe(`Bearer ${firebaseIdToken}`);
    expect(request.headers.apikey).toBe(SUPABASE_PUBLISHABLE_KEY);
    expect(Object.keys(request.body).sort()).toEqual([
      'actionContext',
      'narrativeMode',
      'state',
    ]);
    expect(request.body.state).toEqual(expect.objectContaining({
      character: expect.objectContaining({ name: 'Morgan Case' }),
      age: expect.any(Number),
      stats: expect.any(Object),
    }));
    expect(request.body.actionContext).toBeNull();
    expect(request.body.narrativeMode).toBe(false);

    for (const serverOwnedField of [
      'messages',
      'model',
      'temperature',
      'max_tokens',
      'max_completion_tokens',
    ]) {
      expect(request.body).not.toHaveProperty(serverOwnedField);
    }
  }
});
