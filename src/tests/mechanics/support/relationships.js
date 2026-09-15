/** Legacy test-only helpers. These remain explicit migration targets; prefer real engine exports for new assertions. */


export function calcDivorceCost(bank) {
  return Math.min(50_000, Math.max(5_000, Math.floor(bank * 0.15)));
}
