// ═══════════════════════════════════════════
// Mage Knight Engine — Card Effect Resolver
// ═══════════════════════════════════════════

import type { CardEffect, CardAction, TurnState, DayNight, Element, ManaColor } from './types'

const BASIC_MANA_COLORS: ReadonlySet<string> = new Set(['red', 'blue', 'green', 'white'])

/**
 * Action types that need an explicit player pick when marked `choice: true`
 * (outside combat there is no phase context to disambiguate them).
 * Attack/block/influence choices resolve implicitly: combat consumes cards
 * through the tray's own per-action picker, influence only feeds an active
 * interaction.
 */
export const CHOICE_PICKER_TYPES: ReadonlySet<string> = new Set([
  'heal',
  'draw_card',
  'gain_mana',
  'gain_crystal',
])

export interface EffectResolution {
  movePointsDelta: number
  attackValue: number
  attackElement: Element
  blockValue: number
  blockElement: Element
  influenceValue: number
  healingValue: number
  /** Fixed-color crystal gains (e.g. Crushing Bolt). */
  crystalsGained: ManaColor[]
  /** Crystal gains needing a color pick (any_basic) — raw actions. */
  openCrystalActions: CardAction[]
  /** Fixed-color mana token gains. */
  manaTokensGained: string[]
  /** Mana token gains needing a color pick (multi-color specs) — raw actions. */
  openManaActions: CardAction[]
  cardsToDraw: number
  reputationDelta: number
  fameDelta: number
  /** Influence per Wound in hand (In Need) — multiplied by wound count at play time */
  influencePerWound: number
  /** Acquire a card from the AA / Spell offer ('discard' or 'hand' destination) */
  gainAdvancedAction: 'discard' | 'hand' | null
  gainSpell: 'discard' | 'hand' | null
  woundsTaken: number
  /** Highest maxLevel among ready_unit actions (null = none). */
  readyUnitMaxLevel: number | null
  /** Terrain cost modifier actions, applied turn-scoped by the caller. */
  terrainModifiers: CardAction[]
  unresolved: CardAction[]
}

function emptyResolution(): EffectResolution {
  return {
    movePointsDelta: 0,
    attackValue: 0,
    attackElement: 'physical',
    blockValue: 0,
    blockElement: 'physical',
    influenceValue: 0,
    healingValue: 0,
    crystalsGained: [],
    openCrystalActions: [],
    manaTokensGained: [],
    openManaActions: [],
    cardsToDraw: 0,
    reputationDelta: 0,
    fameDelta: 0,
    influencePerWound: 0,
    gainAdvancedAction: null,
    gainSpell: null,
    woundsTaken: 0,
    readyUnitMaxLevel: null,
    terrainModifiers: [],
    unresolved: [],
  }
}

/**
 * Reduce an effect to the actions that should actually resolve, honoring a
 * player's pick among `choice: true` actions of picker types (heal vs draw,
 * mana vs crystal, …). Non-picker actions always stay. With no pick given,
 * picker-type choice actions are dropped (never double-applied).
 */
/** Parse a color spec like 'red', 'red_or_black', 'blue_white_or_red', 'any_basic'. */
export function parseColorSpec(spec: string): string[] {
  if (spec === 'any_basic') return ['red', 'blue', 'green', 'white']
  if (spec === 'any_including_special') return ['red', 'blue', 'green', 'white', 'gold', 'black']
  return spec.replaceAll('_or_', '_').split('_').filter(Boolean)
}

export function selectEffectActions(effect: CardEffect, chosenActionIndex?: number): CardEffect {
  const hasPickerChoice = effect.actions.some(
    (a) => a.choice && CHOICE_PICKER_TYPES.has(a.type),
  )
  if (!hasPickerChoice) return effect
  return {
    ...effect,
    actions: effect.actions.filter(
      (a, i) => !(a.choice && CHOICE_PICKER_TYPES.has(a.type)) || i === chosenActionIndex,
    ),
  }
}

