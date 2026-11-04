import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as gameState from '../engine/gameState';
import { generateDynamicEvent } from '../engine/llmService';
import App from '../App';

describe('App crashing test', () => {
  it('renders without crashing', () => {
    try {
      render(<App />);
    } catch (e) {
      console.error("APP CRASH EXACT ERROR:", e);
      throw e;
    }
  });
});


const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  else delete HTMLElement.prototype.scrollIntoView;
});

it('routes a visible choice through the event identity/index API to the real owner', async () => {
  // jsdom does not implement scrolling.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const useRealGameState = gameState.useGameState;
  let owner;
  const handleChoice = vi.fn((...args) => owner.handleChoice(...args));
  vi.spyOn(gameState, 'useGameState').mockImplementation(function useAppOwner() {
    owner = useRealGameState();
    return { ...owner, handleChoice };
  });
  render(<App />);
  act(() => owner.startLife('UI Choice Player', 'Female', 'US'));
  generateDynamicEvent.mockResolvedValueOnce({ description: 'An offer', choices: [
    { text: 'Decline the opportunity', effects: {} },
    { text: 'Consider the opportunity', effects: { bank: 20000 } },
  ] });
  await act(async () => { await owner.triggerActivityEvent('An offer'); });
  const eventId = owner.currentEvent.id;
  fireEvent.click(screen.getByRole('button', { name: 'Consider the opportunity' }));
  expect(handleChoice).toHaveBeenCalledExactlyOnceWith(eventId, 1);
  expect(owner.bank).toBe(20000);
  expect(owner.currentEvent).toBeNull();
});
