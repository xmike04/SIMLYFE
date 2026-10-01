import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseSigningEnvironment } from '../../scripts/android-signing.js';

describe('release signing preflight', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'simlyfe-signing-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
  const input = path => ({ ANDROID_KEYSTORE_PATH: path, ANDROID_KEYSTORE_PASSWORD: 'private-password', ANDROID_KEY_ALIAS: 'upload', ANDROID_KEY_PASSWORD: 'private-password' });
  it('rejects partial signing configuration without exposing its password', () => {
    expect(() => releaseSigningEnvironment({ ANDROID_KEYSTORE_PASSWORD: 'private-password' })).toThrow('ANDROID_KEYSTORE_PATH');
    try { releaseSigningEnvironment({ ANDROID_KEYSTORE_PASSWORD: 'private-password' }); }
    catch (error) { expect(error.message).not.toContain('private-password'); }
  });
  it('rejects missing keystores before a build', () => {
    expect(() => releaseSigningEnvironment(input(join(dir, 'absent.p12')))).toThrow('does not exist');
  });
  it('loads the explicit local config and preserves unrelated build variables', () => {
    const key = join(dir, 'key.p12');
    writeFileSync(key, 'fixture');
    const config = join(dir, 'release.json');
    writeFileSync(config, JSON.stringify(input(key)));
    expect(releaseSigningEnvironment({ ANDROID_SIGNING_CONFIG: config, JAVA_HOME: '/java' })).toMatchObject({ ...input(key), JAVA_HOME: '/java' });
  });
  it('uses a complete CI environment instead of reading local config', () => {
    const key = join(dir, 'key.p12');
    writeFileSync(key, 'fixture');
    expect(releaseSigningEnvironment({ ...input(key), ANDROID_SIGNING_CONFIG: '/missing/config' })).toMatchObject(input(key));
  });
});
