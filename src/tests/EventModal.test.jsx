import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventModal from '../components/EventModal';

afterEach(cleanup);
const event = {
  version: 1, id: 'annual-30', age: 30, source: 'annual', description: 'A saved opportunity',
  choices: [{ text: 'Decline the opportunity', effects: {} }, { text: 'Consider the opportunity', effects: { bank: 20000 } }],
};

describe('EventModal choice identity', () => {
  it.each(['click', 'keyboard'])('passes only the stored event identity and second index on %s activation', async activation => {
    const onChoice = vi.fn();
    const user = userEvent.setup();
    render(<EventModal event={event} onChoice={onChoice} />);
    const second = screen.getByRole('button', { name: 'Consider the opportunity' });
    if (activation === 'click') await user.click(second);
    else { second.focus(); await user.keyboard('{Enter}'); }
    expect(onChoice).toHaveBeenCalledExactlyOnceWith('annual-30', 1);
  });
});
