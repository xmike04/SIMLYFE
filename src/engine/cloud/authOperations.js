// Provider mutations outlive individual hook mounts. Do not queue another
// session-changing command behind a user intent that has already been accepted.
const operations = new WeakMap();

export async function runExclusiveAuthOperation(auth, work) {
  if (operations.has(auth)) return { busy: true };
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  operations.set(auth, pending);
  try {
    return { busy: false, value: await work() };
  } finally {
    operations.delete(auth);
    release();
  }
}

export async function waitForAuthOperation(auth) {
  await operations.get(auth);
}
