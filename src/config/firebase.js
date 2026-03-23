import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PLACEHOLDER CONFIGURATION
// Create a Firebase Web App in the console and replace these with real values to activate V2 cloud features.
const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER_PROJECT_ID.firebaseapp.com",
  projectId: "PLACEHOLDER_PROJECT_ID",
  storageBucket: "PLACEHOLDER_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PLACEHOLDER_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID"
};

const isConfigured = firebaseConfig.apiKey !== "PLACEHOLDER_API_KEY";

export const app = isConfigured ? initializeApp(firebaseConfig) : null;
export const auth = isConfigured ? getAuth(app) : null;
export const db = isConfigured ? getFirestore(app) : null;

if (!isConfigured) {
  console.warn("Firebase is not configured! Cloud saves and remote events are disabled. Please update src/config/firebase.js with your keys to activate V2 features.");
}
