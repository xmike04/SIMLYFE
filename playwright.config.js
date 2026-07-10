import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'VITE_SUPABASE_URL=https://playwright.supabase.co VITE_SUPABASE_PUBLISHABLE=test-publishable VITE_FIREBASE_API_KEY=playwright-api-key VITE_FIREBASE_AUTH_DOMAIN=simlyfe-playwright.firebaseapp.com VITE_FIREBASE_PROJECT_ID=simlyfe-playwright VITE_FIREBASE_STORAGE_BUCKET=simlyfe-playwright.firebasestorage.app VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 VITE_FIREBASE_APP_ID=1:123456789:web:playwright VITE_ENABLE_DEV_TOOLS=false npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
