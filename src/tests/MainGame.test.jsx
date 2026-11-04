import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import MainGame from '../components/MainGame';
import EventModal from '../components/EventModal';

function createEngine(overrides = {}) {
  return {
    character: { name: 'UI Test', country: 'United States' },
    age: 25,
    bank: 1000,
    stats: { happiness: 70, health: 80, smarts: 75, looks: 60, athleticism: 50, karma: 50 },
    history: [{ age: 0, text: 'I was born.' }],
    career: null,
    careersData: [],
    careerMeta: {},
    education: {},
    relationships: [],
    properties: [],
    belongings: [],
    pets: [],
    activitiesThisYear: {},
    economyCycle: { phase: 'normal' },
    networking: 0,
    narrativeMode: false,
    authAccount: { isAnonymous: true },
    ageUp: vi.fn(),
    setNarrativeMode: vi.fn(),
    visitDoctor: vi.fn(),
    performActivity: vi.fn(() => 'ok'),
    consumeYearlyActivity: vi.fn(() => true),
    trainHiddenSkill: vi.fn(() => 4),
    triggerActivityEvent: vi.fn(),
    debugModifyBank: vi.fn(),
    ...overrides,
  };
}

function openMindAndBody() {
  fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
  fireEvent.click(screen.getByRole('button', { name: /Mind & Body/ }));
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  // jsdom has no layout or scrolling implementation.
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterAll(() => {
  if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  else delete HTMLElement.prototype.scrollIntoView;
});

describe('MainGame sheet navigation', () => {
  it('routes a special category to its sheet, invokes its engine action, and resets the menu on close', () => {
    const engine = createEngine();
    render(<MainGame engine={engine} />);
    fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
    fireEvent.click(screen.getByRole('button', { name: /Doctor/ }));
    expect(screen.getByRole('heading', { name: 'Doctor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /General Checkup/ }));
    expect(engine.visitDoctor).toHaveBeenCalledExactlyOnceWith('checkup');
    expect(screen.queryByRole('heading', { name: 'Doctor' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
    expect(screen.getByRole('button', { name: /Mind & Body/ })).toBeInTheDocument();
  });

  it.each([{ isAging: true }, { currentEvent: { description: 'A choice is pending' } }])(
    'hides sheets and blocks controls during an engine freeze (%j), preserving the selected activity menu',
    frozen => {
      const engine = createEngine();
      const { rerender } = render(<MainGame engine={engine} />);
      openMindAndBody();
      rerender(<MainGame engine={{ ...engine, ...frozen }} />);
      expect(screen.queryByRole('heading', { name: 'Mind & Body' })).not.toBeInTheDocument();
      for (const name of [/Activities/, /Assets/, /Relationships/, /Job/, /Account/, /Quick/]) {
        const button = screen.getByRole('button', { name });
        expect(button).toBeDisabled();
        fireEvent.click(button);
      }
      const ageButton = document.querySelector('.age-btn');
      expect(ageButton).toBeDisabled();
      fireEvent.click(ageButton);
      expect(engine.ageUp).not.toHaveBeenCalled();
      expect(engine.setNarrativeMode).not.toHaveBeenCalled();
      rerender(<MainGame engine={engine} />);
      expect(screen.getByRole('heading', { name: 'Mind & Body' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /\+\s*Age/ }));
      expect(engine.ageUp).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
      expect(screen.getByRole('heading', { name: 'Activities' })).toBeInTheDocument();
    }
  );

  it('keeps the menu open when the engine rejects an activity and closes after acceptance', () => {
    const engine = createEngine({ performActivity: vi.fn().mockReturnValueOnce('locked').mockReturnValueOnce('ok') });
    render(<MainGame engine={engine} />);
    openMindAndBody();
    fireEvent.click(screen.getByRole('button', { name: /Meditate/ }));
    expect(screen.getByRole('heading', { name: 'Mind & Body' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Meditate/ }));
    expect(engine.performActivity).toHaveBeenLastCalledWith(expect.objectContaining({ text: 'Meditate' }), 'mind_body');
    expect(screen.queryByRole('heading', { name: 'Mind & Body' })).not.toBeInTheDocument();
  });

  it('checks the yearly engine guard before training and disables an already consumed activity', () => {
    const engine = createEngine({ consumeYearlyActivity: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true) });
    const { rerender } = render(<MainGame engine={engine} />);
    openMindAndBody();
    fireEvent.click(screen.getByRole('button', { name: 'Go to the Gym' }));
    expect(engine.consumeYearlyActivity).toHaveBeenCalledWith('mind_body', 'Go to the Gym', 1);
    expect(engine.trainHiddenSkill).not.toHaveBeenCalled();
    expect(engine.triggerActivityEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Go to the Gym' }));
    expect(engine.trainHiddenSkill).toHaveBeenCalledExactlyOnceWith('athleticism');
    expect(engine.triggerActivityEvent).toHaveBeenCalledExactlyOnceWith('Went to the gym for an intense workout session');
    expect(engine.debugModifyBank).not.toHaveBeenCalled();
    rerender(<MainGame engine={{ ...engine, activitiesThisYear: { 'mind_body__Go to the Gym': 1 } }} />);
    openMindAndBody();
    const gym = screen.getByRole('button', { name: /Go to the Gym.*Done this year/ });
    expect(gym).toBeDisabled();
    fireEvent.click(gym);
    expect(engine.trainHiddenSkill).toHaveBeenCalledOnce();
  });

  it('retains age, bank, and stat restrictions in the extracted activities sheet', () => {
    const engine = createEngine({ age: 4, bank: 20, stats: { ...createEngine().stats, looks: 10 } });
    const { rerender } = render(<MainGame engine={engine} />);
    fireEvent.click(screen.getByRole('button', { name: /Activities/ }));
    expect(screen.getByRole('button', { name: /Lottery.*Age 18/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Mind & Body/ }));
    expect(screen.getByRole('button', { name: /Acting Lessons.*Need \$50/ })).toBeDisabled();
    rerender(<MainGame engine={{ ...engine, bank: 100 }} />);
    expect(screen.getByRole('button', { name: /Modeling Classes.*Requires looks 30/ })).toBeDisabled();
  });
});


describe('continuity save announcements', () => {
  it.each([
    ['pending', 'Saving progress…'],
    ['saved', 'Progress saved to the cloud.'],
    ['failed', 'Progress remains in this session, but saving failed. Reloading may restore an older save.'],
    ['skipped', 'Progress remains in this session, but cloud saving is unavailable. Reloading may restore an older save.'],
  ])('announces %s without provider details', (saveStatus, message) => {
    render(<MainGame engine={createEngine({ lastContinuitySave: { id: 'save', kind: 'activity', saveStatus, operationId: null, error: 'PRIVATE PROVIDER DETAIL' } })} />);
    const status = screen.getByRole('status', { name: 'Progress save status' });
    expect(status).toHaveTextContent(message);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(document.body).not.toHaveTextContent('PRIVATE PROVIDER DETAIL');
  });

  it('renders one announcement inside an open event and none for null feedback', () => {
    const event = { description: 'An offered choice', choices: [{ text: 'Continue', effects: {} }] };
    const feedback = { id: 'save', kind: 'event_offered', saveStatus: 'pending', operationId: null };
    const { rerender } = render(<><MainGame engine={createEngine({ currentEvent: event, lastContinuitySave: feedback })} /><EventModal event={event} onChoice={vi.fn()} saveFeedback={feedback} /></>);
    const status = screen.getByRole('status', { name: 'Progress save status' });
    expect(status).toHaveTextContent('Saving progress…');
    expect(status.closest('.glass-panel')).toHaveTextContent('An offered choice');
    rerender(<><MainGame engine={createEngine({ currentEvent: event, lastContinuitySave: null })} /><EventModal event={event} onChoice={vi.fn()} saveFeedback={null} /></>);
    expect(screen.queryByRole('status', { name: 'Progress save status' })).not.toBeInTheDocument();
  });
});
