/**
 * firestoreRules.test.js
 *
 * Guards firestore.rules against drifting from the app's save schema.
 * The rules' hasOnly([...]) write allowlist must stay in sync with
 * LIFE_SAVE_KEYS (gameState.js) and KNOWN_SAVE_FIELDS (stateValidation.js):
 * a field the app persists but the rules don't list would make every cloud
 * write fail once the rules are deployed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LIFE_SAVE_KEYS } from '../engine/gameState';
import { KNOWN_SAVE_FIELDS } from '../engine/stateValidation';

// Vitest runs with cwd at the repo root (where vite.config.js lives).
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('firestore.rules', () => {
  it('scopes the life save to its owner', () => {
    expect(rules).toContain('match /users/{userId}/saves/currentLife');
    expect(rules).toContain('request.auth.uid == userId');
  });

  it('denies everything not explicitly matched', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  });

  it('keeps the careers catalog read-only for signed-in players', () => {
    const careersBlock = rules.match(/match \/careers\/\{careerId\}[^}]*\}/)?.[0] ?? '';
    expect(careersBlock).toContain('allow read: if request.auth != null;');
    expect(careersBlock).not.toContain('allow write');
    expect(careersBlock).not.toContain('allow create');
    expect(careersBlock).not.toContain('allow update');
  });

  it('write allowlist matches the known save schema exactly', () => {
    const hasOnly = rules.match(/hasOnly\(\[([\s\S]*?)\]\)/);
    expect(hasOnly).not.toBeNull();
    const ruleKeys = [...hasOnly[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

    // No duplicates, exact match with the app's known-field universe, and
    // every persisted life key is writable.
    expect(new Set(ruleKeys).size).toBe(ruleKeys.length);
    expect([...ruleKeys].sort()).toEqual([...KNOWN_SAVE_FIELDS].sort());
    for (const key of LIFE_SAVE_KEYS) {
      expect(ruleKeys).toContain(key);
    }
  });
});
