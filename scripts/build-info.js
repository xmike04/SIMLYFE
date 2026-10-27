export function getBuildInfo(env = process.env) {
  const candidate = env.VERCEL_GIT_COMMIT_SHA ?? env.GITHUB_SHA;
  const commitSha = typeof candidate === 'string' && candidate.length === 40
    && /^[a-f0-9]{40}$/.test(candidate) ? candidate : null;
  return { schemaVersion: 1, commitSha };
}

export function buildInfoPlugin(env = process.env) {
  const info = getBuildInfo(env);
  return {
    name: 'simlyfe-public-build-info',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: `${JSON.stringify(info)}\n`,
      });
    },
  };
}
