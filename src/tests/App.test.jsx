import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as gameState from '../engine/gameState';
import { generateDynamicEvent } from '../engine/llmService';
import { buildLifeSave } from '../engine/lifeSave';
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

describe('annual death route save feedback', () => {
  it.each([
    ['pending', 'Saving year progress…'],
    ['failed', 'Year progress remains in this session, but saving failed. Reloading may restore an older save.'],
    ['skipped', 'Year progress remains in this session, but cloud saving is unavailable. Reloading may restore an older save.'],
    ['saved', 'Year progress saved to the cloud.'],
  ])('shows exactly one visible %s year receipt on the death route', (saveStatus, message) => {
    vi.spyOn(gameState, 'useGameState').mockReturnValue({
      ...buildLifeSave({ character: { name: 'Final Year Player' }, age: 100, isDead: true }),
      lastContinuitySave: { id: 'final-year', kind: 'year', saveStatus },
    });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'The End.' })).toBeVisible();
    const statuses = screen.getAllByRole('status', { name: 'Progress save status' });
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toBeVisible();
    expect(statuses[0]).toHaveTextContent(message);
  });

  it('shows no save announcement when the death route has no receipt', () => {
    vi.spyOn(gameState, 'useGameState').mockReturnValue({
      ...buildLifeSave({ character: { name: 'Restored Dead Player' }, age: 100, isDead: true }),
      lastContinuitySave: null,
    });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'The End.' })).toBeVisible();
    expect(screen.queryByRole('status', { name: 'Progress save status' })).not.toBeInTheDocument();
  });
});
