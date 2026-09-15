// @vitest-environment node
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../scripts/test-llm.js');
function runProbe(env) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [script], { env: { PATH: process.env.PATH, ...env } });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => done({ code, stdout, stderr }));
  });
}

describe('manual authenticated LLM probe', () => {
  it.each([undefined, 'https://fixture.example'])('sends its required origin and separates identity from the gateway key (%s)', async frontendOrigin => {
    let received;
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      received = { headers: request.headers, body: JSON.parse(body), path: request.url };
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ event: { description: 'Fixture event', choices: [] }, meta: { requestId: 'fixture' } }));
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    try {
      const output = await runProbe({
        VITE_SUPABASE_URL: `http://127.0.0.1:${server.address().port}`,
        VITE_SUPABASE_PUBLISHABLE: 'public-gateway-key', FIREBASE_ID_TOKEN: 'private-fixture-token',
        ...(frontendOrigin ? { FRONTEND_ORIGIN: frontendOrigin } : {}),
      });
      expect(output.code).toBe(0);
      expect(received.headers).toMatchObject({
        origin: frontendOrigin ?? 'http://localhost:5173',
        authorization: 'Bearer private-fixture-token', apikey: 'public-gateway-key',
      });
      expect(received.path).toBe('/functions/v1/generate-event');
      expect(received.body).toMatchObject({ state: { age: 25 }, actionContext: null, narrativeMode: false });
      expect(output.stdout + output.stderr).not.toContain('private-fixture-token');
    } finally { await new Promise(done => server.close(done)); }
  });

  it('fails clearly before networking when required credentials are missing', async () => {
    const output = await runProbe({});
    expect(output.code).toBe(1);
    expect(output.stderr).toContain('FIREBASE_ID_TOKEN');
    expect(output.stdout).toBe('');
  });
});
