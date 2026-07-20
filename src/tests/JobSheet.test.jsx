import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import JobSheet from '../components/sheets/JobSheet';

function renderJobSheet(overrides = {}) {
  const props = {
    age: 30,
    bank: 1000,
    stats: { grades: 70 },
    career: null,
    careersData: [],
    careerMeta: {},
    networking: 0,
    education: { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null },
    chooseCareer: vi.fn(),
    studyHard: vi.fn(),
    triggerActivityEvent: vi.fn(),
    performGig: vi.fn(),
    attendNetworkingEvent: vi.fn(),
    enrollInDegree: vi.fn(),
    checkCareerEligibility: vi.fn(() => ({ eligible: true, reason: '' })),
    debugModifyBank: vi.fn(),
    startStartup: vi.fn(),
    enlistMilitary: vi.fn(),
    hireViaHeadhunter: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<JobSheet {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /Special Careers/i }));
  fireEvent.click(screen.getByRole('button', { name: /Business Startup/i }));
  return props;
}

describe('JobSheet startup action', () => {
  it('disables relaunch while a founder is active', () => {
    const props = renderJobSheet({ career: { id: 'founder', title: 'Startup Founder', equity: 500 } });
    const button = screen.getByRole('button', { name: /Startup Already Active/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(props.startStartup).not.toHaveBeenCalled();
  });

  it('launches through startStartup without a separate UI bank deduction', () => {
    const props = renderJobSheet();
    fireEvent.click(screen.getByRole('button', { name: /Launch Tech Startup/i }));
    expect(props.startStartup).toHaveBeenCalledTimes(1);
    expect(props.debugModifyBank).not.toHaveBeenCalled();
  });
});
