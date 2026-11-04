import { expect } from '@playwright/test';

export async function expectFullyInsideScrollport(locator) {
  await expect(locator).toBeVisible();
  const bounds = await locator.evaluate(node => {
    const rect = node.getBoundingClientRect();
    let top = 0, bottom = innerHeight, left = 0, right = innerWidth;
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const box = parent.getBoundingClientRect();
      if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
        top = Math.max(top, box.top + parent.clientTop);
        bottom = Math.min(bottom, box.top + parent.clientTop + parent.clientHeight);
      }
      if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
        left = Math.max(left, box.left + parent.clientLeft);
        right = Math.min(right, box.left + parent.clientLeft + parent.clientWidth);
      }
    }
    return {
      element: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
      scrollport: { top, bottom, left, right },
      // clientWidth/clientHeight round fractional scrollport edges to CSS pixels.
      // Allow half a CSS pixel against those bounds, never a percentage of the control.
      fullyInside: rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5 && rect.left >= left - 0.5 && rect.right <= right + 0.5,
    };
  });
  expect(bounds, JSON.stringify(bounds)).toMatchObject({ fullyInside: true });
  return bounds;
}
