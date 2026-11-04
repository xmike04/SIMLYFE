const FIREBASE_PROJECT_ID = 'simlyfe-playwright';
const FIREBASE_USER_ID = 'playwright-anonymous-user';

function encodeJwtSegment(value) {
  return btoa(JSON.stringify(value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export function createFirebaseIdToken() {
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

export async function mockFirebase(page, firebaseIdToken, { firestoreSource, authSource } = {}) {
  const requests = [];

  if (authSource) {
    await page.route('**/node_modules/.vite/deps/firebase_auth.js*', route => route.fulfill({
      status: 200, contentType: 'application/javascript', body: authSource,
    }));
  }

  await page.route('**/node_modules/.vite/deps/firebase_firestore.js*', async (route) => {
    requests.push({ type: 'firestore-module', method: 'GET', url: route.request().url() });
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: firestoreSource ?? `
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
