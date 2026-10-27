import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildInfoPlugin, getBuildInfo } from './build-info.js';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);

describe('public build provenance', () => {
  it('identifies the Vercel commit ahead of a different CI commit', () => {
    assert.deepEqual(getBuildInfo({ VERCEL_GIT_COMMIT_SHA: sha, GITHUB_SHA: otherSha }),
      { schemaVersion: 1, commitSha: sha });
  });

  it('uses the GitHub commit when Vercel metadata is absent', () => {
    assert.deepEqual(getBuildInfo({ GITHUB_SHA: otherSha }),
      { schemaVersion: 1, commitSha: otherSha });
  });

  it('labels missing provenance honestly', () => {
    assert.deepEqual(getBuildInfo({}), { schemaVersion: 1, commitSha: null });
  });

  it('rejects malformed metadata instead of publishing arbitrary environment text', () => {
    for (const invalid of ['short', sha + '\n', 'A'.repeat(40), 'g'.repeat(40), 123]) {
      assert.deepEqual(getBuildInfo({ VERCEL_GIT_COMMIT_SHA: invalid }),
        { schemaVersion: 1, commitSha: null });
    }
  });

  it('emits only the allowlisted public manifest during a build', () => {
    const output = [];
    const plugin = buildInfoPlugin({ VERCEL_GIT_COMMIT_SHA: sha, OPENAI_API_KEY: 'must-not-be-published' });
    assert.equal(plugin.apply, 'build');
    plugin.generateBundle.call({ emitFile: asset => output.push(asset) });
    assert.equal(output.length, 1);
    assert.equal(output[0].type, 'asset');
    assert.equal(output[0].fileName, 'build-info.json');
    assert.deepEqual(JSON.parse(output[0].source), { schemaVersion: 1, commitSha: sha });
  });
});
