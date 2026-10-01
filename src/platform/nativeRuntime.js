import { Capacitor } from '@capacitor/core';

export const ANDROID_BACK_EVENT = 'simlyfe:android-back';

export function isAndroidNative() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Views consume Back before the shell backgrounds the app. Never reload a life. */
export async function installAndroidBackListener(target = document) {
  if (!isAndroidNative()) return () => {};
  const { App } = await import('@capacitor/app');
  const listener = await App.addListener('backButton', async () => {
    const unhandled = target.dispatchEvent(new CustomEvent(ANDROID_BACK_EVENT, { cancelable: true }));
    if (unhandled) {
      try {
        await App.minimizeApp();
      } catch {
        console.warn('Could not background the app.');
      }
    }
  });
  return () => listener.remove();
}

/** Handles cleanup even when StrictMode unmounts before the native import resolves. */
export function startNativeRuntime(target = document) {
  let disposed = false;
  let remove = null;
  installAndroidBackListener(target).then(cleanup => {
    if (disposed) cleanup();
    else remove = cleanup;
  }).catch(() => console.warn('Android navigation could not be initialized.'));
  return () => {
    disposed = true;
    remove?.();
  };
}
