import { useTranslation } from 'react-i18next'
import type { AnyCard, DeedCard, AnyUnit } from '@/engine/types'

type OfferItem = DeedCard | AnyUnit

const CARD_TYPE_TO_NS: Record<string, string> = {
  basic_action: 'basicActions',
  advanced_action: 'advancedActions',
  spell: 'spells',
  artifact: 'artifacts',
}

const UNIT_TIER_TO_NS: Record<string, string> = {
  regular: 'unitsRegular',
  elite: 'unitsElite',
}

function isUnit(item: unknown): item is AnyUnit {
  return typeof item === 'object' && item !== null && 'tier' in item && 'armor' in item
}

export function useCardTranslation() {
  const { t: tBA } = useTranslation('basicActions')
  const { t: tAA } = useTranslation('advancedActions')
  const { t: tSpells } = useTranslation('spells')
  const { t: tArtifacts } = useTranslation('artifacts')
  const { t: tUnitsReg } = useTranslation('unitsRegular')
  const { t: tUnitsElite } = useTranslation('unitsElite')
  const { t: tTactics } = useTranslation('tactics')
  const { t: tEnemies } = useTranslation('enemies')

  const tFns: Record<string, typeof tAA> = {
    basicActions: tBA,
    advancedActions: tAA,
    spells: tSpells,
    artifacts: tArtifacts,
    unitsRegular: tUnitsReg,
    unitsElite: tUnitsElite,
    tactics: tTactics,
    enemies: tEnemies,
  }

  // basic_action uses card.name as key (IDs overlap between common/hero-specific)
  // other types use card.id as key
  function cardKey(card: AnyCard): string {
    return card.type === 'basic_action' ? card.name : String(card.id)
  }

  function getCardName(card: AnyCard): string {
    if (card.type === 'wound') return 'Wound'

    const ns = CARD_TYPE_TO_NS[card.type]
    if (!ns) return card.name

    const tFn = tFns[ns]
    if (!tFn) return card.name

    return tFn(`${cardKey(card)}.name`, { defaultValue: card.name })
  }

  function getCardBasicEffect(card: DeedCard): string {
    const ns = CARD_TYPE_TO_NS[card.type]
    const fallback = card.type === 'spell' ? card.basicSpell.text : card.basicEffect.text

    if (!ns) return fallback

    const tFn = tFns[ns]
    if (!tFn) return fallback

    const key = card.type === 'spell'
      ? `${cardKey(card)}.basicSpellText`
      : `${cardKey(card)}.basicEffect`
    return tFn(key, { defaultValue: fallback })
  }

  function getCardStrongEffect(card: DeedCard): string {
    const ns = CARD_TYPE_TO_NS[card.type]
    const fallback = card.type === 'spell' ? card.strongSpell.text : card.strongEffect.text

    if (!ns) return fallback

    const tFn = tFns[ns]
    if (!tFn) return fallback

    const key = card.type === 'spell'
      ? `${cardKey(card)}.strongSpellText`
      : `${cardKey(card)}.strongEffect`
    return tFn(key, { defaultValue: fallback })
  }

  function getUnitName(unit: AnyUnit): string {
    const ns = UNIT_TIER_TO_NS[unit.tier]
    if (!ns) return unit.name

    const tFn = tFns[ns]
    if (!tFn) return unit.name

    return tFn(`${unit.id}.name`, { defaultValue: unit.name })
  }

  function getUnitAbilityNames(unit: AnyUnit): string {
    if (unit.abilities.length === 0) return 'No abilities'

    const ns = UNIT_TIER_TO_NS[unit.tier]
    if (!ns) return unit.abilities.map((a) => a.name).join(', ')

    const tFn = tFns[ns]
    if (!tFn) return unit.abilities.map((a) => a.name).join(', ')

    return unit.abilities
      .map((a, idx) => tFn(`${unit.id}.abilities.${idx}.name`, { defaultValue: a.name }))
      .join(', ')
  }

  function getOfferItemName(item: OfferItem): string {
    if (isUnit(item)) return getUnitName(item)
    return getCardName(item)
  }

  function getOfferItemEffect(item: OfferItem): string {
    if (isUnit(item)) return getUnitAbilityNames(item)
    return getCardBasicEffect(item)
  }

  return {
    getCardName,
    getCardBasicEffect,
    getCardStrongEffect,
    getUnitName,
    getUnitAbilityNames,
    getOfferItemName,
    getOfferItemEffect,
  }
}
