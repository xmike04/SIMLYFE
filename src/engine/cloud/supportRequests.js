// Support requests are separate from the life save and never change gameplay.
export function contentReportPayload(event, reason) {
  if (!event?.meta?.requestId || typeof event.description !== 'string') return null;
  if (!['offensive', 'unsafe', 'other'].includes(reason)) return null;
  return {
    kind: 'content_report', reason,
    requestId: event.meta.requestId.slice(0, 128),
    description: event.description.slice(0, 4096),
    choiceTexts: (event.choices ?? []).slice(0, 3).map(choice => String(choice.text).slice(0, 300)),
  };
}

export async function submitSupportRequest(payload, backend) {
  const { auth, db, firestoreApi } = backend;
  if (!auth?.currentUser || !db) return { ok: false, reason: 'unavailable' };
  const id = payload.kind === 'account_deletion' ? 'account-deletion' : `event-${payload.requestId}`;
  if (!/^[A-Za-z0-9_-]{1,134}$/.test(id)) return { ok: false, reason: 'invalid_request' };
  const ref = firestoreApi.doc(db, 'users', auth.currentUser.uid, 'supportRequests', id);
  try {
    if ((await firestoreApi.getDoc(ref)).exists()) return { ok: true, mode: 'already_requested' };
    await firestoreApi.setDoc(ref, { ...payload, createdAt: firestoreApi.serverTimestamp() });
    return { ok: true, mode: 'requested' };
  } catch {
    return { ok: false, reason: 'request_failed' };
  }
}
