import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobSheet from '../components/sheets/JobSheet';
import GameSheets from '../components/game/GameSheets';

const job = {
  id: 'developer', title: 'Software Developer', salary: 45000,
  type: 'full_time', sector: 'tech', tier: 1,
};
const currentJob = { id: 'teacher', title: 'Teacher', salary: 62000, type: 'full_time' };
const quote = {
  targetId: 'developer', eligible: true, code: 'eligible', reason: '', basis: 'quote-1',
  preview: {
    title: 'Software Developer', baseSalary: 45000, grossSalary: 54000, immediateCost: 0,
    requirements: { minAge: 18, degree: 'bachelor', networking: 20, stats: { smarts: 70 } },
    annualEffects: { health: -2, happiness: 1 }, previousTitle: null,
    previousId: null, previousSalary: null, losesIncome: false,
  },
};
const committedResult = {
  actionId: 'fixture-action', actionType: 'career.choose', targetId: 'developer',
  status: 'committed', code: 'career_selected',
  patch: { career: job, history: [{ age: 30, text: 'You started work as a Software Developer.' }] },
  record: {}, facts: {},
};
const pendingAction = { actionId: 'fixture-action', result: committedResult, saveStatus: 'pending' };

function propsFor(overrides = {}) {
  return {
    age: 30, bank: 1000, stats: { grades: 70 }, career: null, careersData: [job],
    careerMeta: {}, networking: 30, education: { bachelor: true },
    chooseCareer: vi.fn(() => ({ result: committedResult, persistence: Promise.resolve({ status: 'saved' }) })),
    quoteCareer: vi.fn(() => quote),
    checkCareerEligibility: () => ({ eligible: true, reason: '' }),
    debugModifyBank: vi.fn(), triggerActivityEvent: vi.fn(),
    onClose: vi.fn(), ...overrides,
  };
}

function openDeveloper() {
  fireEvent.click(screen.getByRole('button', { name: /Full-Time/ }));
  fireEvent.click(screen.getByRole('button', { name: /Tech/ }));
  fireEvent.click(screen.getByRole('button', { name: /Software Developer/ }));
  return screen.getByRole('region', { name: 'Career decision preview' });
}

function feedbackFor(saveStatus) {
  return { ...pendingAction, saveStatus };
}

