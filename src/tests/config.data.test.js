/**
 * config.data.test.js
 *
 * Validates the structure and consistency of:
 *   1. ACTIVITY_CATEGORIES — every category has required fields, no duplicates
 *   2. ACTIVITY_MENUS — every menu item is valid, no orphan keys, no missing menus
 *   3. SPECIAL_CAREERS — every career and action has required fields, no duplicates
 */

import { describe, it, expect } from 'vitest';
import { ACTIVITY_CATEGORIES, ACTIVITY_MENUS } from '../config/activities';
import { SPECIAL_CAREERS } from '../config/specialCareers';

// ─── 1. ACTIVITY_CATEGORIES ───────────────────────────────────────────────────

describe('ACTIVITY_CATEGORIES', () => {
  const SPECIAL_TYPES = new Set(['doctor', 'lottery', 'casino']);

  it('is a non-empty array', () => {
    expect(Array.isArray(ACTIVITY_CATEGORIES)).toBe(true);
    expect(ACTIVITY_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('every category has id, name, icon, minAge, color', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      expect(cat, `Category missing "id"`).toHaveProperty('id');
      expect(cat, `Category "${cat.id}" missing "name"`).toHaveProperty('name');
      expect(cat, `Category "${cat.id}" missing "icon"`).toHaveProperty('icon');
      expect(cat, `Category "${cat.id}" missing "minAge"`).toHaveProperty('minAge');
      expect(cat, `Category "${cat.id}" missing "color"`).toHaveProperty('color');
    }
  });

  it('no duplicate category IDs', () => {
    const ids = ACTIVITY_CATEGORIES.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('no duplicate category names', () => {
    const names = ACTIVITY_CATEGORIES.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('minAge is a non-negative integer', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      expect(Number.isInteger(cat.minAge), `${cat.id}: minAge must be integer`).toBe(true);
      expect(cat.minAge).toBeGreaterThanOrEqual(0);
    }
  });

  it('minBank is a positive number when present', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      if (cat.minBank !== undefined) {
        expect(cat.minBank, `${cat.id}: minBank must be positive`).toBeGreaterThan(0);
      }
    }
  });

  it('icon is a non-empty string', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      expect(typeof cat.icon).toBe('string');
      expect(cat.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('isSpecial values are recognized types when present', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      if (cat.isSpecial !== undefined) {
        expect(SPECIAL_TYPES.has(cat.isSpecial), `Unknown isSpecial "${cat.isSpecial}" in category "${cat.id}"`).toBe(true);
      }
    }
  });

  it('non-special categories that need menus have corresponding ACTIVITY_MENUS entry', () => {
    for (const cat of ACTIVITY_CATEGORIES) {
      if (!cat.isSpecial) {
        expect(
          ACTIVITY_MENUS[cat.id],
          `Category "${cat.id}" has no isSpecial but is missing from ACTIVITY_MENUS`
        ).toBeDefined();
      }
    }
  });
});

// ─── 2. ACTIVITY_MENUS ────────────────────────────────────────────────────────

describe('ACTIVITY_MENUS', () => {
  const ALL_SPECIAL_ACTIONS = new Set([
    'gym', 'run',
    'act_lesson', 'voice_lesson', 'model_lesson',
    'open_dating_ui', 'open_wills_ui',
    'networking_mixer',
    'startStartup',
  ]);

  it('is a plain object', () => {
    expect(typeof ACTIVITY_MENUS).toBe('object');
    expect(Array.isArray(ACTIVITY_MENUS)).toBe(false);
  });

  it('no orphan menu keys — every menu key has a matching ACTIVITY_CATEGORIES id', () => {
    const categoryIds = new Set(ACTIVITY_CATEGORIES.map(c => c.id));
    for (const key of Object.keys(ACTIVITY_MENUS)) {
      expect(categoryIds.has(key), `Menu key "${key}" has no matching ACTIVITY_CATEGORIES entry`).toBe(true);
    }
  });

  it('every menu is a non-empty array', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      expect(Array.isArray(menu), `Menu "${key}" is not an array`).toBe(true);
      expect(menu.length, `Menu "${key}" is empty`).toBeGreaterThan(0);
    }
  });

  it('every menu item has a text field', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      for (const item of menu) {
        expect(item, `Item in menu "${key}" missing "text"`).toHaveProperty('text');
        expect(typeof item.text).toBe('string');
        expect(item.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every menu item has either context or specialAction', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      for (const item of menu) {
        const hasContext = item.context !== undefined;
        const hasSpecial = item.specialAction !== undefined;
        expect(
          hasContext || hasSpecial,
          `Menu item "${item.text}" in "${key}" has neither context nor specialAction`
        ).toBe(true);
      }
    }
  });

  it('specialAction values are recognized', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      for (const item of menu) {
        if (item.specialAction !== undefined) {
          expect(
            ALL_SPECIAL_ACTIONS.has(item.specialAction),
            `Unknown specialAction "${item.specialAction}" in menu "${key}" → item "${item.text}"`
          ).toBe(true);
        }
      }
    }
  });

  it('context strings are non-empty when present', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      for (const item of menu) {
        if (item.context !== undefined) {
          expect(
            item.context.trim().length,
            `Empty context string for "${item.text}" in menu "${key}"`
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no duplicate text labels within a single menu', () => {
    for (const [key, menu] of Object.entries(ACTIVITY_MENUS)) {
      const labels = menu.map(i => i.text);
      const unique = new Set(labels);
      expect(unique.size, `Duplicate menu item texts in "${key}": ${labels}`).toBe(labels.length);
    }
  });
});

