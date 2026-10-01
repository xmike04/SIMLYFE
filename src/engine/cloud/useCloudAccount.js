import { useState, useCallback, useEffect } from 'react';
import { createDiagnosticId, diagnosticNow, emitDiagnostic, getDiagnosticStateFields, getErrorClass } from '../diagnostics';
import { validateHydratedSave } from '../stateValidation';
import { setFirebaseIdTokenProvider } from '../firebaseToken';
import { summarizeAuthUser, prepareEmailCredential } from './authHelpers';
import { isAndroidNative } from '../../platform/nativeRuntime';
import { getNativeGoogleCredential, isNativeGoogleCancellation } from '../../platform/nativeGoogle';

/**
 * Owns the Firebase session and transport, never the player's life state.
 * The parent supplies stable hydration/clear callbacks and keeps its snapshot
 * and life-boundary guard so save replacement remains explicit at start/reset.
 */
export function useCloudAccount({ hydrateFromSave, clearLocalLife, ignoreCloudLoadRef, setCareersData }) {
  const [cloudSync, setCloudSync] = useState(null);
  const [authAccount, setAuthAccount] = useState(null);

  // 1. Adopt the persisted auth session (or start an anonymous one) and load
  // the cloud save if configured
  useEffect(() => {
    let cancelled = false;
    let unsubscribeFirstAuth = null;
    setFirebaseIdTokenProvider(null);
    const loadOperationId = createDiagnosticId('save-load');
    const loadStartedAt = diagnosticNow();

    async function initCloudSync() {
      try {
        const [
          firebaseConfig,
          authApi,
          firestoreApi,
        ] = await Promise.all([
          import('../../config/firebase'),
          import('firebase/auth'),
          import('firebase/firestore'),
        ]);

        const { auth, db } = firebaseConfig;
        if (cancelled) return;
        if (!auth || !db) {
          emitDiagnostic('save_load', {
            operationId: loadOperationId,
            status: 'skipped',
            durationMs: diagnosticNow() - loadStartedAt,
            fields: [],
          });
          return;
        }

        const { signInAnonymously, onAuthStateChanged } = authApi;
        const { doc, setDoc, getDoc, collection, getDocs } = firestoreApi;

        emitDiagnostic('save_load', {
          operationId: loadOperationId,
          status: 'started',
          durationMs: 0,
          fields: [],
        });

        // Adopt a persisted session (anonymous or Google-linked) so returning
        // players keep their uid; only first-time visitors mint a new
        // anonymous account. signInAnonymously would replace a Google session.
        const persistedUser = await new Promise((resolve) => {
          unsubscribeFirstAuth = onAuthStateChanged(auth, resolve, () => resolve(null));
        });
        unsubscribeFirstAuth?.();
        unsubscribeFirstAuth = null;
        const user = persistedUser ?? (await signInAnonymously(auth)).user;
        if (cancelled) return;

        setFirebaseIdTokenProvider(() => user.getIdToken());
        setCloudSync({ db, userId: user.uid, doc, setDoc });
        setAuthAccount(summarizeAuthUser(user));

        try {
          const saveRef = doc(db, 'users', user.uid, 'saves', 'currentLife');
          const saveSnap = await getDoc(saveRef);
          if (cancelled) return;
          if (!ignoreCloudLoadRef.current && saveSnap.exists()) {
            const data = saveSnap.data();
            const validation = validateHydratedSave(data);
            hydrateFromSave(data);
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: validation.hasWarnings ? 'loaded_with_warnings' : 'loaded',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: validation.hasWarnings
                ? validation.warningFields
                : getDiagnosticStateFields(data),
            });
          } else if (!ignoreCloudLoadRef.current) {
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: 'not_found',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: [],
            });
          }
        } catch (e) {
          if (!cancelled) {
            emitDiagnostic('save_load', {
              operationId: loadOperationId,
              status: 'failed',
              durationMs: diagnosticNow() - loadStartedAt,
              fields: [],
              errorClass: getErrorClass(e),
            });
          }
        }

        getDocs(collection(db, 'careers')).then(snapshot => {
          if (!cancelled && !snapshot.empty) setCareersData(snapshot.docs.map(skip => skip.data()));
        }).catch(console.error);
      } catch (error) {
        if (!cancelled) {
          emitDiagnostic('save_load', {
            operationId: loadOperationId,
            status: 'failed',
            durationMs: diagnosticNow() - loadStartedAt,
            fields: [],
            errorClass: getErrorClass(error),
          });
        }
      }
    }

    initCloudSync();
    return () => {
      cancelled = true;
      unsubscribeFirstAuth?.();
      setFirebaseIdTokenProvider(null);
    };
  }, [hydrateFromSave, ignoreCloudLoadRef, setCareersData]);

  // 2. Sync to Cloud — pass { replace: true } on life boundaries to wipe stale fields
  const syncToCloud = useCallback(async (stateData, options = {}) => {
    const saveOperationId = createDiagnosticId('save-sync');
    const saveStartedAt = diagnosticNow();
    const fields = getDiagnosticStateFields(stateData);
    if (!cloudSync) {
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'skipped',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
      });
      return;
    }
    emitDiagnostic('save_sync', {
      operationId: saveOperationId,
      status: 'started',
      durationMs: 0,
      fields,
    });
    try {
      const saveRef = cloudSync.doc(cloudSync.db, 'users', cloudSync.userId, 'saves', 'currentLife');
      if (options.replace) {
        await cloudSync.setDoc(saveRef, stateData);
      } else {
        await cloudSync.setDoc(saveRef, stateData, { merge: true });
      }
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'saved',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
      });
    } catch (e) {
      emitDiagnostic('save_sync', {
        operationId: saveOperationId,
        status: 'failed',
        durationMs: diagnosticNow() - saveStartedAt,
        fields,
        errorClass: getErrorClass(e),
      });
    }
  }, [cloudSync]);

  /**
   * Shared backend loader for account actions (Google, email, sign-out).
   * Returns null when Firebase is unconfigured; otherwise auth handles plus
   * `adopt` (rebind token provider / cloud sync / authAccount to a user) and
   * `loadAccountSave` (clear local life, hydrate the uid's cloud save).
   */
  const getAuthBackend = async () => {
    const [firebaseConfig, authApi, firestoreApi] = await Promise.all([
      import('../../config/firebase'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const { auth, db } = firebaseConfig;
    if (!auth || !db) return null;
    const adopt = (user) => {
      setFirebaseIdTokenProvider(() => user.getIdToken());
      setCloudSync({ db, userId: user.uid, doc: firestoreApi.doc, setDoc: firestoreApi.setDoc });
      setAuthAccount(summarizeAuthUser(user));
    };
    const loadAccountSave = async (uid) => {
      clearLocalLife();
      const snap = await firestoreApi.getDoc(firestoreApi.doc(db, 'users', uid, 'saves', 'currentLife'));
      if (snap.exists()) hydrateFromSave(snap.data());
    };
    return { auth, authApi, adopt, loadAccountSave };
  };

  /**
   * Google sign-in for cloud saves. An anonymous player is LINKED (same uid —
   * the current life survives untouched). If the Google account already
   * belongs to another uid, we SWITCH to that account and load its save
   * instead. Returns { ok: true, mode } or { ok: false, reason } — reasons
   * are sanitized codes, never raw provider errors.
   */
  const signInWithGoogle = async () => {
    try {
      const backend = await getAuthBackend();
      if (!backend) return { ok: false, reason: 'unavailable' };
      const { auth, authApi, adopt, loadAccountSave } = backend;
      const { GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithCredential } = authApi;

      const provider = new GoogleAuthProvider();
      const current = auth.currentUser;
      let nativeCredential;
      try {
        if (current && !current.isAnonymous) return { ok: true, mode: 'already' };
        if (isAndroidNative()) nativeCredential = await getNativeGoogleCredential(authApi);
        if (current) {
          const result = nativeCredential
            ? await authApi.linkWithCredential(current, nativeCredential)
            : await linkWithPopup(current, provider);
          adopt(result.user); // same uid — the in-progress life is untouched
          return { ok: true, mode: 'linked' };
        }
        const result = nativeCredential
          ? await signInWithCredential(auth, nativeCredential)
          : await signInWithPopup(auth, provider);
        adopt(result.user);
        await loadAccountSave(result.user.uid);
        return { ok: true, mode: 'signed_in' };
      } catch (e) {
        if (e?.code === 'auth/credential-already-in-use') {
          // This Google account already owns a save under another uid — switch to it.
          const credential = nativeCredential ?? GoogleAuthProvider.credentialFromError(e);
          if (!credential) return { ok: false, reason: 'error' };
          const result = await signInWithCredential(auth, credential);
          adopt(result.user);
          await loadAccountSave(result.user.uid);
          return { ok: true, mode: 'switched' };
        }
        if (e?.code === 'auth/native-google-unavailable') return { ok: false, reason: 'native_google_unavailable' };
        if (isAndroidNative() && isNativeGoogleCancellation(e)) return { ok: false, reason: 'cancelled' };
        if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request' || e?.code === 'auth/popup-blocked') {
          return { ok: false, reason: 'cancelled' };
        }
        return { ok: false, reason: 'error' };
      }
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  /**
   * Email/password auth. mode 'signup' links the anonymous player (same uid —
   * the current life survives untouched) or creates a fresh account; mode
   * 'signin' switches to the existing account and loads its cloud save.
   * Sanitized reasons only — raw provider errors never surface.
   */
  const signInWithEmail = async (email, password, mode = 'signup') => {
    const input = prepareEmailCredential(email, password);
    if (!input.ok) return input;
    try {
      const backend = await getAuthBackend();
      if (!backend) return { ok: false, reason: 'unavailable' };
      const { auth, authApi, adopt, loadAccountSave } = backend;
      const { EmailAuthProvider, linkWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword } = authApi;
      const current = auth.currentUser;
      try {
        if (mode === 'signin') {
          const result = await signInWithEmailAndPassword(auth, input.email, password);
          adopt(result.user);
          await loadAccountSave(result.user.uid);
          return { ok: true, mode: 'switched' };
        }
        if (current && !current.isAnonymous) return { ok: true, mode: 'already' };
        if (current) {
          const credential = EmailAuthProvider.credential(input.email, password);
          const result = await linkWithCredential(current, credential);
          adopt(result.user); // same uid — the in-progress life is untouched
          return { ok: true, mode: 'linked' };
        }
        const result = await createUserWithEmailAndPassword(auth, input.email, password);
        adopt(result.user);
        await loadAccountSave(result.user.uid);
        return { ok: true, mode: 'signed_in' };
      } catch (e) {
        const code = e?.code ?? '';
        if (code === 'auth/email-already-in-use' || code === 'auth/credential-already-in-use') {
          return { ok: false, reason: 'email_in_use' };
        }
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          return { ok: false, reason: 'invalid_credentials' };
        }
        if (code === 'auth/weak-password') return { ok: false, reason: 'weak_password' };
        if (code === 'auth/invalid-email') return { ok: false, reason: 'invalid_email' };
        if (code === 'auth/too-many-requests') return { ok: false, reason: 'rate_limited' };
        if (code === 'auth/operation-not-allowed') return { ok: false, reason: 'unavailable' };
        return { ok: false, reason: 'error' };
      }
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  /** Password-reset email. Never reveals whether the address has an account. */
  const resetPassword = async (email) => {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    if (!cleanEmail) return { ok: false, reason: 'invalid_email' };
    try {
      const backend = await getAuthBackend();
      if (!backend) return { ok: false, reason: 'unavailable' };
      try {
        await backend.authApi.sendPasswordResetEmail(backend.auth, cleanEmail);
        return { ok: true };
      } catch (e) {
        if (e?.code === 'auth/user-not-found') return { ok: true };
        if (e?.code === 'auth/invalid-email') return { ok: false, reason: 'invalid_email' };
        return { ok: false, reason: 'error' };
      }
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  /**
   * Sign out on this device: a fresh anonymous session starts and the local
   * life clears. The signed-in account's cloud save is left untouched.
   */
  const signOutAccount = async () => {
    try {
      const backend = await getAuthBackend();
      if (!backend) return { ok: false, reason: 'unavailable' };
      const { auth, authApi, adopt } = backend;
      if (auth.currentUser?.isAnonymous) return { ok: true, mode: 'already_guest' };
      await authApi.signOut(auth);
      const cred = await authApi.signInAnonymously(auth);
      adopt(cred.user);
      clearLocalLife();
      return { ok: true, mode: 'signed_out' };
    } catch {
      return { ok: false, reason: 'error' };
    }
  };

  return { syncToCloud, authAccount, signInWithGoogle, signInWithEmail, resetPassword, signOutAccount };
}
