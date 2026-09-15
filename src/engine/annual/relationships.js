import { getWealthTier } from '../../config/wealthTiers';
import { markAsEx, NPC_JOB_LABELS, NPC_STARTER_JOBS } from '../mechanics/relationships';

/** Ordered passes: decay, breakup, elder death, jealousy, then NPC autonomy. */
export function advanceRelationshipsYear(relationships, stats, { bank = 0, activitiesThisYear = {}, randomFn = Math.random } = {}) {
  const nextStats = { ...stats };
  const getRelDecay = (rel) => {
    if (rel.status === 'family')   return 1;
    if (rel.status === 'dating')   return 3;
    if (rel.status === 'married')  return 2;
    if (rel.status === 'friend')   return 2;
    return 0;
  };

  // Age every living relationship and apply passive decay if not interacted with
  const wealthTier = getWealthTier(bank);
  let nextRelationships = relationships.map(rel => {
    if (!rel.isAlive) return rel;
    const nextRel = { ...rel, age: rel.age + 1 };
    const interacted = !!activitiesThisYear[`rel_interact__${rel.id}`];
    const baseDecay = getRelDecay(rel);
    if (!interacted && baseDecay > 0) {
      // Romantic partners decay faster as wealth increases (they expect more attention/spending)
      const mult = (rel.status === 'dating' || rel.status === 'married') ? wealthTier.relationDecayMult : 1.0;
      const totalDecay = Math.ceil(baseDecay * mult);
      return { ...nextRel, relation: Math.max(0, nextRel.relation - totalDecay) };
    }
    return nextRel;
  });

  // Auto-breakup: romantic relationships that hit rock bottom dissolve
  const relationshipEvents = [];
  nextRelationships = nextRelationships.map(rel => {
    if (!rel.isAlive) return rel;
    if ((rel.status === 'dating' || rel.status === 'married') && rel.relation < 20) {
      const wasMarried = rel.status === 'married';
      relationshipEvents.push(wasMarried
        ? `Relationships: Your marriage with ${rel.name} fell apart and ended in divorce.`
        : `Relationships: Things fell apart with ${rel.name}. You broke up.`
      );
      return markAsEx(rel);
    }
    return rel;
  });

  // Parent/elder death chance
  nextRelationships = nextRelationships.map(rel => {
    if (!rel.isAlive) return rel;
    if (rel.status === 'family' && rel.age >= 70) {
      const deathChance = Math.min(1, (rel.age - 70) / 60);
      if (randomFn() < deathChance) {
        relationshipEvents.push(`Life Event: Your ${rel.type}, ${rel.name}, passed away at age ${rel.age}.`);
        nextStats.happiness = Math.max(0, nextStats.happiness - 10);
        return { ...rel, isAlive: false };
      }
    }
    return rel;
  });

  // Jealousy: multiple simultaneous lovers drain happiness
  const activeLovers = nextRelationships.filter(r => r.isAlive && (r.status === 'dating' || r.status === 'married'));
  if (activeLovers.length > 1) {
    nextStats.happiness = Math.max(0, nextStats.happiness - 5);
    relationshipEvents.push(`Relationships: The jealousy of maintaining ${activeLovers.length} simultaneous partners is taking a toll.`);
  }

  // === NPC Autonomy Pass ===
  nextRelationships = nextRelationships.map(rel => {
    if (rel.isAlive === false) return rel;
    if (rel.status === 'ex') return rel;

    let updated = { ...rel };
    const npcAge = rel.age ?? 0;

    // Job events (aged 22-45, no job yet)
    if (!updated.npcJob && npcAge >= 22 && npcAge <= 45) {
      if (randomFn() < 0.05) {
        const job = NPC_JOB_LABELS[Math.floor(randomFn() * NPC_JOB_LABELS.length)];
        updated.npcJob = job;
        relationshipEvents.push(`📱 ${rel.name} landed a job as a ${job}.`);
      }
    }

    // Marriage events (aged 25-50, not yet married)
    if (!updated.npcSpouse && npcAge >= 25 && npcAge <= 50) {
      if (randomFn() < 0.04) {
        updated.npcSpouse = true;
        relationshipEvents.push(`💍 ${rel.name} got married. You heard about it on social media.`);
      }
    }

    // Illness events (aged 40+, probability scales with age)
    if (!updated.npcSick && npcAge >= 40) {
      const sickChance = 0.03 + Math.max(0, npcAge - 40) * 0.002;
      if (randomFn() < sickChance) {
        updated.npcSick = true;
        updated.relation = Math.max(0, (updated.relation ?? 50) - 5);
        relationshipEvents.push(`🏥 ${rel.name} was diagnosed with a health condition and has become more withdrawn.`);
      }
    }

    // Children growing up
    const isNpcChild = rel.relation === 'child' || rel.relation === 'son' || rel.relation === 'daughter'
      || rel.type === 'Child' || rel.type === 'Son' || rel.type === 'Daughter';
    if (isNpcChild && rel.custodyWith !== 'ex') {
      if (npcAge === 18) {
        updated.status = 'family_adult';
        relationshipEvents.push(`🎓 Your child ${rel.name} has turned 18 and left for college.`);
      } else if (npcAge === 22 && !updated.npcJob) {
        const job = NPC_STARTER_JOBS[Math.floor(randomFn() * NPC_STARTER_JOBS.length)];
        updated.npcJob = job;
        relationshipEvents.push(`🎉 Your child ${rel.name} got their first job as a ${job}.`);
      }
    }

    return updated;
  });


  return { relationships: nextRelationships, stats: nextStats, events: relationshipEvents };
}
