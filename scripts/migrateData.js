/* global process */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// THIS REQUIRES A SERVICE ACCOUNT KEY DOWNLOADED FROM FIREBASE CONSOLE
// Save it as serviceAccountKey.json in the scripts folder before running this.
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Missing serviceAccountKey.json! Download it from Firebase Console -> Project Settings -> Service Accounts");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function migrateCollection(jsonRelativePath, collectionName) {
  const dataPath = path.join(process.cwd(), jsonRelativePath);
  if (!fs.existsSync(dataPath)) {
    console.error(`Data file not found: ${dataPath}`);
    return;
  }
  
  const items = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log(`Migrating ${items.length} items to '${collectionName}' collection...`);
  
  const batch = db.batch();
  items.forEach(item => {
    const docRef = item.id ? db.collection(collectionName).doc(item.id) : db.collection(collectionName).doc();
    batch.set(docRef, item);
  });
  
  await batch.commit();
  console.log(`Successfully migrated ${collectionName}.`);
}

async function run() {
  console.log("Starting Firebase migration...");
  await migrateCollection('src/engine/events.json', 'events');
  await migrateCollection('src/engine/careers.json', 'careers');
  console.log("Data migration complete!");
  process.exit(0);
}

run().catch(console.error);
