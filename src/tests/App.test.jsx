import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  await waitFor(() => expect(owner.cloudLoadState.status).toBe('local'));
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


describe('saved-life recovery routing', () => {
  function mockOwner(fields = {}) {
    const owner = { ...buildLifeSave(), startLife: vi.fn(), retryCloudLoad: vi.fn(), signOutAccount: vi.fn(), ...fields };
    vi.spyOn(gameState, 'useGameState').mockReturnValue(owner);
    return owner;
  }
  afterEach(() => sessionStorage.clear());

  it('retains initial splash until dismissed, then blocks creation while loading', () => {
    sessionStorage.clear();
    mockOwner({ cloudLoadState: { status: 'loading' } });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Begin Your Life' }));
    expect(screen.getByRole('status', { name: 'Saved life loading' })).toHaveTextContent('Loading your saved life…');
    expect(screen.queryByRole('heading', { name: 'Start a Life' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it.each(['loading', 'failed'])('gates creation, gameplay and death during %s with only relevant signout', status => {
    sessionStorage.setItem('simlyfe_splash', '1');
    const owner = mockOwner({ character: { name: 'Unread Player' }, isDead: true,
      cloudLoadState: { status, reason: 'PRIVATE_PROVIDER_ERROR' }, authAccount: { uid: 'identified', isAnonymous: false } });
    render(<App />);
    expect(screen.getByRole(status === 'loading' ? 'status' : 'alert', {
      name: status === 'loading' ? 'Saved life loading' : 'Saved life load failed',
    })).toBeVisible();
    expect(screen.queryByText('PRIVATE_PROVIDER_ERROR')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The End.' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Live Again' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Start a Life' })).not.toBeInTheDocument();
    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signOut.tagName).toBe('BUTTON');
    fireEvent.click(signOut);
    expect(owner.signOutAccount).toHaveBeenCalledOnce();
    if (status === 'failed') {
      expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load your saved life. It hasn’t been replaced. Try again.');
      const retry = screen.getByRole('button', { name: 'Try again' });
      expect(retry.tagName).toBe('BUTTON');
      fireEvent.click(retry);
      expect(owner.retryCloudLoad).toHaveBeenCalledOnce();
    } else expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(owner.startLife).not.toHaveBeenCalled();
  });

  it('unmounts failed controls while retrying and hides signout for a guest', () => {
    sessionStorage.setItem('simlyfe_splash', '1');
    const owner = mockOwner({ cloudLoadState: { status: 'failed' }, authAccount: { isAnonymous: true } });
    const view = render(<App />);
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    owner.cloudLoadState = { status: 'loading' };
    view.rerender(<App />);
    expect(screen.getByRole('status', { name: 'Saved life loading' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it.each(['local', 'missing', 'loaded'])('retains creation after splash for ready %s', status => {
    sessionStorage.setItem('simlyfe_splash', '1');
    mockOwner({ cloudLoadState: { status } });
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Start a Life' })).toBeVisible();
  });

  it('shows recovery after a returning life switches accounts even without a prior splash flag', () => {
    sessionStorage.clear();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const owner = mockOwner({ character: { name: 'Returning Player' }, cloudLoadState: { status: 'loaded' } });
    const view = render(<App />);
    expect(screen.getByRole('heading', { name: 'Returning Player' })).toBeVisible();
    owner.character = null;
    owner.cloudLoadState = { status: 'failed' };
    view.rerender(<App />);
    expect(screen.getByRole('alert', { name: 'Saved life load failed' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Begin Your Life' })).not.toBeInTheDocument();
  });
});
