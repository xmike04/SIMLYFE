import { useEffect } from 'react';
import { ANDROID_BACK_EVENT } from './nativeRuntime';

export function useAndroidBack(handler) {
  useEffect(() => {
    const onBack = event => {
      if (handler()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener(ANDROID_BACK_EVENT, onBack);
    return () => document.removeEventListener(ANDROID_BACK_EVENT, onBack);
  }, [handler]);
}
