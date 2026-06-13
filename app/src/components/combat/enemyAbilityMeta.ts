import type { EnemyAbility } from '@/engine/types'

/**
 * Display metadata for enemy abilities, shared by the combat EnemyCard and the
 * map TileInfoPopup. Each entry maps an ability key to its i18n label key, a
 * color class, and a description key (combat.<ability>Desc) for tooltips.
 */
export interface AbilityMeta {
  labelKey: string
  descKey: string
  color: string
}

export const ENEMY_ABILITY_META: Record<string, AbilityMeta> = {
  fortified: { labelKey: 'combat.abilityFortified', descKey: 'combat.abilityFortifiedDesc', color: 'text-amber-400' },
  physical_resistance: { labelKey: 'combat.abilityPhysicalResistance', descKey: 'combat.abilityPhysicalResistanceDesc', color: 'text-stone-400' },
  fire_resistance: { labelKey: 'combat.abilityFireResistance', descKey: 'combat.abilityFireResistanceDesc', color: 'text-orange-400' },
  ice_resistance: { labelKey: 'combat.abilityIceResistance', descKey: 'combat.abilityIceResistanceDesc', color: 'text-cyan-400' },
  swift: { labelKey: 'combat.abilitySwift', descKey: 'combat.abilitySwiftDesc', color: 'text-sky-400' },
  brutal: { labelKey: 'combat.abilityBrutal', descKey: 'combat.abilityBrutalDesc', color: 'text-red-400' },
  poison: { labelKey: 'combat.abilityPoison', descKey: 'combat.abilityPoisonDesc', color: 'text-lime-400' },
  paralyze: { labelKey: 'combat.abilityParalyze', descKey: 'combat.abilityParalyzeDesc', color: 'text-yellow-400' },
  arcane_immunity: { labelKey: 'combat.abilityArcaneImmunity', descKey: 'combat.abilityArcaneImmunityDesc', color: 'text-indigo-400' },
  cumbersome: { labelKey: 'combat.abilityCumbersome', descKey: 'combat.abilityCumbersomeDesc', color: 'text-zinc-400' },
  unfortified: { labelKey: 'combat.abilityUnfortified', descKey: 'combat.abilityUnfortifiedDesc', color: 'text-zinc-500' },
  vampiric: { labelKey: 'combat.abilityVampiric', descKey: 'combat.abilityVampiricDesc', color: 'text-fuchsia-400' },
  assassination: { labelKey: 'combat.abilityAssassination', descKey: 'combat.abilityAssassinationDesc', color: 'text-rose-400' },
  defend_1: { labelKey: 'combat.abilityDefend1', descKey: 'combat.abilityDefend1Desc', color: 'text-teal-400' },
  defend_2: { labelKey: 'combat.abilityDefend2', descKey: 'combat.abilityDefend2Desc', color: 'text-teal-300' },
  reputation_minus_1: { labelKey: 'combat.abilityRepMinus1', descKey: 'combat.abilityRepMinus1Desc', color: 'text-orange-300' },
}

export function getAbilityMeta(ability: EnemyAbility): AbilityMeta {
  return (
    ENEMY_ABILITY_META[ability] ?? {
      labelKey: ability,
      descKey: '',
      color: 'text-slate-400',
    }
  )
}
