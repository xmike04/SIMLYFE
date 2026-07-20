/**
 * Engine playtest harness — drives useGameState via renderHook to age 40.
 * Used by playtest-lives.test.js (not a unit test suite; exploratory playthroughs).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useGameState } from '../../engine/gameState';
import { ACTIVITY_MENUS } from '../../config/activities';

export const MOCK_EVENT = {
  description: 'A year of possibilities opens up.',
  choices: [
    { text: 'Play it safe', effects: { happiness: 1 } },
    { text: 'Take a risk', effects: { happiness: -2, smarts: 1, karma: -1 } },
    { text: 'Hustle', effects: { bank: 200, happiness: -1 } },
  ],
};

export function snapshot(g) {
  return {
    age: g.age,
    bank: g.bank,
    isDead: g.isDead,
    isAging: g.isAging,
    career: g.career ? { id: g.career.id, title: g.career.title, salary: g.career.salary, equity: g.career.equity } : null,
    stats: { ...g.stats },
    education: { ...g.education },
    networking: g.networking,
    relationships: (g.relationships ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
      relation: r.relation,
      isAlive: r.isAlive,
      age: r.age,
    })),
    pets: (g.pets ?? []).map((p) => ({ id: p.id, name: p.name, species: p.species })),
    belongingsCount: (g.belongings ?? []).length,
    propertiesCount: (g.properties ?? []).length,
    historyTail: (g.history ?? []).slice(-8).map((h) => h.text),
    currentEvent: g.currentEvent
      ? { description: g.currentEvent.description, choiceCount: g.currentEvent.choices?.length }
      : null,
    economy: g.economyCycle,
  };
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function inspectForBugs(g, findings, tag) {
  const push = (severity, title, detail) => {
    findings.push({ severity, title, detail, age: g.age, tag });
  };

  if (g.isAging) push('high', 'Stuck isAging=true', 'UI would stay frozen after ageUp');
  if (!g.isDead && g.currentEvent?.description?.includes('LLM ERROR')) {
    push('high', 'LLM ERROR event surfaced', g.currentEvent.description);
  }

  const s = g.stats ?? {};
  for (const [k, v] of Object.entries(s)) {
    if (!isFiniteNumber(v)) push('critical', `NaN/non-finite stat: ${k}`, String(v));
    if (v < 0 || v > 100) push('high', `Stat out of 0–100: ${k}=${v}`, 'clamp expected');
  }
  if (!isFiniteNumber(g.bank)) push('critical', 'Non-finite bank', String(g.bank));
  if (g.networking != null && (g.networking < 0 || g.networking > 100)) {
    push('medium', `Networking out of range: ${g.networking}`, '');
  }

  const living = (g.relationships ?? []).filter((r) => r.isAlive !== false);
  const married = living.filter((r) => r.status === 'married');
  const dating = living.filter((r) => r.status === 'dating');
  const spouseTyped = living.filter((r) => r.type === 'Spouse' && r.status !== 'married');
  if (spouseTyped.length) {
    push('medium', 'type=Spouse without married status', spouseTyped.map((r) => `${r.name}:${r.status}`).join(', '));
  }
  for (const r of living) {
    if (r.relation != null && !isFiniteNumber(r.relation)) {
      push('high', `Bad relation score on ${r.name}`, String(r.relation));
    }
    if (r.status === 'married' && r.type !== 'Spouse' && r.type !== 'Ex') {
      push('low', 'married status with unexpected type', `${r.name} type=${r.type}`);
    }
  }
  if (married.length > 1) {
    push('medium', 'Multiple simultaneous marriages', married.map((r) => r.name).join(', '));
  }

  // Education invariants
  const edu = g.education ?? {};
  if (edu.currentDegree?.yearsInProgram != null) {
    if (edu.currentDegree.yearsInProgram < 1) push('high', 'yearsInProgram < 1 while enrolled', String(edu.currentDegree.yearsInProgram));
  }

  // Career + unemployment weirdness
  if (g.career?.salary != null && !isFiniteNumber(g.career.salary)) {
    push('critical', 'Non-finite career salary', String(g.career.salary));
  }
  if (g.career?.id === 'founder' && (g.career.equity == null || g.career.equity < 0)) {
    push('medium', 'Founder equity missing/negative', String(g.career.equity));
  }

  return { marriedCount: married.length, datingCount: dating.length };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

export async function resolveEvent(result, choiceIndex = 0) {
  await flush();
  const g = result.current;
  if (!g.currentEvent) return;
  const choice = g.currentEvent.choices?.[choiceIndex] ?? g.currentEvent.choices?.[0];
  if (!choice) return;
  await act(async () => {
    g.handleChoice(choice);
  });
  await flush();
}

export async function ageOneYear(result, choiceIndex = 0) {
  const before = result.current.age;
  await act(async () => {
    await result.current.ageUp();
  });
  await flush();
  await waitFor(() => {
    expect(result.current.isAging).toBe(false);
  }, { timeout: 5000 });
  if (result.current.currentEvent) {
    await resolveEvent(result, choiceIndex);
  }
  return result.current.age > before || result.current.isDead;
}

export async function tryAction(result, label, fn, options = {}) {
  const before = snapshot(result.current);
  let thrown = null;
  let returned;
  try {
    await act(async () => {
      returned = await fn(result.current);
    });
    await flush();
    // Activity/special paths may open an event
    if (options.resolveEvent !== false && result.current.currentEvent && !result.current.isAging) {
      await resolveEvent(result, 0);
    }
  } catch (e) {
    thrown = e;
  }
  return { before, after: snapshot(result.current), returned, thrown, label };
}

export function getActivity(categoryId, textIncludes) {
  const list = ACTIVITY_MENUS[categoryId] ?? [];
  return list.find((a) => a.text.toLowerCase().includes(textIncludes.toLowerCase()));
}

/**
 * @param {{ name: string, pathId: string, plan: (ctx) => Promise<void> }} opts
 */