export class CardEffectResolver {
  /**
   * Resolve a card effect into concrete numeric values.
   * EC-02-F: Same-type effects from multiple cards can be accumulated.
   */
  resolveEffect(effect: CardEffect, _dayNight: DayNight): EffectResolution {
    const result = emptyResolution()

    for (const action of effect.actions) {
      const value = typeof action.value === 'number' ? action.value : 0

      switch (action.type) {
        case 'move':
          result.movePointsDelta += value
          break
        case 'attack':
          result.attackValue += value
          if (action.element) result.attackElement = action.element as Element
          break
        case 'ranged_attack':
          result.attackValue += value
          if (action.element) result.attackElement = action.element as Element
          break
        case 'siege_attack':
          result.attackValue += value
          if (action.element) result.attackElement = action.element as Element
          break
        case 'fire_attack':
          result.attackValue += value
          result.attackElement = 'fire'
          break
        case 'ice_attack':
          result.attackValue += value
          result.attackElement = 'ice'
          break
        case 'cold_fire_attack':
          result.attackValue += value
          result.attackElement = 'cold_fire'
          break
        case 'block':
          result.blockValue += value
          if (action.element) result.blockElement = action.element as Element
          break
        case 'fire_block':
          result.blockValue += value
          result.blockElement = 'fire'
          break
        case 'ice_block':
          result.blockValue += value
          result.blockElement = 'ice'
          break
        case 'cold_fire_block':
          result.blockValue += value
          result.blockElement = 'cold_fire'
          break
        case 'influence':
          result.influenceValue += value
          break
        case 'healing':
        case 'heal':
          result.healingValue += value
          break
        case 'draw_card':
          result.cardsToDraw += value
          break
        case 'reputation':
          result.reputationDelta += value
          break
        case 'fame':
          result.fameDelta += value
          break
        case 'influence_per_wound':
          result.influencePerWound += value
          break
        case 'gain_advanced_action':
          result.gainAdvancedAction = action.to === 'hand' ? 'hand' : 'discard'
          break
        case 'gain_spell':
          result.gainSpell = action.to === 'hand' ? 'hand' : 'discard'
          break
        case 'take_wound':
          result.woundsTaken += typeof action.value === 'number' ? action.value : 1
          break
        case 'ready_unit': {
          const maxLevel = typeof action.maxLevel === 'number' ? action.maxLevel : 99
          result.readyUnitMaxLevel = Math.max(result.readyUnitMaxLevel ?? 0, maxLevel)
          break
        }
        case 'terrain_modifier':
          result.terrainModifiers.push(action)
          break
        case 'gain_crystal':
          // Unambiguous gains resolve here; 'any_basic' needs a color pick.
          if (typeof action.color === 'string' && BASIC_MANA_COLORS.has(action.color)) {
            result.crystalsGained.push(action.color as ManaColor)
          } else {
            result.openCrystalActions.push(action)
          }
          break
        case 'gain_mana':
        case 'gain_mana_token': {
          const spec = typeof action.color === 'string' ? action.color : ''
          const count = typeof action.count === 'number' ? action.count : 1
          if (BASIC_MANA_COLORS.has(spec) || spec === 'gold' || spec === 'black') {
            for (let i = 0; i < count; i++) result.manaTokensGained.push(spec)
          } else {
            result.openManaActions.push(action)
          }
          break
        }
        default:
          result.unresolved.push(action)
          break
      }
    }

    return result
  }

  /**
   * EC-02-F: Accumulate multiple resolutions of the SAME type.
   * Different types cannot be mixed (Move + Attack don't combine).
   * Within one attack declaration, multiple cards' Attack values DO accumulate.
   */
  accumulateResolutions(resolutions: EffectResolution[]): EffectResolution {
    const result = emptyResolution()

    for (const r of resolutions) {
      result.movePointsDelta += r.movePointsDelta
      result.attackValue += r.attackValue
      result.blockValue += r.blockValue
      result.influenceValue += r.influenceValue
      result.healingValue += r.healingValue
      result.crystalsGained.push(...r.crystalsGained)
      result.openCrystalActions.push(...r.openCrystalActions)
      result.manaTokensGained.push(...r.manaTokensGained)
      result.openManaActions.push(...r.openManaActions)
      result.cardsToDraw += r.cardsToDraw
      result.reputationDelta += r.reputationDelta
      result.fameDelta += r.fameDelta
      result.influencePerWound += r.influencePerWound
      result.gainAdvancedAction = result.gainAdvancedAction ?? r.gainAdvancedAction
      result.gainSpell = result.gainSpell ?? r.gainSpell
      result.woundsTaken += r.woundsTaken
      if (r.readyUnitMaxLevel !== null) {
        result.readyUnitMaxLevel = Math.max(result.readyUnitMaxLevel ?? 0, r.readyUnitMaxLevel)
      }
      result.terrainModifiers.push(...r.terrainModifiers)

      // Element: last non-physical element wins (for mixed element accumulation)
      if (r.attackElement !== 'physical') result.attackElement = r.attackElement
      if (r.blockElement !== 'physical') result.blockElement = r.blockElement

      result.unresolved.push(...r.unresolved)
    }

    return result
  }

  /**
   * Create a sideways resolution: Move 1, Influence 1, Attack 1, or Block 1.
   * EC-02-E: Always physical. No ranged/siege/elemental.
   */
  resolveSideways(choice: 'move' | 'influence' | 'attack' | 'block'): EffectResolution {
    const result = emptyResolution()
    switch (choice) {
      case 'move':
        result.movePointsDelta = 1
        break
      case 'influence':
        result.influenceValue = 1
        break
      case 'attack':
        result.attackValue = 1
        result.attackElement = 'physical'
        break
      case 'block':
        result.blockValue = 1
        result.blockElement = 'physical'
        break
    }
    return result
  }

  /**
   * Apply a resolution to the current turn state (immutable).
   * Move points and healing accumulate on the turn; attack/block/influence
   * are consumed by their own subsystems (combat declarations, interaction pool).
   */
  applyToTurnState(turn: TurnState, resolution: EffectResolution): TurnState {
    if (resolution.movePointsDelta === 0 && resolution.healingValue === 0) return turn
    return {
      ...turn,
      movePointsAvailable: turn.movePointsAvailable + resolution.movePointsDelta,
      healingAvailable: (turn.healingAvailable ?? 0) + resolution.healingValue,
    }
  }
}