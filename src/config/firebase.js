import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAppCheckSetup } from "./appCheck";

// Read credentials from environment variables (set in .env.local, never committed).
// All VITE_FIREBASE_* vars must be set to activate cloud saves.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.startsWith('PLACEHOLDER')
);

export const app  = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isConfigured ? getAuth(app) : null;
export const db   = isConfigured ? getFirestore(app) : null;

// App Check (reCAPTCHA v3): active only when the site key env is set, so dev
// setups without one are unaffected. A failed init must not brick cloud saves
// — enforcement is a server-side decision made in the Firebase console.
const appCheckSetup = getAppCheckSetup(import.meta.env);
let appCheckInstance = null;
if (app && appCheckSetup.enabled) {
  try {
    if (appCheckSetup.debugToken !== null) {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckSetup.debugToken;
    }
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSetup.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('Firebase App Check failed to initialize.', e);
  }
}
export const appCheck = appCheckInstance;

if (!isConfigured) {
  console.warn(
    'Firebase is not configured. Add VITE_FIREBASE_* variables to .env.local to enable cloud saves.'
  );
}
