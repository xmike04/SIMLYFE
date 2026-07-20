#!/usr/bin/env node

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE
  ?? process.env.SUPABASE_PUBLISHABLE_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY;
const firebaseIdToken = process.env.FIREBASE_ID_TOKEN;

const missing = [
  !supabaseUrl && 'VITE_SUPABASE_URL (or SUPABASE_URL)',
  !supabaseKey && 'VITE_SUPABASE_PUBLISHABLE (or SUPABASE_PUBLISHABLE_KEY)',
  !firebaseIdToken && 'FIREBASE_ID_TOKEN',
].filter(Boolean);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const body = {
  state: {
    character: { name: 'Alex', gender: 'nonbinary', country: 'US' },
    age: 25,
    stats: {
      health: 80,
      happiness: 70,
      smarts: 75,
      looks: 60,
      athleticism: 50,
      karma: 40,
      acting: 10,
      voice: 20,
      modeling: 30,
      grades: 80,
    },
    bank: 5000,
    career: { id: null, title: 'Analyst' },
    recentHistory: [{ age: 24, text: 'Started a new job.' }],
    relationships: [],
    pets: [],
    city: 'Chicago',
    education: {
      highSchool: true,
      associate: false,
      bachelor: true,
      master: false,
      phd: false,
      currentDegree: null,
    },
    economyPhase: 'normal',
  },
  actionContext: process.env.ACTION_CONTEXT?.trim() || null,
  narrativeMode: false,
};

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 20_000);

try {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-event`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${firebaseIdToken}`,
      apikey: supabaseKey,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Proxy returned non-JSON data (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const code = typeof payload?.error?.code === 'string'
      ? payload.error.code
      : 'UNKNOWN_PROXY_ERROR';
    throw new Error(`Proxy request failed with ${code} (HTTP ${response.status}).`);
  }
  if (!payload?.event || !payload?.meta) {
    throw new Error('Proxy response does not match the normalized { event, meta } contract.');
  }

  console.log(JSON.stringify({ event: payload.event, meta: payload.meta }, null, 2));
} catch (error) {
  const message = controller.signal.aborted
    ? 'Proxy request timed out after 20 seconds.'
    : error instanceof Error
      ? error.message
      : 'Proxy request failed.';
  console.error(message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
