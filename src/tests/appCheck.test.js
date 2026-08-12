import { describe, it, expect } from 'vitest';
import { getAppCheckSetup } from '../config/appCheck';

describe('getAppCheckSetup', () => {
  it('stays disabled without a site key', () => {
    expect(getAppCheckSetup({})).toEqual({ enabled: false, siteKey: null, debugToken: null });
    expect(getAppCheckSetup(undefined)).toEqual({ enabled: false, siteKey: null, debugToken: null });
    expect(getAppCheckSetup({ VITE_FIREBASE_APPCHECK_SITE_KEY: '' }))
      .toEqual({ enabled: false, siteKey: null, debugToken: null });
  });

  it('treats PLACEHOLDER keys as unconfigured (mirrors firebase.js apiKey guard)', () => {
    expect(getAppCheckSetup({ VITE_FIREBASE_APPCHECK_SITE_KEY: 'PLACEHOLDER_KEY' }).enabled).toBe(false);
  });

  it('enables with a real site key and no debug token', () => {
    expect(getAppCheckSetup({ VITE_FIREBASE_APPCHECK_SITE_KEY: '6LcSiteKey' }))
      .toEqual({ enabled: true, siteKey: '6LcSiteKey', debugToken: null });
  });

  it('debug token "true" asks the SDK to mint one', () => {
    const setup = getAppCheckSetup({
      VITE_FIREBASE_APPCHECK_SITE_KEY: '6LcSiteKey',
      VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: 'true',
    });
    expect(setup.debugToken).toBe(true);
  });

  it('any other non-empty debug value is used verbatim', () => {
    const setup = getAppCheckSetup({
      VITE_FIREBASE_APPCHECK_SITE_KEY: '6LcSiteKey',
      VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: 'f2a1c0de-1234',
    });
    expect(setup.debugToken).toBe('f2a1c0de-1234');
  });

  it('empty debug value means no debug override', () => {
    const setup = getAppCheckSetup({
      VITE_FIREBASE_APPCHECK_SITE_KEY: '6LcSiteKey',
      VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: '',
    });
    expect(setup.debugToken).toBeNull();
  });
});
