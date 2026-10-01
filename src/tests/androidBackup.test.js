import { describe, it, expect } from 'vitest';
import { encryptSigningBackup, decryptSigningBackup } from '../../scripts/android-backup.js';

describe('signing backup authentication and recovery', () => {
  it('recovers exact binary key material without exposing it in the envelope', () => {
    const data = Buffer.from('fixture private key material'), key = 'fixture-only-recovery-secret';
    const encrypted = encryptSigningBackup(data, key);
    expect(encrypted.toString()).not.toContain(data.toString());
    expect(encrypted.toString()).not.toContain(key);
    expect(decryptSigningBackup(encrypted, key).equals(data)).toBe(true);
  });
  it('rejects a wrong recovery key and modified ciphertext', () => {
    const encrypted = encryptSigningBackup(Buffer.from('fixture'), 'correct');
    expect(() => decryptSigningBackup(encrypted, 'wrong')).toThrow();
    const changed = JSON.parse(encrypted);
    const bytes = Buffer.from(changed.ciphertext, 'base64'); bytes[0] ^= 1;
    changed.ciphertext = bytes.toString('base64');
    expect(() => decryptSigningBackup(Buffer.from(JSON.stringify(changed)), 'correct')).toThrow();
  });
});
