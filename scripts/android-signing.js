import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export const SIGNING_KEYS = [
  'ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD',
];

export function releaseSigningEnvironment(input = process.env) {
  let env = { ...input };
  if (!SIGNING_KEYS.some(key => env[key])) {
    const configPath = env.ANDROID_SIGNING_CONFIG ?? join(homedir(), '.config/simlyfe/android-signing/release.json');
    if (existsSync(configPath)) env = { ...env, ...JSON.parse(readFileSync(configPath, 'utf8')) };
  }
  const missing = SIGNING_KEYS.filter(key => !env[key]);
  if (missing.length) throw new Error(`Release signing is incomplete: ${missing.join(', ')}. See docs/android.md.`);
  env.ANDROID_KEYSTORE_PATH = resolve(env.ANDROID_KEYSTORE_PATH);
  if (!existsSync(env.ANDROID_KEYSTORE_PATH)) throw new Error('Release keystore does not exist.');
  return env;
}
