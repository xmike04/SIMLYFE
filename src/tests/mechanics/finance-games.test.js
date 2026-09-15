/** finance games mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { computeGambleResult, executeTradePure } from '../../engine/mechanics/activities';

describe('Lottery logic (legacy mirror)', () => {
  const TICKET_COST = 5;
  const JACKPOT = 10_000_000;
  const WIN_RATE = 0.00001;

  function playLotteryPure(bank, randomValue) {
    if (bank < TICKET_COST) return { bank, won: false, error: 'insufficient funds' };
    const newBank = bank - TICKET_COST;
    if (randomValue < WIN_RATE) return { bank: newBank + JACKPOT, won: true };
    return { bank: newBank, won: false };
  }

  it('deducts $5 on a loss', () => {
    const { bank } = playLotteryPure(100, 0.5);
    expect(bank).toBe(95);
  });

  it('awards jackpot on win', () => {
    const { bank, won } = playLotteryPure(100, 0.000001);
    expect(won).toBe(true);
    expect(bank).toBe(100 - 5 + JACKPOT);
  });

  it('refuses play when bank < $5', () => {
    const { error } = playLotteryPure(4, 0.0);
    expect(error).toBe('insufficient funds');
  });

  it('correctly sets win threshold at 0.00001', () => {
    expect(playLotteryPure(100, 0.000009).won).toBe(true);
    expect(playLotteryPure(100, 0.00002).won).toBe(false);
  });
});

describe('Gambling logic', () => {
  it('wins 2× return on random < 0.45', () => {
    const { newBank: bank, outcome } = computeGambleResult(200, 100, 0.44);
    expect(outcome).toBe('win');
    expect(bank).toBe(300); // 200 - 100 + 200
  });

  it('returns half the wager on random from 0.45 to 0.70', () => {
    const { newBank: bank, outcome } = computeGambleResult(200, 100, 0.45);
    expect(outcome).toBe('partial');
    expect(bank).toBe(150);
  });

  it('loses wager on random >= 0.70', () => {
    const { newBank: bank, outcome } = computeGambleResult(200, 100, 0.70);
    expect(outcome).toBe('loss');
    expect(bank).toBe(100);
  });

  it('refuses when bank < amount', () => {
    expect(computeGambleResult(50, 100, 0.1).reason).toBe('insufficient_funds');
  });

  it.each([undefined, NaN, Infinity, 0, -1])('refuses invalid amount %s', (amount) => {
    expect(computeGambleResult(200, amount, 0.1).reason).toBe('invalid_amount');
  });
});

describe('Day trading logic', () => {
  it('wipes out on multiplier 0 (random < 0.4)', () => {
    const { bank, profit } = executeTradePure(1000, 100, 0.39);
    expect(profit).toBe(-1000);
    expect(bank).toBe(0);
  });

  it('loses half on multiplier 0.5 (random 0.4–0.59)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.5);
    expect(multiplier).toBe(0.5);
  });

  it('+50% on multiplier 1.5 (random 0.6–0.79)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.7);
    expect(multiplier).toBe(1.5);
  });

  it('+100% on multiplier 2 (random 0.8–0.94)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.85);
    expect(multiplier).toBe(2);
  });

  it('+400% moonshot on multiplier 5 (random >= 0.95)', () => {
    const { multiplier } = executeTradePure(1000, 100, 0.99);
    expect(multiplier).toBe(5);
  });

  it('uses percentage of bank correctly', () => {
    const { bank } = executeTradePure(1000, 50, 0.99); // 50% → $500 wager, ×5 = $2500
    expect(bank).toBe(1000 - 500 + 2500);
  });

  it('refuses when bank is 0', () => {
    const result = executeTradePure(0, 100, 0.5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_funds');
  });
});
