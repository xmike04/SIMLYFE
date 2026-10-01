#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { _android } from 'playwright';
import { expect } from '@playwright/test';

// Real installed APK + Firebase/Supabase. Only use an isolated emulator.
// Creates/advances a disposable guest life; never clears app data.
const appId = 'com.simlyfe.app';
const characterName = process.env.ANDROID_SMOKE_CHARACTER_NAME || 'SIMLYFE QA Android';
const supportChecks = process.env.ANDROID_SMOKE_SUPPORT_CHECKS === 'true';
const output = resolve(import.meta.dirname, '../artifacts/android');
const device = (await _android.devices()).find(item =>
  item.serial().startsWith('emulator-') && (!process.env.ANDROID_TEST_SERIAL || item.serial() === process.env.ANDROID_TEST_SERIAL));
if (!device) throw new Error('Start an isolated Android emulator first (see docs/android.md).');
mkdirSync(output, { recursive: true });
const diagnostics = [];
const proof = { testedAt: new Date().toISOString(), appId, model: device.model(), checks: [] };
const check = name => { proof.checks.push(name); console.log(`PASS ${name}`); };
let page;
async function capture(name) {
  // Allow the CSS entrance animation and native compositor to finish painting.
  await page.waitForTimeout(500);
  await device.screenshot({ path: `${output}/${name}.png` });
}
async function attach() {
  page = await (await device.webView({ pkg: appId })).page();
  page.setDefaultTimeout(20_000);
  page.on('console', async message => {
    if (message.text().startsWith('[SIMLYFE diagnostic]')) {
      try {
        const record = await message.args()[1].jsonValue();
        diagnostics.push({ event: record.event, status: record.status, errorClass: record.errorClass });
      } catch { /* process restart can close the old console handle */ }
    }
  });
}
try {
  const installedPath = (await device.shell(`pm path ${appId}`)).toString().trim().replace(/^package:/, '');
  expect(installedPath).toMatch(/^\/data\/app\/[^\s]+\/base\.apk$/);
  proof.apkSha256 = createHash('sha256').update(readFileSync(`${output}/SIMLYFE-debug.apk`)).digest('hex');
  const installedHash = (await device.shell(`sha256sum '${installedPath}'`)).toString().split(/\s/)[0];
  expect(installedHash).toBe(proof.apkSha256);
  check('installed APK matches the delivered artifact SHA-256');
  await device.shell(`am force-stop ${appId}`);
  await device.shell(`am start -n ${appId}/.MainActivity`);
  await attach();
  await expect.poll(() => diagnostics.some(item => item.event === 'save_load' && ['loaded', 'loaded_with_warnings', 'not_found'].includes(item.status)), { timeout: 30_000 }).toBe(true);
  expect(new URL(page.url()).origin).toBe('https://localhost');
  check('packaged HTTPS origin and real Firebase session ready');
  const begin = page.getByRole('button', { name: 'Begin Your Life' });
  if (await begin.isVisible()) await begin.click();
  const create = page.getByRole('button', { name: 'Start Life', exact: true });
  if (await create.isVisible()) {
    await page.getByLabel('First and Last Name').fill(characterName);
    await create.click();
  }
  await expect(page.getByText(characterName, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Account/ })).toBeEnabled();
  check('guest life creation or existing isolated test life');
  await page.getByRole('button', { name: /Account/ }).click();
  await expect(page.getByText('Guest session on this device')).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill('qa@example.invalid');
  await page.getByPlaceholder('Password (6+ characters)').fill('fixture-only');
  await device.shell('input keyevent 4');
  await capture('account');
  await page.getByRole('button', { name: 'Close Account', exact: true }).click();
  check('native account sheet and keyboard interaction');
  const startingAge = Number((await page.locator('body').innerText()).match(/Age:\s*([0-9]+)/)?.[1]);
  expect(Number.isFinite(startingAge)).toBe(true);
  const years = Math.max(1, 4 - startingAge); // Activities unlock naturally at age 4.
  proof.generations = [];
  for (let year = 0; year < years; year++) {
    // The live proxy replenishes one burst token every ten seconds.
    if (year) await page.waitForTimeout(10_000);
    const acknowledged = diagnostics.filter(item => item.event === 'save_sync' && item.status === 'saved').length;
    const responsePromise = page.waitForResponse(response => response.url().includes('/functions/v1/generate-event') && response.request().method() === 'POST');
    await page.getByRole('button', { name: /\+\s*Age/ }).click();
    const response = await responsePromise;
    const payload = await response.json();
    expect(response.status()).toBe(200);
    expect(payload.event?.choices?.length).toBeGreaterThan(0);
    proof.generations.push({ status: response.status(), model: payload.meta?.model, requestId: payload.meta?.requestId });
    await expect(page.locator('.event-overlay')).toBeVisible();
    await device.shell('input keyevent 4');
    await expect(page.locator('.event-overlay')).toBeVisible();
    await capture('event');
    if (supportChecks && year === 0) {
      await page.getByRole('button', { name: 'Report this AI event', exact: true }).click();
      await page.getByRole('button', { name: 'Send report', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('Report received. Your event is still waiting for your choice.');
      await expect(page.locator('.event-overlay')).toBeVisible();
      await capture('content-report');
      check('live AI report acknowledged without resolving the pending event');
    }
    await page.locator('.event-overlay').getByRole('button', { name: payload.event.choices[0].text, exact: true }).click();
    await expect(page.locator('.event-overlay')).toHaveCount(0);
    await expect.poll(() => diagnostics.filter(item => item.event === 'save_sync' && item.status === 'saved').length).toBeGreaterThanOrEqual(acknowledged + 2);
  }
  check('real authenticated AI event, Back preserves pending choice, choice resolves');
  await page.getByRole('button', { name: /Activities/ }).click();
  await page.getByRole('button', { name: /Mind & Body/ }).click();
  await device.shell('input keyevent 4');
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible();
  await device.shell('input keyevent 4');
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toHaveCount(0);
  check('hardware Back closes submenu then sheet');
  await capture('gameplay');
  check('Firestore acknowledges guest life writes');
  const age = (await page.locator('body').innerText()).match(/Age:\s*([0-9]+)/)?.[1];
  proof.ageBeforeRestart = age;
  await device.shell('input keyevent 4');
  await expect.poll(async () => {
    const activities = (await device.shell('dumpsys activity activities')).toString();
    const resumed = activities.split('\n').find(line => /(?:mResumedActivity:|topResumedActivity=)/.test(line));
    return !!resumed && !resumed.includes(appId);
  }).toBe(true);
  check('root Back backgrounds the app');
  await device.shell(`am force-stop ${appId}`);
  await device.shell(`am start -n ${appId}/.MainActivity`);
  await attach();
  await expect(page.getByText(characterName, { exact: true })).toBeVisible({ timeout: 30_000 });
  if (age) await expect(page.getByText(new RegExp(`Age: ${age} •`))).toBeVisible();
  check('force-stop/relaunch restores the guest and saved life');
  await capture('relaunch');
  if (supportChecks) {
    await page.getByRole('button', { name: /Account/ }).click();
    await page.getByRole('button', { name: 'Request account deletion', exact: true }).click();
    await page.getByRole('button', { name: 'Send deletion request', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('nothing has been deleted yet');
    await capture('deletion-request');
    check('disposable guest deletion request acknowledged without deleting its life');
    await page.getByRole('button', { name: 'Close Account', exact: true }).click();
  }
  proof.status = 'passed';
} catch (error) {
  proof.status = 'failed';
  proof.failure = String(error.message).slice(0, 1200);
  try { await device.screenshot({ path: `${output}/smoke-failure.png` }); } catch { /* unavailable device */ }
  process.exitCode = 1;
} finally {
  proof.diagnostics = diagnostics;
  writeFileSync(`${output}/smoke-receipt.json`, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Android smoke ${proof.status}; receipt ${output}/smoke-receipt.json`);
  await device.close();
}
