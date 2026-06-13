import type { AnyCard, ArtifactCard, UnitInstance } from '@/engine/types'

/**
 * Banner artifact helpers (EC-02-C-3, EC-08-B-1).
 * Banners attach to a unit; the data encodes their passive bonuses on the
 * basic effect's `assign_to_unit` action.
 */

export function isBannerCard(card: AnyCard): card is ArtifactCard {
  return card.type === 'artifact' && (card as ArtifactCard).subtype === 'banner'
}

export interface BannerBonuses {
  armor: number
  attack: number
  block: number
}

export function getBannerBonuses(unit: UnitInstance): BannerBonuses {
  const action = unit.bannerCard?.basicEffect.actions.find((a) => a.type === 'assign_to_unit')
  return {
    armor: typeof action?.bonus_armor === 'number' ? action.bonus_armor : 0,
    attack: typeof action?.bonus_attack === 'number' ? action.bonus_attack : 0,
    block: typeof action?.bonus_block === 'number' ? action.bonus_block : 0,
  }
}

/** Unit armor including any banner bonus */
export function getEffectiveUnitArmor(unit: UnitInstance): number {
  return unit.unit.armor + getBannerBonuses(unit).armor
}

/** Bonus this unit's banner adds to a combat contribution of the given type */
export function getBannerCombatBonus(unit: UnitInstance, actionType: string): number {
  const bonuses = getBannerBonuses(unit)
  if (actionType === 'block') return bonuses.block
  if (actionType.includes('attack')) return bonuses.attack
  return 0
}
