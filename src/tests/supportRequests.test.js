import { describe, it, expect, vi } from 'vitest';
import { contentReportPayload, submitSupportRequest } from '../engine/cloud/supportRequests';

const event = { description: 'A fictional event.', choices: [{ text: 'Think it over', effects: { bank: 10 } }], meta: { requestId: 'test-request' }, privateLife: { secret: 'excluded' } };
function backend(exists = false) {
  return { auth: { currentUser: { uid: 'owner' } }, db: {}, firestoreApi: {
    doc: vi.fn((...args) => args.slice(1).join('/')), getDoc: vi.fn().mockResolvedValue({ exists: () => exists }),
    setDoc: vi.fn().mockResolvedValue(), serverTimestamp: () => 'server-time',
  } };
}
describe('support requests use the existing identity without changing a life', () => {
  it('reports only selected event text and its public request ID', () => {
    expect(contentReportPayload(event, 'offensive')).toEqual({ kind: 'content_report', reason: 'offensive', requestId: 'test-request', description: 'A fictional event.', choiceTexts: ['Think it over'] });
    expect(contentReportPayload({ description: 'Static error' }, 'offensive')).toBeNull();
    expect(contentReportPayload(event, 'unknown')).toBeNull();
  });
  it('writes a request under the authenticated owner and acknowledges server completion', async () => {
    const api = backend();
    await expect(submitSupportRequest(contentReportPayload(event, 'unsafe'), api)).resolves.toEqual({ ok: true, mode: 'requested' });
    expect(api.firestoreApi.setDoc).toHaveBeenCalledWith('users/owner/supportRequests/event-test-request', expect.objectContaining({ createdAt: 'server-time', reason: 'unsafe' }));
  });
  it('does not overwrite an existing report or deletion request', async () => {
    const api = backend(true);
    await expect(submitSupportRequest(contentReportPayload(event, 'other'), api)).resolves.toEqual({ ok: true, mode: 'already_requested' });
    expect(api.firestoreApi.setDoc).not.toHaveBeenCalled();
  });
  it('does not claim receipt after a denied or failed write', async () => {
    const api = backend(); api.firestoreApi.setDoc.mockRejectedValue(new Error('private details'));
    await expect(submitSupportRequest(contentReportPayload(event, 'other'), api)).resolves.toEqual({ ok: false, reason: 'request_failed' });
  });
});
