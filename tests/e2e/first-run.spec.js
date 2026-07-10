import { expect, test } from '@playwright/test';

const mockedEvent = {
  description: 'A portfolio reviewer dares you to prove the loop works.',
  choices: [
    { text: 'Take the dare', effects: { happiness: 1, smarts: 1 } },
    { text: 'Play it safe', effects: { happiness: -1 } },
  ],
};

async function mockSupabaseEvent(page) {
  await page.route('https://playwright.supabase.co/functions/v1/generate-event', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(mockedEvent) } }],
      }),
    });
  });
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
  await mockSupabaseEvent(page);
  await page.goto('/');

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
});
