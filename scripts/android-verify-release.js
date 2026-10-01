#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? '/opt/homebrew/share/android-commandlinetools';
const java = process.env.JAVA_HOME ?? '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const output = join(root, 'artifacts/android');
const expected = JSON.parse(readFileSync(join(root, 'android/signing-certificates.json'), 'utf8')).find(cert => cert.name === 'upload');
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} verification failed (${result.status}).`);
  return result.stdout;
}
const apk = join(output, 'SIMLYFE-release.apk');
const aab = join(output, 'SIMLYFE-release.aab');
const signer = run(join(sdk, 'build-tools/36.0.0/apksigner'), ['verify', '--verbose', '--print-certs', apk]);
const apkCertificate = signer.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1].toLowerCase();
if (apkCertificate !== expected.sha256) throw new Error('APK signer does not match the registered upload certificate.');
const verification = run(join(java, 'bin/jarsigner'), ['-verify', aab]);
if (!verification.includes('jar verified.')) throw new Error('AAB signature was not verified.');
const pem = run(join(java, 'bin/keytool'), ['-printcert', '-rfc', '-jarfile', aab]);
const aabCertificate = new X509Certificate(pem).fingerprint256.replaceAll(':', '').toLowerCase();
if (aabCertificate !== expected.sha256) throw new Error('AAB signer does not match the registered upload certificate.');
const manifest = run(join(sdk, 'build-tools/36.0.0/aapt'), ['dump', 'xmltree', apk, 'AndroidManifest.xml']);
for (const flag of ['debuggable', 'allowBackup', 'usesCleartextTraffic']) {
  const line = manifest.split('\n').find(item => item.includes(`android:${flag}(`));
  if ((flag !== 'debuggable' && !line) || (line && !line.includes('(type 0x12)0x0'))) {
    throw new Error(`Release manifest ${flag} is not disabled.`);
  }
}
const badging = run(join(sdk, 'build-tools/36.0.0/aapt'), ['dump', 'badging', apk]);
if (!badging.includes("name='com.simlyfe.app'") || !badging.includes("targetSdkVersion:'36'")) throw new Error('Unexpected release identity or target SDK.');
const artifacts = [apk, aab].map(path => ({ artifact: path.split('/').at(-1), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
const receipt = { verifiedAt: new Date().toISOString(), status: 'passed', artifacts, certificateSha256: expected.sha256,
  appId: 'com.simlyfe.app', targetSdk: 36, debuggable: false, backupAllowed: false, cleartextAllowed: false,
  checks: ['APK cryptographic signature', 'AAB cryptographic signature', 'both signers match registered upload certificate', 'release manifest security flags and app identity'],
};
writeFileSync(join(output, 'release-verification.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