// ─── 3. SPECIAL_CAREERS ──────────────────────────────────────────────────────

describe('SPECIAL_CAREERS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SPECIAL_CAREERS)).toBe(true);
    expect(SPECIAL_CAREERS.length).toBeGreaterThan(0);
  });

  it('every career has id, name, icon, description, actions', () => {
    for (const career of SPECIAL_CAREERS) {
      expect(career).toHaveProperty('id');
      expect(career, `Career "${career.id}" missing "name"`).toHaveProperty('name');
      expect(career, `Career "${career.id}" missing "icon"`).toHaveProperty('icon');
      expect(career, `Career "${career.id}" missing "description"`).toHaveProperty('description');
      expect(career, `Career "${career.id}" missing "actions"`).toHaveProperty('actions');
    }
  });

  it('no duplicate career IDs', () => {
    const ids = SPECIAL_CAREERS.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('no duplicate career names', () => {
    const names = SPECIAL_CAREERS.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('every career has at least 2 actions', () => {
    for (const career of SPECIAL_CAREERS) {
      expect(career.actions.length, `Career "${career.id}" has fewer than 2 actions`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every action has a text field', () => {
    for (const career of SPECIAL_CAREERS) {
      for (const action of career.actions) {
        expect(action, `Action in "${career.id}" missing "text"`).toHaveProperty('text');
        expect(action.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('every action has a context field', () => {
    for (const career of SPECIAL_CAREERS) {
      for (const action of career.actions) {
        expect(action, `Action "${action.text}" in "${career.id}" missing "context"`).toHaveProperty('context');
        expect(action.context.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('action costs are positive numbers when present', () => {
    for (const career of SPECIAL_CAREERS) {
      for (const action of career.actions) {
        if (action.cost !== undefined) {
          expect(typeof action.cost).toBe('number');
          expect(action.cost, `Cost in "${career.id}" → "${action.text}" must be positive`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no duplicate action text within a single career', () => {
    for (const career of SPECIAL_CAREERS) {
      const texts = career.actions.map(a => a.text);
      const unique = new Set(texts);
      expect(unique.size, `Duplicate action texts in career "${career.id}"`).toBe(texts.length);
    }
  });

  it('description is a non-empty string', () => {
    for (const career of SPECIAL_CAREERS) {
      expect(typeof career.description).toBe('string');
      expect(career.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('icon is a non-empty string', () => {
    for (const career of SPECIAL_CAREERS) {
      expect(typeof career.icon).toBe('string');
      expect(career.icon.trim().length).toBeGreaterThan(0);
    }
  });

  it('all career IDs follow the sc_ prefix convention', () => {
    for (const career of SPECIAL_CAREERS) {
      expect(career.id.startsWith('sc_'), `Career id "${career.id}" should start with "sc_"`).toBe(true);
    }
  });
});
