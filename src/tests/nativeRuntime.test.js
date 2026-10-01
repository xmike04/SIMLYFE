import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANDROID_BACK_EVENT, installAndroidBackListener, startNativeRuntime } from '../platform/nativeRuntime';

const native = vi.hoisted(() => ({ enabled: false, platform: 'web', addListener: vi.fn(), remove: vi.fn(), minimize: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: {
  isNativePlatform: () => native.enabled, getPlatform: () => native.platform,
} }));
vi.mock('@capacitor/app', () => ({ App: { addListener: native.addListener, minimizeApp: native.minimize } }));
beforeEach(() => {
  vi.clearAllMocks();
  native.enabled = true;
  native.platform = 'android';
  native.remove.mockResolvedValue();
  native.addListener.mockResolvedValue({ remove: native.remove });
});
afterEach(() => vi.restoreAllMocks());

describe('Android Back bridge', () => {
  it.each([[false, 'web'], [true, 'ios']])('does not install Android listeners on other platforms', async (enabled, platform) => {
    native.enabled = enabled;
    native.platform = platform;
    const remove = await installAndroidBackListener(new EventTarget());
    remove();
    expect(native.addListener).not.toHaveBeenCalled();
  });

  it('lets a view consume Back, then backgrounds an unhandled root without exiting', async () => {
    const target = new EventTarget();
    const consume = event => event.preventDefault();
    target.addEventListener(ANDROID_BACK_EVENT, consume);
    const cleanup = await installAndroidBackListener(target);
    const back = native.addListener.mock.calls[0][1];
    await back();
    expect(native.minimize).not.toHaveBeenCalled();
    target.removeEventListener(ANDROID_BACK_EVENT, consume);
    await back();
    expect(native.minimize).toHaveBeenCalledOnce();
    await cleanup();
    expect(native.remove).toHaveBeenCalledOnce();
  });

  it('removes a listener that resolves after unmount (including StrictMode cleanup)', async () => {
    let resolve;
    native.addListener.mockReturnValue(new Promise(done => { resolve = done; }));
    const cleanup = startNativeRuntime(new EventTarget());
    cleanup();
    await vi.waitFor(() => expect(native.addListener).toHaveBeenCalledOnce());
    resolve({ remove: native.remove });
    await vi.waitFor(() => expect(native.remove).toHaveBeenCalledOnce());
  });
});
