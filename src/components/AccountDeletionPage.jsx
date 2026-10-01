import React from 'react';
import AccountSheet from './sheets/AccountSheet';
import DeletionRequest from './sheets/DeletionRequest';

export default function AccountDeletionPage({ engine }) {
  return <main className="deletion-page glass-panel">
    <h1>SIMLYFE account deletion</h1>
    <p>Sign in to the SIMLYFE account you want deleted, then submit a request below. You can use this page without reinstalling the Android app.</p>
    <p>Deletion covers your Firebase account, current cloud life and support-request content. Limited security and provider records may remain under the retention policy. Requests require developer review; this page does not immediately delete data.</p>
    {!engine.authAccount || engine.authAccount.isAnonymous
      ? <AccountSheet {...engine} embedded allowSignUp={false} requestAccountDeletion={undefined} />
      : <><p>Signed in as {engine.authAccount.email ?? engine.authAccount.name ?? 'your account'}.</p><DeletionRequest requestAccountDeletion={engine.requestAccountDeletion} /></>}
    <p><a href="/privacy.html">Privacy and retention details</a> · <a href="/">Return to SIMLYFE</a></p>
  </main>;
}
