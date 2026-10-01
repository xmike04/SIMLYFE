import React, { useState } from 'react';

export default function DeletionRequest({ requestAccountDeletion }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit() {
    setBusy(true);
    let result;
    try { result = await requestAccountDeletion(); } catch { result = { ok: false }; }
    setMessage(result?.ok
      ? 'Deletion request received. Your account and associated save are queued for developer review. This is a request; nothing has been deleted yet.'
      : 'The request could not be sent. Please try again when connected.');
    setBusy(false);
  }
  return <div className="support-request">
    {!confirming ? <button className="btn btn-secondary" onClick={() => setConfirming(true)}>Request account deletion</button> : <>
      <p>This sends a request to the SIMLYFE developer to delete this account and its cloud life. Signing out or starting a new life does not delete an account.</p>
      <button className="btn btn-secondary" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send deletion request'}</button>
      <button className="btn btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}
