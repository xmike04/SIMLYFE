#!/usr/bin/env node
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

export function encryptSigningBackup(bytes, recoveryKey) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = scryptSync(recoveryKey, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('SIMLYFE-signing-backup-v1'));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.from(JSON.stringify({ format: 'SIMLYFE-signing-backup-v1', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }));
}

export function decryptSigningBackup(encrypted, recoveryKey) {
  const envelope = JSON.parse(encrypted);
  if (envelope.format !== 'SIMLYFE-signing-backup-v1') throw new Error('Unsupported backup format.');
  const key = scryptSync(recoveryKey, Buffer.from(envelope.salt, 'base64'), 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(envelope.format));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
}

export function createSigningBackup(destination, recoveryFile) {
  const source = join(homedir(), '.config/simlyfe/android-signing');
  // Resolve parents before writing, so a symlink cannot send the key and
  // encrypted archive into the same directory or silently replace a file.
  const archive = join(realpathSync(dirname(resolve(destination))), resolve(destination).split('/').at(-1));
  mkdirSync(dirname(resolve(recoveryFile)), { recursive: true, mode: 0o700 });
  const recovery = join(realpathSync(dirname(resolve(recoveryFile))), resolve(recoveryFile).split('/').at(-1));
  if (dirname(archive) === dirname(recovery) || archive.startsWith(`${source}/`)) throw new Error('Keep the archive and recovery key in separate locations.');
  const files = ['upload.p12', 'ci-debug.keystore', 'release.json'].map(name => ({ name, bytes: readFileSync(join(source, name)).toString('base64') }));
  const plain = Buffer.from(JSON.stringify({ format: 'SIMLYFE-signing-files-v1', files }));
  const key = randomBytes(32).toString('base64url');
  const encrypted = encryptSigningBackup(plain, key);
  if (!timingSafeEqual(createHash('sha256').update(plain).digest(), createHash('sha256').update(decryptSigningBackup(encrypted, key)).digest())) throw new Error('Backup round-trip failed.');
  // Exclusive creation: never replace an existing backup or recovery key.
  writeFileSync(recovery, `${key}\n`, { flag: 'wx', mode: 0o600 });
  writeFileSync(archive, encrypted, { flag: 'wx', mode: 0o600 });
  const restored = decryptSigningBackup(readFileSync(archive), readFileSync(recovery, 'utf8').trim());
  if (!restored.equals(plain)) throw new Error('Stored backup verification failed.');
  return { status: 'verified', archive, recoveryFile: recovery, encryptedSha256: createHash('sha256').update(encrypted).digest('hex'), files: files.map(file => file.name) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) throw new Error('Usage: node scripts/android-backup.js ENCRYPTED_DESTINATION RECOVERY_KEY_FILE');
  console.log(JSON.stringify(createSigningBackup(process.argv[2], process.argv[3]), null, 2));
}
