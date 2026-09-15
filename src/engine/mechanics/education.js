/** Game rules extracted from the state owner; keep runtime behavior here testable. */

export const DEGREE_CONFIG = {
  highSchool: { years: 0,  annualCost: 0,     requires: null,         happinessEffect: 0   },
  associate:  { years: 2,  annualCost: 10000,  requires: 'highSchool', happinessEffect: 0   },
  bachelor:   { years: 4,  annualCost: 20000,  requires: 'highSchool', happinessEffect: 0   },
  master:     { years: 2,  annualCost: 30000,  requires: 'bachelor',   happinessEffect: 0   },
  phd:        { years: 4,  annualCost: 0,      requires: 'master',     happinessEffect: -20 },
};

export const DEGREE_LABELS = {
  highSchool: 'HS Diploma',
  associate:  "Associate's Degree",
  bachelor:   "Bachelor's Degree",
  master:     "Master's Degree",
  phd:        'PhD',
};

export const DEGREE_RANK = { highSchool: 0, associate: 1, bachelor: 2, master: 3, phd: 4 };

/** Career degree requirements are minimum levels, so higher completed degrees qualify. */
export function hasRequiredDegree(education, requiredDegree) {
  if (!requiredDegree) return true;
  const requiredRank = DEGREE_RANK[requiredDegree];
  if (requiredRank === undefined) return false;
  return Object.entries(DEGREE_RANK).some(
    ([degree, rank]) => rank >= requiredRank && education?.[degree] === true
  );
}

export const DEGREE_SMARTS_BONUS = { associate: 3, bachelor: 10, master: 5, phd: 3 };

/**
 * Enroll in a degree: charge year-1 tuition and set yearsInProgram = 1 (year 1 prepaid).
 * See docs/game-mechanics.md — Education.
 */
export function enrollDegree(degreeType, education, bank) {
  const cfg = DEGREE_CONFIG[degreeType];
  if (!cfg) return { error: 'Unknown degree type' };
  if (education.currentDegree !== null) return { error: 'Already enrolled in a program' };
  if (cfg.requires && !education[cfg.requires]) {
    return { error: `Requires ${DEGREE_LABELS[cfg.requires]} first` };
  }
  if (bank < cfg.annualCost) return { error: 'Insufficient funds for first year' };
  return {
    newEducation: {
      ...education,
      currentDegree: {
        type: degreeType,
        yearsInProgram: 1,
        totalYears: cfg.years,
        annualCost: cfg.annualCost,
      },
    },
    newBank: bank - cfg.annualCost,
  };
}

/**
 * Advance one enrolled school year.
 * yearsInProgram = years already paid. Charge then increment while yearsInProgram < totalYears.
 * Legacy saves with yearsInProgram === 0: skip charge (enroll already paid), bump to 1.
 */
export function advanceDegreeYear(education, stats, bank) {
  const deg = education.currentDegree;
  if (!deg) return { education, stats, bank, completed: false, history: null, charged: 0 };

  let newBank = bank;
  const newStats = { ...stats };
  const cfg = DEGREE_CONFIG[deg.type];
  if (cfg?.happinessEffect) {
    newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + cfg.happinessEffect));
  }

  let newYears;
  let charged = 0;
  if (deg.yearsInProgram === 0) {
    newYears = 1;
  } else if (deg.yearsInProgram < deg.totalYears) {
    charged = deg.annualCost;
    newBank -= deg.annualCost;
    newYears = deg.yearsInProgram + 1;
  } else {
    newYears = deg.yearsInProgram;
  }

  if (newYears >= deg.totalYears) {
    const bonus = DEGREE_SMARTS_BONUS[deg.type] ?? 0;
    newStats.smarts = Math.max(0, Math.min(100, newStats.smarts + bonus));
    newStats.happiness = Math.max(0, Math.min(100, newStats.happiness + 3));
    return {
      education: { ...education, [deg.type]: true, currentDegree: null },
      stats: newStats,
      bank: newBank,
      completed: true,
      completedType: deg.type,
      charged,
      history: `Education: You earned your ${DEGREE_LABELS[deg.type]}! +${bonus} Smarts.`,
    };
  }

  return {
    education: { ...education, currentDegree: { ...deg, yearsInProgram: newYears } },
    stats: newStats,
    bank: newBank,
    completed: false,
    charged,
    history: charged
      ? `Education: Year ${newYears}/${deg.totalYears} of your ${DEGREE_LABELS[deg.type]}. ($${charged.toLocaleString()} paid)`
      : `Education: Year ${newYears}/${deg.totalYears} of your ${DEGREE_LABELS[deg.type]}.`,
  };
}

/**
 * School-year grades drift by smarts. Missing grades default to 70; an earned
 * grade of 0 stays 0 (nullish default, not falsy — see src/tests/mechanics/life-state.test.js).
 */
export function computeGradesDrift(grades, smarts) {
  const current = grades ?? 70;
  if (smarts > 70) return Math.min(100, current + 2);
  if (smarts < 40) return Math.max(0, current - 5);
  return Math.max(0, current - 1);
}
