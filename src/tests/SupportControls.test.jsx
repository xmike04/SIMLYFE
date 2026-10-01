import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventModal from '../components/EventModal';
import DeletionRequest from '../components/sheets/DeletionRequest';

describe('distribution support controls', () => {
  it('reports an event without choosing an effect or leaving the modal', async () => {
    const onChoice = vi.fn(), onReport = vi.fn().mockResolvedValue({ ok: true });
    const event = { description: 'Fictional event', choices: [{ text: 'Continue', effects: {} }], meta: { requestId: 'request' } };
    render(<EventModal event={event} onChoice={onChoice} onReport={onReport} />);
    fireEvent.click(screen.getByText('Report this AI event'));
    fireEvent.click(screen.getByText('Send report'));
    await screen.findByText('Report received. Your event is still waiting for your choice.');
    expect(onReport).toHaveBeenCalledWith(event, 'offensive'); expect(onChoice).not.toHaveBeenCalled();
    expect(screen.getByText('Continue')).toBeVisible();
  });
  it('requires an explicit deletion request and keeps a failed request retryable', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ok: true });
    render(<DeletionRequest requestAccountDeletion={request} />);
    fireEvent.click(screen.getByText('Request account deletion')); expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Send deletion request'));
    await screen.findByText('The request could not be sent. Please try again when connected.');
    fireEvent.click(screen.getByText('Send deletion request'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('nothing has been deleted yet'));
    expect(request).toHaveBeenCalledTimes(2);
  });
});
