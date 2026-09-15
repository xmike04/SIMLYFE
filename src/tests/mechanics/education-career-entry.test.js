/** education career entry mechanics, grouped from the original engine regression suite. */
import { describe, it, expect } from 'vitest';
import { enrollDegree, DEGREE_CONFIG as ENGINE_DEGREE_CONFIG, DEGREE_LABELS as ENGINE_DEGREE_LABELS, advanceDegreeYear, hasRequiredDegree } from '../../engine/mechanics/education';
import { HEADHUNTER_COST, canAffordHeadhunter, pickHeadhunterPlacement, MILITARY_ENLIST_CAREER_ID } from '../../engine/mechanics/careers';

import { checkCareerEligibility } from '../../engine/mechanics/careers';

describe('checkCareerEligibility', () => {
  const baseEdu    = { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };
  const baseStats  = { smarts: 60, health: 70, athleticism: 50, karma: 50 };
  const networking = 30;

  const career = {
    id: 'senior_dev', minAge: 25, requiresDegree: 'bachelor',
    requiresNetworking: 20, statRequirements: { smarts: 55 },
  };

  it('ineligible — too young', () => {
    const { eligible, reason } = checkCareerEligibility(career, { ...baseEdu, bachelor: true }, baseStats, networking, 22);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/age 25/);
  });

  it('ineligible — missing degree', () => {
    const { eligible, reason } = checkCareerEligibility(career, baseEdu, baseStats, networking, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/Bachelor/i);
  });

  it('ineligible — networking too low', () => {
    const edu = { ...baseEdu, bachelor: true };
    const { eligible, reason } = checkCareerEligibility(career, edu, baseStats, 10, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/Networking/);
  });

  it('ineligible — stat requirement not met', () => {
    const edu = { ...baseEdu, bachelor: true };
    const low = { ...baseStats, smarts: 40 };
    const { eligible, reason } = checkCareerEligibility(career, edu, low, networking, 26);
    expect(eligible).toBe(false);
    expect(reason).toMatch(/smarts/);
  });

  it('eligible — all conditions met', () => {
    const edu = { ...baseEdu, bachelor: true };
    const { eligible } = checkCareerEligibility(career, edu, baseStats, networking, 26);
    expect(eligible).toBe(true);
  });

  it('null requiresDegree skips degree check', () => {
    const noDegreeCareer = { ...career, requiresDegree: null };
    const { eligible } = checkCareerEligibility(noDegreeCareer, baseEdu, baseStats, networking, 26);
    expect(eligible).toBe(true);
  });

  it('zero requiresNetworking skips networking check', () => {
    const noNetCareer = { ...career, requiresDegree: null, requiresNetworking: 0 };
    const { eligible } = checkCareerEligibility(noNetCareer, baseEdu, baseStats, 0, 26);
    expect(eligible).toBe(true);
  });

  it('empty statRequirements skips stat check', () => {
    const noStatCareer = { ...career, requiresDegree: null, requiresNetworking: 0, statRequirements: {} };
    const { eligible } = checkCareerEligibility(noStatCareer, baseEdu, {}, 0, 26);
    expect(eligible).toBe(true);
  });
});

