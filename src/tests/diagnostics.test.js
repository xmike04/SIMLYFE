import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDiagnosticId,
  emitDiagnostic,
  emitLlmDiagnostic,
  getDiagnosticStateFields,
  getErrorClass,
} from '../engine/diagnostics';

describe('privacy-safe diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs only allowlisted save metadata and redacts user-controlled fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const record = emitDiagnostic('save_load', {
      operationId: 'save-load-abc-123',
      status: 'loaded_with_warnings',
      durationMs: 12.6,
      fields: ['age', 'history', 'Eric Secret', 'character'],
      name: 'Private Character Name',
      history: ['private event text'],
      rawState: { bank: 10 },
      errorMessage: 'contains private data',
    });

    expect(record).toEqual({
      event: 'save_load',
      operationId: 'save-load-abc-123',
      status: 'loaded_with_warnings',
      durationMs: 13,
      fields: ['age', 'character', 'history', 'unknown'],
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Private Character Name');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private event text');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('contains private data');
  });

  it('emits LLM usage while discarding prompts, state, and response content', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});

    const record = emitLlmDiagnostic({
      source: 'llmService',
      type: 'success',
      requestId: 'req_123',
      model: 'gpt-5-nano',
      latencyMs: 42,
      usage: { inputTokens: 100, cachedInputTokens: 25, outputTokens: 20, secret: 'usage secret' },
      prompt: 'private prompt',
      actionContext: 'private action',
      state: { character: { name: 'Private Name' } },
      responseBody: 'private response',
      token: 'private credential',
    });

    expect(record).toEqual({
      event: 'llm_request',
      status: 'success',
      durationMs: 42,
      requestId: 'req_123',
      model: 'gpt-5-nano',
      inputTokens: 100,
      cachedInputTokens: 25,
      outputTokens: 20,
    });
    const logged = JSON.stringify(info.mock.calls);
    for (const privateValue of ['private prompt', 'private action', 'Private Name', 'private response', 'private credential', 'usage secret']) {
      expect(logged).not.toContain(privateValue);
    }
  });

  it('uses safe sentinels for unknown fields, identifiers, codes, and errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getDiagnosticStateFields({ age: 1, 'person name': true })).toEqual(['age', 'unknown']);
    expect(getErrorClass(new TypeError('sensitive message'))).toBe('TypeError');
    expect(getErrorClass({ name: 'PrivatePerson' })).toBe('UnknownError');
    expect(createDiagnosticId('save-load')).toMatch(/^save-load-[a-z0-9]+-[a-z0-9]+$/);

    const record = emitLlmDiagnostic({
      type: 'failure',
      requestId: 'private request id with spaces',
      code: 'private-code',
      latencyMs: -1,
      status: 999,
      message: 'private failure message',
    });
    expect(record).toEqual({
      event: 'llm_request',
      status: 'failure',
      durationMs: 0,
      requestId: 'unknown',
      errorCode: 'unknown',
      httpStatus: 599,
    });
  });
});
