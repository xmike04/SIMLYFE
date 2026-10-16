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

const careerFixture = { id: 'teacher', title: 'Teacher', sector: 'education', type: 'full_time', salary: 50000 };
const decisionQuote = { targetId: 'teacher', eligible: true, code: 'eligible', reason: '', basis: 'quote-basis', preview: { title: 'Teacher', salary: 50000, grossSalary: 55000, immediateCost: 0, healthDelta: -2, happinessDelta: -1, previousTitle: 'Tutor', requirements: { minAge: 22, degree: 'bachelor', networking: 20, stats: { smarts: 60 } } } };
function decisionProps(extra = {}) {
  return { age: 30, bank: 12000, stats: {}, career: null, careersData: [careerFixture], careerMeta: {}, education: {}, networking: 30,
    chooseCareer: vi.fn(() => ({ result: { status: 'committed', code: 'career_selected' } })), quoteCareer: vi.fn(() => decisionQuote), lastCareerAction: null,
    checkCareerEligibility: () => ({ eligible: true, reason: '' }), onClose: vi.fn(), ...extra };
}
function selectTeacher() {
  fireEvent.click(screen.getByRole('button', { name: /Full-Time/i }));
  fireEvent.click(screen.getByRole('button', { name: /Education/i }));
  fireEvent.click(screen.getByRole('button', { name: /Teacher/i }));
}

describe('career decision preview', () => {
  it('shows trade-offs before confirmation without committing on preview or cancel', () => {
    const props = decisionProps();
    render(<JobSheet {...props} />);
    selectTeacher();
    expect(screen.getByText(/55,000/)).toBeInTheDocument();
    expect(screen.getByText(/Health.*−2|Health.*-2/)).toBeInTheDocument();
    expect(screen.getByText(/Tutor/)).toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.chooseCareer).not.toHaveBeenCalled();
  });
  it('confirms once with the reviewed basis and keeps outcome feedback in the sheet', () => {
    const props = decisionProps();
    const view = render(<JobSheet {...props} />);
    selectTeacher();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm career change' }));
    expect(props.chooseCareer).toHaveBeenCalledTimes(1);
    expect(props.chooseCareer).toHaveBeenCalledWith('teacher', expect.objectContaining({ expectedBasis: 'quote-basis', actionId: expect.any(String) }));
    expect(props.onClose).not.toHaveBeenCalled();
    view.rerender(<JobSheet {...props} lastCareerAction={{ actionId: props.chooseCareer.mock.calls[0][1].actionId, result: { status: 'committed', code: 'career_selected' }, saveStatus: 'pending' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    view.rerender(<JobSheet {...props} lastCareerAction={{ actionId: props.chooseCareer.mock.calls[0][1].actionId, result: { status: 'committed', code: 'career_selected' }, saveStatus: 'failed' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved to cloud');
    expect(props.chooseCareer).toHaveBeenCalledTimes(1);
  });
  it('refreshes stale terms and requires another confirmation', () => {
    const props = decisionProps({ chooseCareer: vi.fn(() => ({ result: { status: 'rejected', code: 'stale_quote' } })) });
    render(<JobSheet {...props} />);
    selectTeacher();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm career change' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/changed/i);
    expect(screen.getByRole('button', { name: 'Confirm career change' })).toBeEnabled();
    expect(props.chooseCareer).toHaveBeenCalledTimes(1);
  });
});
