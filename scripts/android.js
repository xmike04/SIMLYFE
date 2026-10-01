#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { releaseSigningEnvironment, SIGNING_KEYS } from './android-signing.js';

const root = resolve(import.meta.dirname, '..');
const android = join(root, 'android');
const configPath = join(root, 'capacitor.config.json');
const originalConfig = readFileSync(configPath, 'utf8');
const config = JSON.parse(originalConfig);
const task = process.argv[2] ?? 'doctor';
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ??
  (process.platform === 'darwin' ? '/opt/homebrew/share/android-commandlinetools' : '');
const brewJava = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const java = process.env.JAVA_HOME ?? (existsSync(brewJava) ? brewJava : '');
const googlePath = join(android, 'app/google-services.json');
let googleEnabled = false;
if (existsSync(googlePath)) {
  const google = JSON.parse(readFileSync(googlePath, 'utf8'));
  const client = google.client?.find(item => item.client_info?.android_client_info?.package_name === config.appId);
  if (!client) throw new Error(`google-services.json has no Android client for ${config.appId}.`);
  googleEnabled = client.oauth_client?.some(item => item.client_type === 3) ?? false;
}
const signedRelease = ['release-apk', 'release-bundle'].includes(task);
const signingEnv = signedRelease ? releaseSigningEnvironment() : Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !SIGNING_KEYS.includes(key)),
);
const env = {
  ...signingEnv,
  ...(sdk ? { ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk } : {}),
  ...(java ? { JAVA_HOME: java } : {}),
  VITE_ENABLE_DEV_TOOLS: 'false',
  VITE_ANDROID_GOOGLE_AUTH_ENABLED: String(googleEnabled),
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
if (!['doctor', 'sync', 'apk', 'bundle', 'lint', 'install', 'release-apk', 'release-bundle'].includes(task)) {
  throw new Error('Use doctor, sync, apk, bundle, lint, install, release-apk, or release-bundle.');
}
console.log(`Android ${config.appId}; SDK ${sdk || '(set ANDROID_HOME)'}; Java ${java || '(system)'}; native Google ${googleEnabled ? 'configured' : 'pending configuration'}.`);
if (task === 'doctor') {
  run(java ? join(java, 'bin/java') : 'java', ['-version']);
  console.log(`API 36: ${existsSync(join(sdk, 'platforms/android-36'))}; Build tools 36: ${existsSync(join(sdk, 'build-tools/36.0.0'))}`);
} else {
  if (!sdk || !existsSync(join(sdk, 'platforms/android-36'))) throw new Error('Install Android SDK platform 36; see docs/android.md.');
  writeFileSync(join(android, 'local.properties'), `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`);
  // Do not load the native Firebase plugin without its registered app/OAuth config.
  // Email/guest auth still use the existing Firebase JavaScript session.
  try {
    writeFileSync(configPath, `${JSON.stringify({ ...config, includePlugins: [
      '@capacitor/app', ...(googleEnabled ? ['@capacitor-firebase/authentication'] : []),
    ] }, null, 2)}\n`);
    run(process.execPath, ['node_modules/vite/bin/vite.js', 'build']);
    run(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android']);
  } finally {
    writeFileSync(configPath, originalConfig);
  }
  if (task !== 'sync') {
    const isBundle = ['bundle', 'release-bundle'].includes(task);
    const gradleTask = isBundle ? 'bundleRelease' : task === 'release-apk' ? 'assembleRelease' : task === 'lint' ? 'lintDebug' : 'assembleDebug';
    run(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [gradleTask, '--console=plain',
      '-Dorg.gradle.internal.http.connectionTimeout=120000',
      '-Dorg.gradle.internal.http.socketTimeout=120000'], android);
    if (task !== 'lint') {
      const source = join(android, isBundle ? 'app/build/outputs/bundle/release/app-release.aab' : signedRelease ? 'app/build/outputs/apk/release/app-release.apk' : 'app/build/outputs/apk/debug/app-debug.apk');
      const outputDir = join(root, 'artifacts/android');
      mkdirSync(outputDir, { recursive: true });
      const output = join(outputDir, isBundle ? (signedRelease ? 'SIMLYFE-release.aab' : 'SIMLYFE-release-unsigned.aab') : signedRelease ? 'SIMLYFE-release.apk' : 'SIMLYFE-debug.apk');
      copyFileSync(source, output);
      const receipt = {
        builtAt: new Date().toISOString(), appId: config.appId,
        artifact: output.split(/[\\/]/).at(-1),
        sha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
        targetSdk: 36, minSdk: 24, nativeGoogleConfigured: googleEnabled,
        versionCode: 1, versionName: '1.0.0',
        signedFor: signedRelease ? 'release upload key' : isBundle ? 'unsigned; not for publication' : 'debug key',
        origin: 'https://localhost', developerTools: false,
      };
      writeFileSync(`${output}.receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
      console.log(`Created ${output}`);
      if (task === 'install') run(join(sdk, 'platform-tools/adb'), ['install', '-r', output]);
    }
  }
}
