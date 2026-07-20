import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateDynamicEvent } from '../engine/llmService';
import { useGameState } from '../engine/gameState';

describe('game state diagnostics safeguards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('releases the age-up guard and preserves rejection behavior after an unexpected error', async () => {
    const diagnosticError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new TypeError('private provider detail');
    generateDynamicEvent.mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useGameState());

    let rejectedWith;
    await act(async () => {
      try {
        await result.current.ageUp();
      } catch (error) {
        rejectedWith = error;
      }
    });

    expect(rejectedWith).toBe(failure);
    expect(result.current.isAging).toBe(false);
    const failureRecord = diagnosticError.mock.calls
      .map(([, record]) => record)
      .find(record => record?.event === 'age_transition' && record.status === 'failed');
    expect(failureRecord).toMatchObject({
      event: 'age_transition',
      status: 'failed',
      fromAge: 0,
      toAge: 1,
      errorClass: 'TypeError',
    });
    expect(JSON.stringify(failureRecord)).not.toContain('private provider detail');
  });

  it('surfaces unexpected activity generation failures without raw console leakage', async () => {
    const diagnosticError = vi.spyOn(console, 'error').mockImplementation(() => {});
    generateDynamicEvent.mockRejectedValueOnce(new Error('private activity provider detail'));
    const { result } = renderHook(() => useGameState());

    act(() => {
      expect(result.current.performActivity({
        text: 'Take a risky action',
        context: 'private activity context',
      }, 'test')).toBe('ok');
    });

    await waitFor(() => {
      expect(result.current.currentEvent?.description).toContain('generation failed');
    });

    expect(result.current.isAging).toBe(false);
    expect(result.current.currentEvent.choices).toEqual([
      { text: 'Understood', effects: {} },
    ]);
    const failureRecord = diagnosticError.mock.calls
      .map(([, record]) => record)
      .find(record => record?.event === 'llm_request' && record.status === 'failure');
    expect(failureRecord).toMatchObject({
      event: 'llm_request',
      status: 'failure',
      errorCode: 'service',
    });
    expect(JSON.stringify(diagnosticError.mock.calls)).not.toContain('private activity provider detail');
    expect(JSON.stringify(diagnosticError.mock.calls)).not.toContain('private activity context');
  });
});