describe('enrollDegree', () => {
  const baseEdu = { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };

  it('error if already enrolled', () => {
    const edu = { ...baseEdu, currentDegree: { type: 'associate', yearsInProgram: 1, totalYears: 2, annualCost: 10000 } };
    const { error } = enrollDegree('bachelor', edu, 100000);
    expect(error).toMatch(/already enrolled/i);
  });

  it('error if prerequisite not held', () => {
    const { error } = enrollDegree('master', baseEdu, 100000);
    expect(error).toMatch(/Bachelor/i);
  });

  it('error if bank < annualCost', () => {
    const { error } = enrollDegree('bachelor', baseEdu, 5000);
    expect(error).toMatch(/Insufficient/i);
  });

  it('success — yearsInProgram starts at 1 (year 1 prepaid)', () => {
    const { newEducation } = enrollDegree('bachelor', baseEdu, 100000);
    expect(newEducation.currentDegree.type).toBe('bachelor');
    expect(newEducation.currentDegree.yearsInProgram).toBe(1);
    expect(newEducation.currentDegree.totalYears).toBe(4);
  });

  it('success — first year cost deducted from bank', () => {
    const { newBank } = enrollDegree('bachelor', baseEdu, 100000);
    expect(newBank).toBe(80000);
  });

  it('PhD has zero annual cost', () => {
    const richEdu = { ...baseEdu, bachelor: true, master: true };
    const { newBank } = enrollDegree('phd', richEdu, 50000);
    expect(newBank).toBe(50000);
  });

  it('associate requires only high school', () => {
    const { error } = enrollDegree('associate', baseEdu, 100000);
    expect(error).toBeUndefined();
  });

  it('bachelor catalog defines four annual tuition payments', () => {
    expect(ENGINE_DEGREE_CONFIG.bachelor.years).toBe(4);
    expect(ENGINE_DEGREE_CONFIG.bachelor.annualCost).toBe(20_000);
    expect(ENGINE_DEGREE_LABELS.bachelor).toBeTruthy();
  });
});

describe('advanceDegreeYear', () => {
  const baseStats = { smarts: 50, happiness: 70 };
  const enrolledBachelor = {
    highSchool: true, bachelor: false, currentDegree: { type: 'bachelor', yearsInProgram: 1, totalYears: 4, annualCost: 20000 }
  };
  const finalYearBachelor = {
    highSchool: true, bachelor: false, currentDegree: { type: 'bachelor', yearsInProgram: 3, totalYears: 4, annualCost: 20000 }
  };

  it('increments yearsInProgram each year', () => {
    const { education } = advanceDegreeYear(enrolledBachelor, baseStats, 100000);
    expect(education.currentDegree.yearsInProgram).toBe(2);
  });

  it('deducts annual cost from bank for subsequent years', () => {
    const { bank, charged } = advanceDegreeYear(enrolledBachelor, baseStats, 100000);
    expect(charged).toBe(20000);
    expect(bank).toBe(80000);
  });

  it('legacy yearsInProgram 0 skips charge (enroll already paid)', () => {
    const legacy = {
      highSchool: true, bachelor: false,
      currentDegree: { type: 'bachelor', yearsInProgram: 0, totalYears: 4, annualCost: 20000 },
    };
    const { bank, charged, education } = advanceDegreeYear(legacy, baseStats, 100000);
    expect(charged).toBe(0);
    expect(bank).toBe(100000);
    expect(education.currentDegree.yearsInProgram).toBe(1);
  });

  it('PhD applies -20 happiness per year', () => {
    const phdEdu = {
      ...enrolledBachelor,
      master: true,
      currentDegree: { type: 'phd', yearsInProgram: 1, totalYears: 4, annualCost: 0 }
    };
    const { stats } = advanceDegreeYear(phdEdu, baseStats, 50000);
    expect(stats.happiness).toBe(50);
  });

  it('completes degree when yearsInProgram reaches totalYears', () => {
    const { completed, completedType } = advanceDegreeYear(finalYearBachelor, baseStats, 100000);
    expect(completed).toBe(true);
    expect(completedType).toBe('bachelor');
  });

  it('on completion: sets bachelor=true and clears currentDegree', () => {
    const { education } = advanceDegreeYear(finalYearBachelor, baseStats, 100000);
    expect(education.bachelor).toBe(true);
    expect(education.currentDegree).toBeNull();
  });

  it('on completion: +10 smarts for bachelor', () => {
    const { stats } = advanceDegreeYear(finalYearBachelor, baseStats, 100000);
    expect(stats.smarts).toBe(60);
  });

  it('on completion: +3 happiness for all degrees', () => {
    const { stats } = advanceDegreeYear(finalYearBachelor, baseStats, 100000);
    expect(stats.happiness).toBeGreaterThan(baseStats.happiness);
  });

  it('no-op when no currentDegree enrolled', () => {
    const noEnrollEdu = { highSchool: true, currentDegree: null };
    const { completed, bank } = advanceDegreeYear(noEnrollEdu, baseStats, 50000);
    expect(completed).toBe(false);
    expect(bank).toBe(50000);
  });

  it('enroll + N-1 ageUps for N-year degree charges exactly N tuition payments', () => {
    const baseEdu = { highSchool: true, associate: false, bachelor: false, master: false, phd: false, currentDegree: null };
    let bank = 100000;
    let edu = baseEdu;
    let stats = { ...baseStats };

    const enrolled = enrollDegree('bachelor', edu, bank);
    edu = enrolled.newEducation;
    bank = enrolled.newBank;
    expect(bank).toBe(80000);

    let completed = false;
    for (let i = 0; i < 3; i++) {
      const step = advanceDegreeYear(edu, stats, bank);
      edu = step.education;
      stats = step.stats;
      bank = step.bank;
      completed = step.completed;
    }
    expect(completed).toBe(true);
    expect(bank).toBe(20000); // 100000 - 4*20000
    expect(edu.bachelor).toBe(true);
    expect(edu.currentDegree).toBeNull();
  });
});

