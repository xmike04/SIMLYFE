/** Game rules extracted from the state owner; keep runtime behavior here testable. */

export function yearlyActivityTrackId(categoryId, itemText) {
  return `${categoryId}__${itemText}`;
}

export function canConsumeYearlyActivity(activitiesThisYear, categoryId, itemText, yearlyLimit) {
  if (!yearlyLimit) return true;
  const count = (activitiesThisYear ?? {})[yearlyActivityTrackId(categoryId, itemText)] ?? 0;
  return count < yearlyLimit;
}

export function computeGambleResult(bank, amount, randomValue) {
  if (!Number.isFinite(bank) || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (bank < amount) return { ok: false, reason: 'insufficient_funds' };
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    return { ok: false, reason: 'invalid_random' };
  }
  if (randomValue < 0.45) {
    return { ok: true, outcome: 'win', newBank: bank + amount, happinessDelta: 5, payout: amount * 2 };
  }
  if (randomValue < 0.70) {
    const payout = Math.floor(amount * 0.5);
    return { ok: true, outcome: 'partial', newBank: bank - amount + payout, happinessDelta: -5, payout };
  }
  return { ok: true, outcome: 'loss', newBank: bank - amount, happinessDelta: -5, payout: 0 };
}

/** Day-trade outcome with injectable randomness — the hook supplies Math.random(). */
export function executeTradePure(bank, percentage, randomValue) {
  if (!Number.isFinite(bank) || bank <= 0) return { ok: false, reason: 'no_funds' };
  const wager = Math.floor(bank * (percentage / 100));
  let multiplier;
  if (randomValue < 0.4) multiplier = 0;
  else if (randomValue < 0.6) multiplier = 0.5;
  else if (randomValue < 0.8) multiplier = 1.5;
  else if (randomValue < 0.95) multiplier = 2;
  else multiplier = 5;
  const payout = Math.floor(wager * multiplier);
  const profit = payout - wager;
  return { ok: true, bank: bank + profit, wager, payout, profit, multiplier };
}
