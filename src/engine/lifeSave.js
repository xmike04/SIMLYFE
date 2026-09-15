/** Canonical saved-life fields and defaults. */

export const INITIAL_STATS = { health: 80, happiness: 80, smarts: 50, looks: 50, grades: 70, athleticism: 50, karma: 50, acting: 0, voice: 0, modeling: 0 };

export const INITIAL_EDUCATION = { highSchool: false, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };

export const INITIAL_CAREER_META = { yearsInRole: 0, isOnPIP: false, financialStressFlag: false, unemploymentYearsLeft: 0 };

export const INITIAL_ECONOMY = { year: 0, phase: 'normal', yearsInPhase: 0 };

/** Keys always written on life-boundary cloud replaces (startLife / resetLife).
 * See docs/architecture.md — Cloud sync modes / Death restart flow.
 */
export const LIFE_SAVE_KEYS = [
  'character', 'age', 'stats', 'bank', 'history', 'isDead', 'flags',
  'career', 'careerMeta', 'relationships', 'belongings', 'properties',
  'education', 'networking', 'economyCycle', 'pets', 'will',
];

/**
 * Canonical persisted life document. Always includes every LIFE_SAVE_KEYS entry.
 * Nulls/empties are intentional so setDoc without merge wipes prior-life leftovers.
 * See docs/architecture.md.
 */
export function buildLifeSave(fields = {}) {
  return {
    character: fields.character ?? null,
    age: fields.age ?? 0,
    stats: fields.stats ?? { ...INITIAL_STATS },
    bank: fields.bank ?? 0,
    history: fields.history ?? [],
    isDead: fields.isDead ?? false,
    flags: fields.flags ?? [],
    career: fields.career ?? null,
    careerMeta: fields.careerMeta ? { ...fields.careerMeta } : { ...INITIAL_CAREER_META },
    relationships: fields.relationships ?? [],
    belongings: fields.belongings ?? [],
    properties: fields.properties ?? [],
    education: fields.education ? { ...fields.education } : { ...INITIAL_EDUCATION },
    networking: fields.networking ?? 0,
    economyCycle: fields.economyCycle ? { ...fields.economyCycle } : { ...INITIAL_ECONOMY },
    pets: fields.pets ?? [],
    will: fields.will ?? null,
  };
}
