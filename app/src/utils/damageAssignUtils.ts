import type { UnitInstance, Element } from '@/engine/types'
import { getEffectiveUnitArmor } from '@/utils/bannerUtils'

/**
 * Rules-correct damage-assignment helpers (rulebook: Assign Damage Phase).
 *
 * A Unit can only be assigned damage while Unwounded. When assigned, it takes
 * exactly one Wound and absorbs damage equal to its Armor; a Unit resistant to
 * the attack element absorbs up to twice its Armor and is Wounded only if the
 * damage exceeds its Armor. Any excess damage must be assigned elsewhere (to
 * another Unwounded Unit or the Hero).
 */

/** A Unit can be assigned damage only while it is not Wounded. */
export function isUnitEligible(unit: UnitInstance): boolean {
  return unit.woundCount === 0 && unit.status !== 'wounded'
}

/** Does this Unit resist the given attack element? */
export function isUnitResistant(unit: UnitInstance, element: Element): boolean {
  const r = unit.unit.resistance
  if (!r) return false
  switch (element) {
    case 'physical':
      return r.includes('physical')
    case 'fire':
      return r.includes('fire')
    case 'ice':
      return r.includes('ice')
    // Cold Fire is only resisted by a Unit resistant to BOTH Fire and Ice
    case 'cold_fire':
      return r.includes('fire') && r.includes('ice')
    default:
      return false
  }
}

/**
 * Compute how a single Unit absorbs damage from an attack of the given element.
 * Returns the damage absorbed (capped at the Unit's capacity) and the number of
 * Wound cards inflicted (0 for a resistant Unit that fully soaks within its
 * Armor, 2 under Poison, otherwise 1).
 */
export function unitAbsorption(
  unit: UnitInstance,
  element: Element,
  remaining: number,
  poison: boolean,
): { absorbed: number; wounds: number } {
  const armor = Math.max(getEffectiveUnitArmor(unit), 1)
  const resistant = isUnitResistant(unit, element)
  const capacity = resistant ? armor * 2 : armor
  const absorbed = Math.min(Math.max(remaining, 0), capacity)

  let wounds: number
  if (resistant) {
    wounds = absorbed > armor ? 1 : 0
  } else {
    wounds = absorbed > 0 ? 1 : 0
  }
  if (wounds > 0 && poison) wounds = 2

  return { absorbed, wounds }
}
