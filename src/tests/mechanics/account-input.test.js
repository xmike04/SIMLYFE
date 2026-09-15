/** account input mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { summarizeAuthUser, prepareEmailCredential } from '../../engine/cloud/authHelpers';

describe('summarizeAuthUser', () => {
  it('returns null for no user', () => {
    expect(summarizeAuthUser(null)).toBeNull();
    expect(summarizeAuthUser(undefined)).toBeNull();
  });

  it('summarizes an anonymous user with null profile fields', () => {
    expect(summarizeAuthUser({ uid: 'anon-1', isAnonymous: true })).toEqual({
      uid: 'anon-1', isAnonymous: true, provider: 'anonymous', name: null, email: null, photo: null,
    });
  });

  it('summarizes a Google-linked user', () => {
    const user = {
      uid: 'g-1',
      isAnonymous: false,
      providerData: [{ providerId: 'google.com' }],
      displayName: 'Alex Morgan',
      email: 'alex@example.com',
      photoURL: 'https://example.com/p.jpg',
    };
    expect(summarizeAuthUser(user)).toEqual({
      uid: 'g-1', isAnonymous: false, provider: 'google.com', name: 'Alex Morgan', email: 'alex@example.com', photo: 'https://example.com/p.jpg',
    });
  });

  it('summarizes an email/password user', () => {
    const user = { uid: 'e-1', isAnonymous: false, providerData: [{ providerId: 'password' }], email: 'sim@example.com' };
    expect(summarizeAuthUser(user)).toMatchObject({ provider: 'password', email: 'sim@example.com' });
  });

  it('coerces a missing isAnonymous flag to false with unknown provider', () => {
    const summary = summarizeAuthUser({ uid: 'u1' });
    expect(summary.isAnonymous).toBe(false);
    expect(summary.provider).toBe('unknown');
  });
});

describe('prepareEmailCredential', () => {
  it('accepts a valid pair and trims the email', () => {
    expect(prepareEmailCredential('  sim@example.com ', 'secret1')).toEqual({ ok: true, email: 'sim@example.com' });
  });

  it('rejects malformed or missing emails', () => {
    for (const bad of [null, undefined, '', 'nope', 'a@b', 'has space@x.com', 42]) {
      expect(prepareEmailCredential(bad, 'secret1')).toEqual({ ok: false, reason: 'invalid_email' });
    }
  });

  it('rejects short or non-string passwords', () => {
    for (const bad of [null, undefined, '', '12345', 123456]) {
      expect(prepareEmailCredential('sim@example.com', bad)).toEqual({ ok: false, reason: 'weak_password' });
    }
  });
});