describe('canAffordHeadhunter', () => {
  it('requires HEADHUNTER_COST', () => {
    expect(HEADHUNTER_COST).toBe(1000);
    expect(canAffordHeadhunter(999)).toBe(false);
    expect(canAffordHeadhunter(1000)).toBe(true);
  });
});

describe('pickHeadhunterPlacement', () => {
  const careers = [
    { id: 'intern', title: 'Intern', salary: 20000, type: 'full_time', minAge: 16, statRequirements: {} },
    { id: 'exec', title: 'Executive', salary: 200000, type: 'full_time', minAge: 25, requiresDegree: 'bachelor', requiresNetworking: 40, statRequirements: { smarts: 70 } },
    { id: 'part', title: 'Gig', salary: 50000, type: 'part_time', minAge: 16, statRequirements: {} },
  ];

  it('picks highest-salary eligible full-time job', () => {
    const pick = pickHeadhunterPlacement(careers, {
      age: 30,
      education: { bachelor: true },
      stats: { smarts: 80 },
      networking: 50,
    });
    expect(pick?.id).toBe('exec');
  });

  it('falls back when elite roles are ineligible', () => {
    const pick = pickHeadhunterPlacement(careers, {
      age: 20,
      education: {},
      stats: { smarts: 40 },
      networking: 0,
    });
    expect(pick?.id).toBe('intern');
  });

  it('returns null when nothing qualifies', () => {
    const pick = pickHeadhunterPlacement(careers, {
      age: 10,
      education: {},
      stats: {},
      networking: 0,
    });
    expect(pick).toBeNull();
  });

  it('treats a higher degree as satisfying a lower minimum', () => {
    const associateRole = [{ id: 'designer', title: 'Designer', salary: 60000, type: 'full_time', minAge: 20, requiresDegree: 'associate', statRequirements: {} }];
    const pick = pickHeadhunterPlacement(associateRole, {
      age: 25,
      education: { bachelor: true, associate: false },
      stats: {},
      networking: 0,
    });
    expect(pick?.id).toBe('designer');
  });
});

describe('hasRequiredDegree', () => {
  it('accepts exact and higher completed degrees', () => {
    expect(hasRequiredDegree({ associate: true }, 'associate')).toBe(true);
    expect(hasRequiredDegree({ bachelor: true, associate: false }, 'associate')).toBe(true);
    expect(hasRequiredDegree({ phd: true, bachelor: false }, 'bachelor')).toBe(true);
  });

  it('rejects lower or missing degrees', () => {
    expect(hasRequiredDegree({ highSchool: true }, 'associate')).toBe(false);
    expect(hasRequiredDegree({}, 'bachelor')).toBe(false);
  });
});

describe('military enlist career id', () => {
  it('targets soldier career track', async () => {
    expect(MILITARY_ENLIST_CAREER_ID).toBe('soldier');
    const { default: careers } = await import('../../engine/careers.json');
    const soldier = careers.find((c) => c.id === MILITARY_ENLIST_CAREER_ID);
    expect(soldier?.title).toBe('Army Soldier');
    expect(soldier?.statRequirements?.health).toBe(60);
    expect(soldier?.statRequirements?.athleticism).toBe(50);
  });
});
