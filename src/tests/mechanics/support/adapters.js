/** Signature adapters retained while legacy call sites migrate to domain exports. */
import { applyEffectsPure } from '../../../engine/mechanics/life';

export function applyEffects(stats, bank, effects) {
  return applyEffectsPure(stats, bank, [], effects);
}
