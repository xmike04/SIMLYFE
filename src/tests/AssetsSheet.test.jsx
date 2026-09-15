import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AssetsSheet from '../components/sheets/AssetsSheet';

function renderAssets(overrides = {}) {
  const props = {
    bank: 10000,
    properties: [],
    belongings: [],
    career: null,
    economyCycle: { phase: 'normal' },
    buyAsset: vi.fn(),
    sellAsset: vi.fn(),
    buyInvestment: vi.fn(),
    sellInvestment: vi.fn(),
    modifyProperty: vi.fn(),
    triggerActivityEvent: vi.fn(),
    debugModifyBank: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<AssetsSheet {...props} />);
  return props;
}

function openInvestments() {
  fireEvent.click(screen.getByRole('button', { name: /Go Shopping/ }));
  fireEvent.click(screen.getByRole('button', { name: /Invest$/ }));
}

function openApexTech() {
  fireEvent.click(screen.getByRole('button', { name: /Stocks Company shares/ }));
  fireEvent.click(screen.getByRole('button', { name: /ApexTech Corp/ }));
}

describe('AssetsSheet navigation and investment actions', () => {
  it('validates investment amount, submits the canonical stock type, then returns to the list with a cleared amount', () => {
    const props = renderAssets();
    openInvestments();
    openApexTech();
    expect(screen.getByRole('button', { name: /Buy it/ })).toBeDisabled();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10001' } });
    expect(screen.getByRole('button', { name: 'Not enough cash' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '10%' }));
    expect(screen.getByRole('spinbutton')).toHaveValue(1000);
    fireEvent.click(screen.getByRole('button', { name: /Buy it/ }));
    expect(props.buyInvestment).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'apx_tech' }), 1000, 'stock');
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ApexTech Corp/ }));
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
  });

  it('resets investment drill-down on category changes and preserves the shop category when returning from the assets overview', () => {
    renderAssets();
    openInvestments();
    openApexTech();
    fireEvent.click(screen.getByRole('button', { name: '25%' }));
    fireEvent.click(screen.getByRole('button', { name: /Vehicles$/ }));
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Invest$/ }));
    expect(screen.getByText('Investment Types')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    fireEvent.click(screen.getByRole('button', { name: /Go Shopping/ }));
    expect(screen.getByText('Investment Types')).toBeInTheDocument();
    openApexTech();
    expect(screen.getByRole('spinbutton')).toHaveValue(null);
  });

  it('includes legacy plural stock holdings in the stock view and routes a sale through sellInvestment', () => {
    const props = renderAssets({ belongings: [{ id: 'owned-stock', name: 'My ApexTech', subType: 'stocks', instrumentId: 'apx_tech', currentValue: 1200, purchasePrice: 1000, units: 5 }] });
    openInvestments();
    fireEvent.click(screen.getByRole('button', { name: /Stocks Company shares/ }));
    expect(screen.getByText('My Holdings')).toBeInTheDocument();
    expect(screen.getByText('My ApexTech')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
    expect(props.sellInvestment).toHaveBeenCalledExactlyOnceWith('owned-stock');
    expect(props.sellAsset).not.toHaveBeenCalled();
  });

  it('routes selected property renovation with its original cost, value gain, event, and close behavior', () => {
    const props = renderAssets({ properties: [{ id: 'home', name: 'First Home', currentValue: 100000, purchasePrice: 90000, yearsOwned: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: /My Portfolio/ }));
    fireEvent.click(screen.getByRole('button', { name: /First Home/ }));
    fireEvent.click(screen.getByRole('button', { name: /Renovate/ }));
    expect(props.debugModifyBank).toHaveBeenCalledExactlyOnceWith(-10000);
    expect(props.modifyProperty).toHaveBeenCalledExactlyOnceWith('home', 25000);
    expect(props.triggerActivityEvent).toHaveBeenCalledExactlyOnceWith('Renovated my First Home for $10,000.');
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('clears a selected portfolio asset after a sale, so another asset can be selected', () => {
    const props = renderAssets({ belongings: [
      { id: 'watch', name: 'First Watch', currentValue: 500, purchasePrice: 400, yearsOwned: 1 },
      { id: 'car', name: 'First Car', currentValue: 5000, purchasePrice: 6000, yearsOwned: 1 },
    ] });
    fireEvent.click(screen.getByRole('button', { name: /My Portfolio/ }));
    fireEvent.click(screen.getByRole('button', { name: /First Watch/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sell Asset/ }));
    expect(props.sellAsset).toHaveBeenCalledExactlyOnceWith('belonging', 'watch');
    fireEvent.click(screen.getByRole('button', { name: /First Car/ }));
    expect(screen.getByText('Current Value: $5,000')).toBeInTheDocument();
  });
});
