import { useState, useCallback, useEffect, useRef } from 'react';
import { createDiagnosticId, diagnosticNow, emitDiagnostic, getDiagnosticStateFields, getErrorClass } from '../diagnostics';
import { validateHydratedSave } from '../stateValidation';
import { setFirebaseIdTokenProvider } from '../firebaseToken';
import { summarizeAuthUser, prepareEmailCredential } from './authHelpers';
import { createSaveQueue } from './saveQueue';
import { runExclusiveAuthOperation, waitForAuthOperation } from './authOperations';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const admitsSave = data => isRecord(data) && (isRecord(data.character)
  || (data.character === null && data.isDead === false));
const readyModes = ['loaded', 'missing', 'local'];
const stale = () => ({ ok: false, reason: 'stale' });

/** Owns session/read readiness and transport; useGameState owns the life. */
export function useCloudAccount({ hydrateFromSave, clearLocalLife, ignoreCloudLoadRef, setCareersData, lifeRevisionRef }) {
  const cloudSyncRef = useRef(null);
  const accountGenerationRef = useRef(0);
  const backendModulesRef = useRef(null);
  const saveQueueRef = useRef(null);
  if (saveQueueRef.current === null) saveQueueRef.current = createSaveQueue();
  const [authAccount, setAuthAccount] = useState(null);
  const [cloudLoadState, setCloudLoadState] = useState({ status: 'loading', accountId: null, reason: null });
  const loadStateRef = useRef(cloudLoadState);
  const activeReadRef = useRef(null);
  const initializationRef = useRef(0);
  const lifecycleRef = useRef(0);
  const mountedRef = useRef(false);
  const observerCleanupRef = useRef(null);

  const publish = useCallback((status, accountId = null, reason = null) => {
    loadStateRef.current = { status, accountId, reason };
    setCloudLoadState(loadStateRef.current);
  }, []);

  // Share imports across StrictMode restarts and explicit commands.
  const loadBackendModules = useCallback(() => {
    backendModulesRef.current ??= Promise.all([
      import('../../config/firebase'), import('firebase/auth'), import('firebase/firestore'),
    ]).catch(error => { backendModulesRef.current = null; throw error; });
    return backendModulesRef.current;
  }, []);

  const getAuthBackend = useCallback(async () => {
    const [config, authApi, firestoreApi] = await loadBackendModules();
    if (!config.auth || !config.db) return null;
    return { auth: config.auth, db: config.db, authApi, ...firestoreApi };
  }, [loadBackendModules]);

  const canReplaceLife = useCallback(() => {
    const state = loadStateRef.current;
    return mountedRef.current && readyModes.includes(state.status)
      && (state.status === 'local' || state.accountId === cloudSyncRef.current?.userId);
  }, []);

  const readAccount = useCallback(async (backend, uid) => {
    const attempt = {
      generation: accountGenerationRef.current, lifecycle: lifecycleRef.current,
      revision: lifeRevisionRef?.current,
    };
    activeReadRef.current = attempt;
    ignoreCloudLoadRef.current = false;
    publish('loading', uid);
    const owns = (checkRevision = true) => mountedRef.current && activeReadRef.current === attempt
      && lifecycleRef.current === attempt.lifecycle && accountGenerationRef.current === attempt.generation
      && cloudSyncRef.current?.userId === uid
      && (!checkRevision || lifeRevisionRef?.current === attempt.revision);
    const operationId = createDiagnosticId('save-load');
    const startedAt = diagnosticNow();
    const diagnostic = (status, fields = [], errorClass) => emitDiagnostic('save_load', {
      operationId, status, durationMs: diagnosticNow() - startedAt, fields,
      ...(errorClass ? { errorClass } : {}),
    });
    diagnostic('started');
    try {
      const snapshot = await backend.getDoc(backend.doc(backend.db, 'users', uid, 'saves', 'currentLife'));
      if (!owns() || ignoreCloudLoadRef.current) return stale();
      if (!snapshot.exists()) {
        publish('missing', uid);
        diagnostic('not_found');
        return { ok: true, mode: 'missing' };
      }
      const data = snapshot.data();
      if (!admitsSave(data)) {
        publish('failed', uid, 'invalid_save');
        diagnostic('failed', [], 'InvalidSave');
        return { ok: false, reason: 'error' };
      }
      const validation = validateHydratedSave(data);
      hydrateFromSave(data);
      // Hydration deliberately advances lifeRevision. Finish this owned
      // synchronous transition without mistaking that increment for a race.
      if (!owns(false)) return stale();
      publish('loaded', uid);
      diagnostic(validation.hasWarnings ? 'loaded_with_warnings' : 'loaded',
        validation.hasWarnings ? validation.warningFields : getDiagnosticStateFields(data));
      return { ok: true, mode: 'loaded' };
    } catch (error) {
      if (!owns()) return stale();
      publish('failed', uid, 'read_failed');
      diagnostic('failed', [], getErrorClass(error));
      return { ok: false, reason: 'error' };
    } finally {
      if (activeReadRef.current === attempt) activeReadRef.current = null;
    }
  }, [hydrateFromSave, ignoreCloudLoadRef, lifeRevisionRef, publish]);

  const adoptAndRead = useCallback((user, backend, clear = false) => {
    const sameOwnedAccount = cloudSyncRef.current?.userId === user.uid
      && loadStateRef.current.accountId === user.uid;
    if (!sameOwnedAccount) {
      accountGenerationRef.current += 1;
      activeReadRef.current = null;
      publish('loading', user.uid);
      if (clear) clearLocalLife();
    }
    cloudSyncRef.current = { ...backend, userId: user.uid };
    setFirebaseIdTokenProvider(() => user.getIdToken());
    setAuthAccount(summarizeAuthUser(user));
    // Same-UID linking must keep both a failed state and an active read intact.
    return sameOwnedAccount ? null : readAccount(backend, user.uid);
  }, [clearLocalLife, publish, readAccount]);

  const initialize = useCallback(async () => {
    const intent = ++initializationRef.current;
    const lifecycle = lifecycleRef.current;
    const owns = () => mountedRef.current && lifecycleRef.current === lifecycle && initializationRef.current === intent;
    publish('loading');
    try {
      const backend = await getAuthBackend();
      if (!owns()) return stale();
      if (!backend) { publish('local'); return { ok: true, mode: 'local' }; }
      const { auth, authApi } = backend;
      const observed = await new Promise((resolve, reject) => {
        const unsubscribe = authApi.onAuthStateChanged(auth, resolve, reject);
        observerCleanupRef.current = () => {
          unsubscribe?.();
          // Unsubscribing cannot leave an externally awaited retry pending.
          // The initialization intent/lifecycle check converts this to stale.
          resolve(undefined);
        };
      });
      if (!owns()) return stale();
      observerCleanupRef.current?.();
      observerCleanupRef.current = null;
      // A previous hook may still be changing the shared provider. Its final
      // currentUser, rather than a stale observer value, determines adoption.
      await waitForAuthOperation(auth);
      if (!owns()) return stale();
      let user = auth.currentUser;
      if (!user) {
        if (observed !== null) throw new Error('Auth restoration incomplete');
        const mutation = await runExclusiveAuthOperation(auth, async () => {
          if (!owns()) return null;
          return (await authApi.signInAnonymously(auth)).user;
        });
        if (!owns()) return stale();
        if (mutation.busy) {
          await waitForAuthOperation(auth);
          if (!owns()) return stale();
          user = auth.currentUser;
        } else user = mutation.value;
      }
      if (!owns()) return stale();
      if (!user) throw new Error('Auth restoration incomplete');
      const reading = adoptAndRead(user, backend);
      backend.getDocs(backend.collection(backend.db, 'careers')).then(snapshot => {
        if (mountedRef.current && lifecycleRef.current === lifecycle && !snapshot.empty) setCareersData(snapshot.docs.map(item => item.data()));
      }).catch(console.error);
      return reading ? await reading : { ok: true, mode: loadStateRef.current.status };
    } catch (error) {
      if (!owns()) return stale();
      observerCleanupRef.current?.();
      observerCleanupRef.current = null;
      publish('failed', cloudSyncRef.current?.userId ?? null, 'auth_failed');
      emitDiagnostic('save_load', { operationId: createDiagnosticId('save-load'), status: 'failed', durationMs: 0, fields: [], errorClass: getErrorClass(error) });
      return { ok: false, reason: 'error' };
    }
  }, [adoptAndRead, getAuthBackend, publish, setCareersData]);

  useEffect(() => {
    mountedRef.current = true;
    initialize();
    return () => {
      mountedRef.current = false;
      lifecycleRef.current += 1;
      initializationRef.current += 1;
      activeReadRef.current = null;
      observerCleanupRef.current?.();
      observerCleanupRef.current = null;
      setFirebaseIdTokenProvider(null);
    };
  }, [initialize]);

  const retryCloudLoad = useCallback(() => {
    const state = loadStateRef.current;
    if (canReplaceLife()) return Promise.resolve({ ok: true, mode: state.status });
    if (state.status === 'loading') return Promise.resolve({ ok: false, reason: 'busy' });
    if (!mountedRef.current) return Promise.resolve(stale());
    const transport = cloudSyncRef.current;
    return transport ? readAccount(transport, transport.userId) : initialize();
  }, [canReplaceLife, initialize, readAccount]);
  /**
   * Acknowledged saves are serialized per account on this device, including
   * life-boundary replacements. Capturing the target and payload now prevents
   * later account changes or caller mutations from redirecting queued writes.
   */
  const syncToCloud = useCallback((stateData, options = {}) => {
    const operationId = createDiagnosticId('save-sync');
    const saveStartedAt = diagnosticNow();
    const fields = getDiagnosticStateFields(stateData);
    const transport = cloudSyncRef.current;
    const receipt = (status, errorClass = null) => ({ status, operationId, errorClass });
    if (!canReplaceLife()) {
      emitDiagnostic('save_sync', {
        operationId, status: 'skipped', durationMs: diagnosticNow() - saveStartedAt,
        fields, errorClass: 'AccountLoadBlocked',
      });
      return Promise.resolve(receipt('skipped', 'AccountLoadBlocked'));
    }
    if (!transport) {
      emitDiagnostic('save_sync', {
        operationId, status: 'skipped', durationMs: diagnosticNow() - saveStartedAt, fields,
      });
      return Promise.resolve(receipt('skipped'));
    }

    let payload, writeOptions;
    try {
      payload = structuredClone(stateData);
      // Replace supplied top-level maps; preserve omitted legacy fields.
      writeOptions = { mergeFields: Object.keys(payload) };
    } catch (error) {
      emitDiagnostic('save_sync', {
        operationId, status: 'failed', durationMs: diagnosticNow() - saveStartedAt,
        fields, errorClass: getErrorClass(error),
      });
      return Promise.resolve(receipt('failed', getErrorClass(error)));
    }
    const replace = !!options.replace;
    const destinationKey = `users/${transport.userId}/saves/currentLife`;
    emitDiagnostic('save_sync', {
      operationId, status: 'started', durationMs: diagnosticNow() - saveStartedAt, fields,
    });
    return saveQueueRef.current.enqueue(destinationKey, {
      operationId,
      write: () => {
        const saveRef = transport.doc(transport.db, 'users', transport.userId, 'saves', 'currentLife');
        return replace
          ? transport.setDoc(saveRef, payload)
          : transport.setDoc(saveRef, payload, writeOptions);
      },
    }).then(saved => {
      emitDiagnostic('save_sync', {
        operationId, status: saved.status, durationMs: diagnosticNow() - saveStartedAt,
        fields, errorClass: saved.errorClass,
      });
      return saved;
    });
  }, [canReplaceLife]);


  // Hold the provider mutex only through mutation/adoption, never through a
  // Firestore read. An accepted explicit intent supersedes pre-adoption boot.
  const changeSession = async work => {
    const lifecycle = lifecycleRef.current;
    try {
      const backend = await getAuthBackend();
      if (!mountedRef.current || lifecycleRef.current !== lifecycle) return stale();
      if (!backend) return { ok: false, reason: 'unavailable' };
      const mutation = await runExclusiveAuthOperation(backend.auth, async () => {
        initializationRef.current += 1;
        observerCleanupRef.current?.();
        observerCleanupRef.current = null;
        const owns = () => mountedRef.current && lifecycleRef.current === lifecycle;
        const adopt = user => owns() ? adoptAndRead(user, backend, true) : null;
        return work(backend, adopt, owns);
      });
      if (mutation.busy) return { ok: false, reason: 'busy' };
      if (!mountedRef.current || lifecycleRef.current !== lifecycle) return stale();
      const { outcome, reading } = mutation.value;
      if (!outcome.ok && !cloudSyncRef.current) publish('failed', null, 'auth_failed');
      if (reading) {
        const loaded = await reading;
        if (!loaded.ok) return loaded;
      }
      return outcome;
    } catch {
      if (!mountedRef.current || lifecycleRef.current !== lifecycle) return stale();
      if (!cloudSyncRef.current) publish('failed', null, 'auth_failed');
      return { ok: false, reason: 'error' };
    }
  };

  const signInWithGoogle = () => changeSession(async (backend, adopt, owns) => {
    const { auth, authApi } = backend;
    const { GoogleAuthProvider, linkWithPopup, signInWithPopup, signInWithCredential } = authApi;
    const provider = new GoogleAuthProvider();
    let user, mode;
    try {
      const current = auth.currentUser;
      if (current && !current.isAnonymous) { user = current; mode = 'already'; }
      else if (current) { user = (await linkWithPopup(current, provider)).user; mode = 'linked'; }
      else { user = (await signInWithPopup(auth, provider)).user; mode = 'signed_in'; }
    } catch (error) {
      if (!owns()) return { outcome: stale() };
      if (error?.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (!credential) return { outcome: { ok: false, reason: 'error' } };
        user = (await signInWithCredential(auth, credential)).user;
        mode = 'switched';
      } else if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked'].includes(error?.code)) {
        return { outcome: { ok: false, reason: 'cancelled' } };
      } else throw error;
    }
    return { outcome: { ok: true, mode }, reading: adopt(user) };
  });

  const signInWithEmail = async (email, password, mode = 'signup') => {
    const input = prepareEmailCredential(email, password);
    if (!input.ok) return input;
    return changeSession(async (backend, adopt) => {
      const { auth, authApi } = backend;
      const current = auth.currentUser;
      let user, outcomeMode;
      try {
        if (mode === 'signin') {
          user = (await authApi.signInWithEmailAndPassword(auth, input.email, password)).user;
          outcomeMode = 'switched';
        } else if (current && !current.isAnonymous) { user = current; outcomeMode = 'already'; }
        else if (current) {
          const credential = authApi.EmailAuthProvider.credential(input.email, password);
          user = (await authApi.linkWithCredential(current, credential)).user;
          outcomeMode = 'linked';
        } else {
          user = (await authApi.createUserWithEmailAndPassword(auth, input.email, password)).user;
          outcomeMode = 'signed_in';
        }
      } catch (error) {
        const reasons = {
          'auth/email-already-in-use': 'email_in_use', 'auth/credential-already-in-use': 'email_in_use',
          'auth/invalid-credential': 'invalid_credentials', 'auth/wrong-password': 'invalid_credentials',
          'auth/user-not-found': 'invalid_credentials', 'auth/weak-password': 'weak_password',
          'auth/invalid-email': 'invalid_email', 'auth/too-many-requests': 'rate_limited',
          'auth/operation-not-allowed': 'unavailable',
        };
        if (!cloudSyncRef.current) publish('failed', null, 'auth_failed');
        return { outcome: { ok: false, reason: reasons[error?.code] ?? 'error' } };
      }
      return { outcome: { ok: true, mode: outcomeMode }, reading: adopt(user) };
    });
  };

  /** Password reset never reveals whether an address has an account. */
  const resetPassword = async email => {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    if (!cleanEmail) return { ok: false, reason: 'invalid_email' };
    try {
      const backend = await getAuthBackend();
      if (!backend) return { ok: false, reason: 'unavailable' };
      try {
        await backend.authApi.sendPasswordResetEmail(backend.auth, cleanEmail);
        return { ok: true };
      } catch (error) {
        if (error?.code === 'auth/user-not-found') return { ok: true };
        return { ok: false, reason: error?.code === 'auth/invalid-email' ? 'invalid_email' : 'error' };
      }
    } catch { return { ok: false, reason: 'error' }; }
  };

  const signOutAccount = () => changeSession(async (backend, adopt, owns) => {
    const { auth, authApi } = backend;
    if (auth.currentUser?.isAnonymous) {
      return { outcome: { ok: true, mode: 'already_guest' }, reading: adopt(auth.currentUser) };
    }
    if (auth.currentUser) await authApi.signOut(auth);
    if (!owns()) return { outcome: stale() };
    accountGenerationRef.current += 1;
    activeReadRef.current = null;
    cloudSyncRef.current = null;
    publish('loading');
    setFirebaseIdTokenProvider(null);
    setAuthAccount(null);
    clearLocalLife();
    const credential = await authApi.signInAnonymously(auth);
    // The origin was already cleared at provider success.
    const reading = owns() ? adoptAndRead(credential.user, backend) : null;
    return { outcome: { ok: true, mode: 'signed_out' }, reading };
  });

  return { syncToCloud, authAccount, cloudLoadState, retryCloudLoad, canReplaceLife,
    signInWithGoogle, signInWithEmail, resetPassword, signOutAccount };
}
