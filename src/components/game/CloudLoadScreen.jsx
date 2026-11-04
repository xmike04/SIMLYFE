import React from 'react';

export default function CloudLoadScreen({ engine }) {
  const failed = engine.cloudLoadState.status === 'failed';
  const identified = engine.authAccount && !engine.authAccount.isAnonymous;

  return (
    <main className="cloud-load-screen">
      <div className="glass-panel flex-column text-center">
        {failed ? (
          <div role="alert" aria-label="Saved life load failed">
            <p>We couldn’t load your saved life. It hasn’t been replaced. Try again.</p>
          </div>
        ) : (
          <div role="status" aria-label="Saved life loading">
            <h2>Loading your saved life…</h2>
          </div>
        )}
        {failed && <button type="button" className="btn" onClick={() => engine.retryCloudLoad()}>Try again</button>}
        {identified && <button type="button" className="btn btn-secondary" onClick={() => engine.signOutAccount()}>Sign out</button>}
      </div>
    </main>
  );
}