export async function runPlaythrough({ name, pathId, plan, targetAge = 40 }) {
  const findings = [];
  const log = [];
  const { result } = renderHook(() => useGameState());

  await act(async () => {
    result.current.startLife(name, 'non-binary', 'USA', 'nyc');
  });
  await flush();
  log.push({ t: 'start', snap: snapshot(result.current) });

  const ctx = {
    result,
    log,
    findings,
    targetAge,
    async note(severity, title, detail) {
      findings.push({ severity, title, detail, age: result.current.age, tag: pathId });
    },
    async ageTo(age, choiceIndex = 0) {
      while (result.current.age < age && !result.current.isDead) {
        const ok = await ageOneYear(result, choiceIndex);
        inspectForBugs(result.current, findings, pathId);
        if (!ok && !result.current.isDead) {
          findings.push({
            severity: 'critical',
            title: 'ageUp failed to advance',
            detail: `stuck at ${result.current.age}, event=${result.current.currentEvent?.description}`,
            age: result.current.age,
            tag: pathId,
          });
          break;
        }
      }
    },
    async ageYears(n, choiceIndex = 0) {
      await ctx.ageTo(result.current.age + n, choiceIndex);
    },
    snapshot: () => snapshot(result.current),
    tryAction: (label, fn, options) => tryAction(result, label, fn, options),
    getActivity,
  };

  try {
    await plan(ctx);
    // Finish remaining years to target if plan stopped early
    if (!result.current.isDead && result.current.age < targetAge) {
      await ctx.ageTo(targetAge);
    }
  } catch (e) {
    findings.push({
      severity: 'critical',
      title: 'Playthrough threw',
      detail: e?.stack || String(e),
      age: result.current.age,
      tag: pathId,
    });
  }

  if (result.current.isDead && result.current.age < targetAge) {
    findings.push({
      severity: 'high',
      title: 'Premature death before target age',
      detail: `Died at ${result.current.age}; target was ${targetAge}`,
      age: result.current.age,
      tag: pathId,
    });
  }

  inspectForBugs(result.current, findings, pathId);
  const final = snapshot(result.current);

  // History red flags
  for (const h of result.current.history ?? []) {
    if (/undefined|NaN|\[object Object\]/i.test(h.text)) {
      findings.push({
        severity: 'high',
        title: 'Bad history string',
        detail: h.text,
        age: h.age,
        tag: pathId,
      });
    }
  }

  return {
    pathId,
    name,
    finalAge: final.age,
    died: final.isDead,
    final,
    findings,
    historySample: (result.current.history ?? []).filter((_, i, arr) => i < 5 || i >= arr.length - 15),
  };
}