describe('career decisions', () => {
  it('reviews quoted pay, requirements, annual effects and zero fee before confirming, and cancel changes nothing', () => {
    const props = propsFor();
    render(<JobSheet {...props} />);
    const preview = within(openDeveloper());
    expect(preview.getByText(/Base annual salary: \$45,000/)).toBeInTheDocument();
    expect(preview.getByText(/Estimated annual gross.*\$54,000/)).toBeInTheDocument();
    expect(preview.getByText(/Immediate cost: \$0/)).toBeInTheDocument();
    expect(preview.getByText(/Age 18/)).toBeInTheDocument();
    expect(preview.getByText(/Bachelor's Degree/)).toBeInTheDocument();
    expect(preview.getByText(/Networking 20/)).toBeInTheDocument();
    expect(preview.getByText(/Smarts 70/)).toBeInTheDocument();
    expect(preview.getByText(/Health: −2/)).toBeInTheDocument();
    expect(preview.getByText(/Happiness: \+1/)).toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
    fireEvent.click(preview.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Career decision preview' })).not.toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
    expect(props.debugModifyBank).not.toHaveBeenCalled();
    expect(props.triggerActivityEvent).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('commits once with a generated ID and displayed quote basis, then shows pending status without closing', () => {
    const props = propsFor();
    function ConnectedSheet() {
      const [lastCareerAction, setAction] = useState(null);
      return <JobSheet {...props} lastCareerAction={lastCareerAction} chooseCareer={(id, options) => {
        const response = props.chooseCareer(id, options);
        setAction({ ...pendingAction, actionId: options.actionId });
        return response;
      }} />;
    }
    render(<ConnectedSheet />);
    const confirm = within(openDeveloper()).getByRole('button', { name: 'Confirm career' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(props.chooseCareer).toHaveBeenCalledExactlyOnceWith('developer', {
      actionId: expect.any(String), expectedBasis: 'quote-1',
    });
    expect(screen.getByRole('status', { name: 'Career outcome' })).toHaveTextContent('You started work as a Software Developer.');
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    expect(screen.getByRole('status')).not.toHaveTextContent(/Saved to cloud/);
    expect(screen.getByRole('button', { name: /Software Developer/ })).toBeDisabled();
    expect(props.debugModifyBank).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('keeps the opened quote basis through prop changes and refreshes a stale rejection before explicit reconfirmation', () => {
    const updatedQuote = { ...quote, basis: 'quote-2', preview: { ...quote.preview, baseSalary: 47000, grossSalary: 56400 } };
    const props = propsFor({ chooseCareer: vi.fn()
      .mockReturnValueOnce({ result: { ...committedResult, status: 'rejected', code: 'stale_quote', patch: {}, record: null, facts: null }, persistence: null })
      .mockReturnValueOnce({ result: committedResult, persistence: Promise.resolve({ status: 'saved' }) }),
    });
    const view = render(<JobSheet {...props} />);
    openDeveloper();
    view.rerender(<JobSheet {...props} stats={{ smarts: 90 }} quoteCareer={() => updatedQuote} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm career' }));
    expect(props.chooseCareer.mock.calls[0][1].expectedBasis).toBe('quote-1');
    expect(props.chooseCareer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent(/details changed/i);
    expect(within(screen.getByRole('region', { name: 'Career decision preview' })).getByText(/Base annual salary: \$47,000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm career' }));
    expect(props.chooseCareer.mock.calls[1][1].expectedBasis).toBe('quote-2');
    expect(props.chooseCareer.mock.calls[1][1].actionId).not.toBe(props.chooseCareer.mock.calls[0][1].actionId);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows the current salary and loss of tenure before replacing a role', () => {
    const props = propsFor({ career: currentJob, quoteCareer: () => ({ ...quote,
      preview: { ...quote.preview, previousTitle: 'Teacher', previousId: 'teacher', previousSalary: 62000 },
    }) });
    render(<JobSheet {...props} />);
    const preview = within(openDeveloper());
    expect(preview.getByText(/Teacher.*\$62,000/)).toBeInTheDocument();
    expect(preview.getByText(/tenure.*reset/i)).toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
  });

  it.each(['switch', 'quit'])('warns that leaving a founder role ends equity and dividends before %s', action => {
    const founder = { id: 'founder', title: 'Startup Founder', salary: 0, equity: 12000 };
    const props = propsFor({ career: founder, quoteCareer: () => ({ ...quote,
      targetId: action === 'quit' ? null : 'developer',
      preview: { ...quote.preview, previousId: 'founder', previousTitle: 'Startup Founder', previousSalary: 0, losesIncome: action === 'quit' },
    }) });
    render(<JobSheet {...props} />);
    if (action === 'quit') fireEvent.click(screen.getByRole('button', { name: 'Quit Position' }));
    else openDeveloper();
    expect(screen.getByRole('region', { name: 'Career decision preview' })).toHaveTextContent(/founder role.*equity.*dividends/i);
    expect(props.chooseCareer).not.toHaveBeenCalled();
  });

  it('allows inspecting an ineligible role but blocks confirmation with its requirement', () => {
    render(<JobSheet {...propsFor({
      checkCareerEligibility: () => ({ eligible: false, reason: 'Requires Networking 20+' }),
      quoteCareer: () => ({ ...quote, eligible: false, code: 'ineligible', reason: 'Requires Networking 20+' }),
    })} />);
    const preview = within(openDeveloper());
    expect(preview.getByRole('button', { name: 'Confirm career' })).toBeDisabled();
    expect(preview.getByText('Requires Networking 20+')).toBeInTheDocument();
  });

  it('previews voluntary quitting and confirms null with the displayed basis', () => {
    const props = propsFor({ career: currentJob, quoteCareer: () => ({ ...quote, targetId: null,
      preview: { ...quote.preview, title: null, previousTitle: 'Teacher', previousId: 'teacher', previousSalary: 62000,
        baseSalary: 0, grossSalary: 0, annualEffects: { health: 0, happiness: 0 }, losesIncome: true },
    }) });
    render(<JobSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quit Position' }));
    const preview = within(screen.getByRole('region', { name: 'Career decision preview' }));
    expect(preview.getByText(/\$62,000.*ends/)).toBeInTheDocument();
    expect(preview.getByText(/No unemployment benefits/)).toBeInTheDocument();
    expect(preview.getByText(/Health: 0/)).toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
    fireEvent.click(preview.getByRole('button', { name: 'Confirm quit' }));
    expect(props.chooseCareer).toHaveBeenCalledExactlyOnceWith(null, { actionId: expect.any(String), expectedBasis: 'quote-1' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['saved', /Saved to cloud/],
    ['failed', /Not saved to cloud/],
    ['skipped', /Cloud save unavailable/],
    ['not_requested', /No save requested/],
  ])('reports %s storage separately from the committed action outcome', (saveStatus, text) => {
    render(<JobSheet {...propsFor({ lastCareerAction: feedbackFor(saveStatus) })} />);
    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent('You started work as a Software Developer.');
    expect(feedback).toHaveTextContent(text);
    if (saveStatus !== 'saved') expect(feedback).not.toHaveTextContent(/Saved to cloud/);
  });

  it('updates a pending receipt to failed without another career command or an event', () => {
    const props = propsFor({ lastCareerAction: pendingAction });
    const view = render(<JobSheet {...props} />);
    view.rerender(<JobSheet {...props} lastCareerAction={feedbackFor('failed')} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Not saved to cloud/);
    expect(props.chooseCareer).not.toHaveBeenCalled();
    expect(props.triggerActivityEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Retry|Confirm career/ })).not.toBeInTheDocument();
  });

  it('keeps the preview open and reports an undefined command return without claiming success', () => {
    const props = propsFor({ chooseCareer: vi.fn() });
    render(<JobSheet {...props} />);
    openDeveloper();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm career' }));
    expect(screen.getByRole('region', { name: 'Career decision preview' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be completed/i);
    expect(props.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it.each([undefined, 'service'])('prevents reselecting an active part-time role with sector %s', sector => {
    const partTime = { ...job, id: 'barista', title: 'Barista', type: 'part_time', sector };
    const props = propsFor({ career: partTime, careersData: [partTime] });
    render(<JobSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Part-Time/ }));
    if (sector) fireEvent.click(screen.getByRole('button', { name: /Service/ }));
    expect(screen.getByRole('button', { name: /Barista/ })).toBeDisabled();
    expect(props.chooseCareer).not.toHaveBeenCalled();
  });

  it('supports keyboard confirmation through the native button', async () => {
    const user = userEvent.setup();
    const props = propsFor();
    render(<JobSheet {...props} />);
    openDeveloper();
    screen.getByRole('button', { name: 'Confirm career' }).focus();
    await user.keyboard('{Enter}');
    expect(props.chooseCareer).toHaveBeenCalledOnce();
  });

  it('connects canonical quote and feedback props through GameSheets', () => {
    const props = propsFor({ lastCareerAction: feedbackFor('saved') });
    render(<GameSheets engine={props} visibleSheet="job" closeSheet={props.onClose} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Saved to cloud/);
    expect(openDeveloper()).toHaveTextContent(/Estimated annual gross.*\$54,000/);
  });

  it('discards a captured preview when the account changes without an intermediate screen', () => {
    const props = propsFor();
    const view = render(<GameSheets engine={{ ...props, authAccount: { uid: 'first' } }} visibleSheet="job" closeSheet={props.onClose} />);
    openDeveloper();
    view.rerender(<GameSheets engine={{ ...props, authAccount: { uid: 'second' } }} visibleSheet="job" closeSheet={props.onClose} />);
    expect(screen.queryByRole('region', { name: 'Career decision preview' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Career & Income' })).toBeInTheDocument();
    expect(props.chooseCareer).not.toHaveBeenCalled();
  });
});
