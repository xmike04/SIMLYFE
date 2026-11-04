import React, { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JobSheet from '../components/sheets/JobSheet';
import GameSheets from '../components/game/GameSheets';

const job = { id: 'developer', title: 'Software Developer', salary: 45000, type: 'full_time', sector: 'tech' };
const quote = {
  targetId: 'bachelor', eligible: true, code: 'eligible', reason: '', basis: 'education-quote-1',
  preview: {
    degreeType: 'bachelor', label: "Bachelor's Degree", prerequisiteDegree: 'highSchool', prerequisiteMet: true,
    programYears: 4, annualTuition: 20000, firstYearTuition: 20000, remainingTuition: 60000, totalTuition: 80000,
    bankBefore: 100000, bankAfterEnrollment: 80000, ageUpsToCompletion: 3, completionAge: 21,
    annualHappinessEffect: 0, completionSmartsBonus: 10, completionHappinessBonus: 3,
  },
};
const committedResult = {
  actionId: 'fixture-action', actionType: 'education.enroll', targetId: 'bachelor', status: 'committed', code: 'education_enrolled',
  patch: { bank: 80000, education: { currentDegree: { type: 'bachelor', yearsInProgram: 1, totalYears: 4, annualCost: 20000 } }, history: [{ age: 18, text: "You enrolled in a Bachelor's Degree." }] },
  record: { version: 1, id: 'fixture-action', type: 'education.enroll', targetId: 'bachelor', beforeBank: 100000, afterBank: 80000, firstYearTuition: 20000, annualTuition: 20000, totalYears: 4, yearsInProgram: 1, code: 'education_enrolled' },
  facts: { version: 1, actionId: 'fixture-action', actionType: 'education.enroll', age: 18, code: 'education_enrolled', degreeType: 'bachelor', beforeBank: 100000, afterBank: 80000, firstYearTuition: 20000, annualTuition: 20000, totalYears: 4, yearsInProgram: 1 },
};
const feedbackFor = saveStatus => ({ actionId: 'fixture-action', result: committedResult, saveStatus });
const rejected = code => ({ result: { ...committedResult, status: 'rejected', code, patch: {}, record: null, facts: null }, persistence: null });
function propsFor(overrides = {}) {
  return {
    age: 18, bank: 100000, stats: { grades: 70, smarts: 70, happiness: 70 }, career: null, careersData: [job], careerMeta: {}, networking: 30,
    education: { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null },
    quoteEducation: vi.fn(() => quote), enrollInDegree: vi.fn(() => ({ result: committedResult, persistence: Promise.resolve({ status: 'saved' }) })),
    quoteCareer: vi.fn(() => ({ targetId: 'developer', eligible: true, basis: 'career-1', preview: { title: job.title, baseSalary: 45000, grossSalary: 45000, immediateCost: 0, requirements: { minAge: 18, degree: null, networking: 0, stats: {} }, annualEffects: { health: 0, happiness: 0 } } })),
    chooseCareer: vi.fn(), checkCareerEligibility: vi.fn(() => ({ eligible: true, reason: '' })),
    studyHard: vi.fn(), triggerActivityEvent: vi.fn(), performGig: vi.fn(), attendNetworkingEvent: vi.fn(), debugModifyBank: vi.fn(), startStartup: vi.fn(), enlistMilitary: vi.fn(), hireViaHeadhunter: vi.fn(), onClose: vi.fn(),
    ...overrides,
  };
}
function openBachelor() {
  fireEvent.click(screen.getByRole('button', { name: /Education/ }));
  fireEvent.click(screen.getByRole('button', { name: /Enroll:.*Bachelor/ }));
  return screen.getByRole('region', { name: 'Education decision preview' });
}
function expectUntouched(props) {
  for (const command of [props.enrollInDegree, props.debugModifyBank, props.triggerActivityEvent, props.onClose]) expect(command).not.toHaveBeenCalled();
}

describe('education enrollment decisions', () => {
  it('reviews the tuition commitment, prerequisite, timing and bonuses; cancel changes nothing', () => {
    const props = propsFor(); render(<JobSheet {...props} />);
    const preview = within(openBachelor());
    expect(preview.getByRole('heading', { name: 'Review Enrollment' })).toBeInTheDocument();
    for (const text of [/Pay now: \$20,000/, /Remaining tuition: \$60,000/, /Total tuition: \$80,000/, /Balance after enrollment: \$80,000/, /Annual tuition: \$20,000/, /Balance before enrollment: \$100,000/, /Prerequisite: HS Diploma.*met/, /3.*Age clicks/, /age 21/, /Smarts: \+10/, /Happiness: \+3/, /may.*negative/]) expect(preview.getByText(text)).toBeInTheDocument();
    expectUntouched(props); fireEvent.click(preview.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Education decision preview' })).not.toBeInTheDocument(); expectUntouched(props);
  });
  it('confirms once synchronously and keeps pending feedback open until Continue', () => {
    const props = propsFor();
    function ConnectedSheet() {
      const [lastEducationAction, setAction] = useState(null);
      return <JobSheet {...props} lastEducationAction={lastEducationAction} enrollInDegree={(id, options) => {
        const response = props.enrollInDegree(id, options); setAction({ ...feedbackFor('pending'), actionId: options?.actionId }); return response;
      }} />;
    }
    render(<ConnectedSheet />); const confirm = within(openBachelor()).getByRole('button', { name: 'Confirm enrollment' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(props.enrollInDegree).toHaveBeenCalledExactlyOnceWith('bachelor', { actionId: expect.any(String), expectedBasis: 'education-quote-1' });
    expect(screen.getByRole('status', { name: 'Education outcome' })).toHaveTextContent('Saving…');
    expect(screen.getByRole('status')).toHaveTextContent("You enrolled in a Bachelor's Degree.");
    expect(screen.getByRole('button', { name: /Enroll:.*Bachelor/ })).toBeDisabled();
    expect(props.onClose).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Continue' })); expect(props.onClose).toHaveBeenCalledOnce();
  });
  it('uses the synchronous guard even without a feedback rerender', () => {
    const props = propsFor(); render(<JobSheet {...props} />); const confirm = within(openBachelor()).getByRole('button', { name: 'Confirm enrollment' });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); }); expect(props.enrollInDegree).toHaveBeenCalledOnce();
  });
  it('captures the displayed basis across changes and refreshes rejected details only for explicit reconfirmation', () => {
    const props = propsFor({ enrollInDegree: vi.fn().mockReturnValueOnce(rejected('stale_quote')).mockReturnValueOnce({ result: committedResult, persistence: null }) });
    const view = render(<JobSheet {...props} />); openBachelor();
    const updatedQuote = { ...quote, basis: 'education-quote-2', preview: { ...quote.preview, bankBefore: 90000, bankAfterEnrollment: 70000 } };
    view.rerender(<JobSheet {...props} bank={90000} stats={{ smarts: 90 }} quoteEducation={() => updatedQuote} />);
    expect(screen.getByRole('region', { name: 'Education decision preview' })).toHaveTextContent('Balance after enrollment: $80,000');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' }));
    expect(props.enrollInDegree.mock.calls[0][1].expectedBasis).toBe('education-quote-1'); expect(props.enrollInDegree).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('Enrollment details changed. Review the updated preview and confirm again.');
    expect(screen.getByRole('region', { name: 'Education decision preview' })).toHaveTextContent('Balance after enrollment: $70,000');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' }));
    expect(props.enrollInDegree.mock.calls[1][1].expectedBasis).toBe('education-quote-2');
    expect(props.enrollInDegree.mock.calls[1][1].actionId).not.toBe(props.enrollInDegree.mock.calls[0][1].actionId); expect(props.onClose).not.toHaveBeenCalled();
  });
  it.each([
    ['invalid_command', 'This enrollment decision is invalid. Close the preview and try again.'],
    ['invalid_state', 'Your education details are unavailable. Close the preview and try again.'],
    ['dead', 'This life has ended.'], ['unknown_degree', 'This degree is no longer available.'],
    ['already_enrolled', 'Finish your current degree before enrolling in another.'],
    ['prerequisite_required', 'Complete the required degree before enrolling.'],
    ['insufficient_funds', 'You need enough money for the first year of tuition.'],
    ['action_locked', 'Finish the current event or year before enrolling.'],
    ['action_id_conflict', 'This confirmation belongs to a different decision. Close the preview and try again.'],
  ])('explains %s without retrying or closing', (code, message) => {
    const props = propsFor({ enrollInDegree: vi.fn(() => rejected(code)) }); render(<JobSheet {...props} />); openBachelor();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' })); expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(props.enrollInDegree).toHaveBeenCalledOnce(); expect(props.onClose).not.toHaveBeenCalled();
  });
  it('keeps a specific prerequisite reason and disables ineligible confirmation', () => {
    const props = propsFor({ enrollInDegree: vi.fn(() => rejected('prerequisite_required')), quoteEducation: vi.fn().mockReturnValueOnce(quote).mockReturnValueOnce({ ...quote, eligible: false, code: 'prerequisite_required', reason: "Requires Bachelor's Degree first" }) });
    render(<JobSheet {...props} />); openBachelor(); fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Requires Bachelor's Degree first"); expect(screen.getByRole('button', { name: 'Confirm enrollment' })).toBeDisabled();
  });
  it('does not mask an action lock with a different refreshed requirement', () => {
    const props = propsFor({ enrollInDegree: vi.fn(() => rejected('action_locked')), quoteEducation: vi.fn().mockReturnValueOnce(quote).mockReturnValueOnce({ ...quote, eligible: false, code: 'prerequisite_required', reason: 'Requires HS Diploma first' }) });
    render(<JobSheet {...props} />); openBachelor(); fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Finish the current event or year before enrolling.'); expect(screen.getByRole('alert')).not.toHaveTextContent('Requires HS');
  });
  it.each(['saved', 'failed', 'skipped', 'not_requested'])('distinguishes a %s receipt from local enrollment', saveStatus => {
    render(<JobSheet {...propsFor({ lastEducationAction: feedbackFor(saveStatus) })} />); fireEvent.click(screen.getByRole('button', { name: /Education/ }));
    const feedback = screen.getByRole('status', { name: 'Education outcome' });
    const messages = { saved: 'Saved to cloud.', failed: 'Not saved to cloud.', skipped: 'Cloud save unavailable.', not_requested: 'No save requested.' };
    expect(feedback).toHaveTextContent(messages[saveStatus]); if (saveStatus !== 'saved') expect(feedback).not.toHaveTextContent('Saved to cloud.');
    if (['failed', 'skipped'].includes(saveStatus)) expect(feedback).toHaveTextContent('Reloading uses the last acknowledged save.');
  });
  it.each(['missing quote', 'missing result'])('handles %s with a generic failure and no close', variant => {
    const props = propsFor(variant === 'missing quote' ? { quoteEducation: vi.fn() } : { enrollInDegree: vi.fn() }); render(<JobSheet {...props} />); openBachelor();
    if (variant === 'missing result') fireEvent.click(screen.getByRole('button', { name: 'Confirm enrollment' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The enrollment could not be completed. Close the preview and try again.'); expect(props.onClose).not.toHaveBeenCalled();
  });
  it.each([
    ['master', "Master's Degree", 'bachelor', "Bachelor's Degree"], ['phd', 'PhD', 'master', "Master's Degree"],
  ])('shows the exact prerequisite for %s', (type, label, prerequisite, prerequisiteLabel) => {
    const props = propsFor({ education: { ...propsFor().education, [prerequisite]: true }, quoteEducation: () => ({ ...quote, targetId: type, preview: { ...quote.preview, degreeType: type, label, prerequisiteDegree: prerequisite, ...(type === 'phd' ? { annualTuition: 0, firstYearTuition: 0, remainingTuition: 0, totalTuition: 0, bankAfterEnrollment: 100000, annualHappinessEffect: -20, completionSmartsBonus: 3 } : {}) } }) });
    render(<JobSheet {...props} />); fireEvent.click(screen.getByRole('button', { name: /Education/ })); fireEvent.click(screen.getByRole('button', { name: new RegExp(`Enroll:.*${type === 'phd' ? 'PhD' : 'Master'}`) }));
    const preview = within(screen.getByRole('region', { name: 'Education decision preview' })); expect(preview.getByText(`Prerequisite: ${prerequisiteLabel} — met`)).toBeInTheDocument();
    if (type === 'phd') {
      for (const text of [/Pay now: \$0/, /Remaining tuition: \$0/, /Total tuition: \$0/, /Balance after enrollment: \$100,000/, /3.*−20 happiness/, /including.*completion/, /No immediate happiness debit/, /Happiness: \+3/, /clamp/]) expect(preview.getByText(text)).toBeInTheDocument();
      expectUntouched(props);
    }
  });
  it.each([[0, 1, 21000, 4], [4, 4, 0, 1]])('uses stored terms for program counter %s', (yearsInProgram, paidYears, remainingTuition, clicks) => {
    render(<JobSheet {...propsFor({ education: { ...propsFor().education, currentDegree: { type: 'bachelor', yearsInProgram, totalYears: 4, annualCost: 7000 } } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Education/ }));
    expect(screen.getByText(`Paid years: ${paidYears} of 4`)).toBeInTheDocument(); expect(screen.getByText(`Remaining tuition: $${remainingTuition.toLocaleString()}`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${clicks}.*Age click`))).toBeInTheDocument(); expect(screen.getByText(/\$7,000\/yr/)).toBeInTheDocument();
  });
  it('supports native Enter confirmation once', async () => {
    const user = userEvent.setup(); const props = propsFor(); render(<JobSheet {...props} />); openBachelor(); screen.getByRole('button', { name: 'Confirm enrollment' }).focus(); await user.keyboard('{Enter}'); expect(props.enrollInDegree).toHaveBeenCalledOnce();
  });
  it.each(['education', 'career'])('either pending %s receipt blocks consequential choices across domains', domain => {
    const props = propsFor({ [domain === 'education' ? 'lastEducationAction' : 'lastCareerAction']: feedbackFor('pending') }); render(<JobSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Education/ })); expect(screen.getByRole('button', { name: /Enroll:.*Bachelor/ })).toBeDisabled(); expect(screen.getByRole('button', { name: /Trade\/Vocational/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); fireEvent.click(screen.getByRole('button', { name: /Full-Time/ })); fireEvent.click(screen.getByRole('button', { name: /Tech/ })); expect(screen.getByRole('button', { name: /Software Developer/ })).toBeDisabled();
  });
  it('blocks military enlistment while education is saving and preserves the normal branch command', () => {
    const props = propsFor({ lastEducationAction: feedbackFor('pending') });
    const view = render(<JobSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Military/ }));
    const enlist = screen.getByRole('button', { name: /Enlist in Navy/ });
    expect(enlist).toBeDisabled(); fireEvent.click(enlist); expect(props.enlistMilitary).not.toHaveBeenCalled();
    view.rerender(<JobSheet {...props} lastEducationAction={feedbackFor('saved')} />);
    fireEvent.click(screen.getByRole('button', { name: /Enlist in Navy/ }));
    expect(props.enlistMilitary).toHaveBeenCalledExactlyOnceWith('Navy'); expect(props.onClose).toHaveBeenCalledOnce();
  });
  it('preserves the trade school narrative without using enrollment or debiting money', () => {
    const props = propsFor(); render(<JobSheet {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Education/ })); fireEvent.click(screen.getByRole('button', { name: /Trade\/Vocational/ }));
    expect(props.triggerActivityEvent).toHaveBeenCalledExactlyOnceWith('Applied to a Trade/Vocational School');
    expect(props.enrollInDegree).not.toHaveBeenCalled(); expect(props.debugModifyBank).not.toHaveBeenCalled(); expect(props.onClose).toHaveBeenCalledOnce();
  });
  it('shows one applicable feedback domain and never leaves both previews open', () => {
    const careerFeedback = { ...feedbackFor('saved'), result: { ...committedResult, actionType: 'career.choose', patch: { history: [{ text: 'Career changed.' }] } } };
    render(<JobSheet {...propsFor({ lastEducationAction: feedbackFor('saved'), lastCareerAction: careerFeedback })} />);
    expect(screen.getByRole('status', { name: 'Career outcome' })).toBeInTheDocument(); expect(screen.queryByRole('status', { name: 'Education outcome' })).not.toBeInTheDocument();
    openBachelor(); expect(screen.queryByRole('region', { name: 'Career decision preview' })).not.toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('status', { name: 'Education outcome' })).toBeInTheDocument(); expect(screen.queryByRole('status', { name: 'Career outcome' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' })); fireEvent.click(screen.getByRole('button', { name: /Full-Time/ })); fireEvent.click(screen.getByRole('button', { name: /Tech/ })); fireEvent.click(screen.getByRole('button', { name: /Software Developer/ }));
    expect(screen.getByRole('region', { name: 'Career decision preview' })).toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Education decision preview' })).not.toBeInTheDocument();
  });
  it('connects education quote/receipt props and discards a captured preview on UID change', () => {
    const props = propsFor({ lastEducationAction: feedbackFor('saved') });
    const view = render(<GameSheets engine={{ ...props, authAccount: { uid: 'first' } }} visibleSheet="job" closeSheet={props.onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Education/ })); expect(screen.getByRole('status', { name: 'Education outcome' })).toHaveTextContent('Saved to cloud.');
    fireEvent.click(screen.getByRole('button', { name: /Enroll:.*Bachelor/ })); expect(screen.getByRole('region', { name: 'Education decision preview' })).toHaveTextContent('Pay now: $20,000'); expect(props.quoteEducation).toHaveBeenCalledWith('bachelor');
    view.rerender(<GameSheets engine={{ ...props, authAccount: { uid: 'second' } }} visibleSheet="job" closeSheet={props.onClose} />);
    expect(screen.queryByRole('region', { name: 'Education decision preview' })).not.toBeInTheDocument(); expect(props.enrollInDegree).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Confirm enrollment' })).not.toBeInTheDocument();
  });
});
