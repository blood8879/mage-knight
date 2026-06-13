// ═══════════════════════════════════════════
// Mage Knight Engine — Card Play Validator
// ═══════════════════════════════════════════

import type { DeedCard, AnyCard, ManaColor, DayNight, CombatPhase } from './types'

// ── Types ─────────────────────────────────

export interface CardPlayValidation {
  canPlayBasic: boolean
  canPlayStrong: boolean
  requiredMana: ManaColor | null
  requiresBlackMana: boolean // for Action strong at night
  reason?: string
  /** Stable key for i18n (validation.<key>) with optional params */
  reasonKey?: string
  reasonParams?: Record<string, string>
}

export interface ManaAvailability {
  hasColor: (c: ManaColor) => boolean
  hasBlack: boolean
  hasGold: boolean
}

export interface SidewaysPlayValidation {
  valid: boolean
  element: 'physical'
  reason?: string
}

// ── Helpers ───────────────────────────────

/**
 * Resolve the primary (first) color of a card.
 * Cards with multi-color arrays use the first entry as the primary.
 */
function primaryColor(card: DeedCard): ManaColor | null {
  if (!card.color) return null
  if (Array.isArray(card.color)) return card.color[0] ?? null
  return card.color as ManaColor
}

/**
 * Check if a mana availability satisfies a color requirement.
 * Gold acts as a wildcard for any basic color.
 */
function canSatisfyColor(
  color: ManaColor,
  mana: ManaAvailability
): boolean {
  return mana.hasColor(color) || mana.hasGold
}

// ── Main Validator ─────────────────────────

/**
 * Validate whether a deed card can be played basic/strong given the
 * current day/night cycle and available mana.
 *
 * Rules:
 *  Action Basic   → always playable (no mana needed)
 *  Action Strong Day   → needs matching color (or gold)
 *  Action Strong Night → needs matching color (or gold) + black mana
 *  Spell Basic    → needs matching color (or gold)
 *  Spell Strong Day    → IMPOSSIBLE (would need black during day)
 *  Spell Strong Night  → needs matching color (or gold) only
 *  Artifact Basic → always playable
 *  Artifact Strong → always playable (card is expended/thrown away)
 *  Wound          → NEVER playable (handled by callers via AnyCard type guard)
 */
export function validateCardPlay(
  card: DeedCard,
  dayNight: DayNight,
  availableMana: ManaAvailability
): CardPlayValidation {
  const color = primaryColor(card)

  // ── Artifact ──────────────────────────────
  if (card.type === 'artifact') {
    return {
      canPlayBasic: true,
      canPlayStrong: true,
      requiredMana: null,
      requiresBlackMana: false,
    }
  }

  // ── Spell ─────────────────────────────────
  if (card.type === 'spell') {
    // Basic: always needs matching color mana
    const basicColorMet = color !== null && canSatisfyColor(color, availableMana)
    const canPlayBasic = basicColorMet
    const basicReason = canPlayBasic
      ? undefined
      : color === null
        ? 'Spell has no color defined'
        : `Spell basic requires ${color} (or gold) mana`
    const basicReasonKey = canPlayBasic ? undefined : color === null ? 'spellNoColor' : 'spellBasicNeedsColor'

    // Strong Day: IMPOSSIBLE — spells strong are powered by black mana which
    // doesn't exist during day phase.
    // Strong Night: needs matching color only (black mana is not additionally required)
    let canPlayStrong: boolean
    let strongReason: string | undefined
    let strongReasonKey: string | undefined
    if (dayNight === 'day') {
      canPlayStrong = false
      strongReason = 'Spell strong cannot be played during day (requires black mana which is unavailable)'
      strongReasonKey = 'spellStrongDay'
    } else {
      // Night: just needs matching color
      canPlayStrong = color !== null && canSatisfyColor(color, availableMana)
      strongReason = canPlayStrong
        ? undefined
        : color === null
          ? 'Spell has no color defined'
          : `Spell strong requires ${color} (or gold) mana at night`
      strongReasonKey = canPlayStrong ? undefined : color === null ? 'spellNoColor' : 'spellStrongNeedsColor'
    }

    return {
      canPlayBasic,
      canPlayStrong,
      requiredMana: color,
      requiresBlackMana: false,
      reason: canPlayBasic ? strongReason : basicReason,
      reasonKey: canPlayBasic ? strongReasonKey : basicReasonKey,
      reasonParams: color ? { color } : undefined,
    }
  }

  // ── Action (basic_action / advanced_action) ─
  if (card.type === 'basic_action' || card.type === 'advanced_action') {
    // Basic: always playable, no mana needed
    const canPlayBasic = true

    // Strong requires mana
    let canPlayStrong: boolean
    let requiresBlackMana = false
    let strongReason: string | undefined
    let strongReasonKey: string | undefined

    if (color === null) {
      // Colorless action strong — treat as always playable (no cost defined)
      canPlayStrong = true
    } else if (dayNight === 'day') {
      // Day: needs matching color (or gold)
      canPlayStrong = canSatisfyColor(color, availableMana)
      strongReason = canPlayStrong
        ? undefined
        : `Action strong requires ${color} (or gold) mana during day`
      strongReasonKey = canPlayStrong ? undefined : 'actionStrongDayNeedsColor'
    } else {
      // Night: needs matching color (or gold) AND black mana
      const colorMet = canSatisfyColor(color, availableMana)
      const blackMet = availableMana.hasBlack
      requiresBlackMana = true
      canPlayStrong = colorMet && blackMet
      if (!canPlayStrong) {
        if (!colorMet && !blackMet) {
          strongReason = `Action strong at night requires ${color} (or gold) mana AND black mana`
          strongReasonKey = 'actionStrongNightNeedsBoth'
        } else if (!colorMet) {
          strongReason = `Action strong at night requires ${color} (or gold) mana`
          strongReasonKey = 'actionStrongNightNeedsColor'
        } else {
          strongReason = 'Action strong at night requires black mana'
          strongReasonKey = 'actionStrongNightNeedsBlack'
        }
      }
    }

    return {
      canPlayBasic,
      canPlayStrong,
      requiredMana: color,
      requiresBlackMana,
      reason: strongReason,
      reasonKey: strongReasonKey,
      reasonParams: color ? { color } : undefined,
    }
  }

  // Fallback (should never be reached for valid DeedCard)
  return {
    canPlayBasic: false,
    canPlayStrong: false,
    requiredMana: null,
    requiresBlackMana: false,
    reason: 'Unknown card type',
  }
}

// ── Sideways Play Validator ────────────────

/**
 * Validate whether a card may be played sideways for a given effect.
 *
 * Playing sideways produces 1 physical point of the chosen effect.
 * It is always physical — no elemental (fire/ice/cold_fire) variants apply.
 *
 * Rules:
 *  - Wound cards: CANNOT be played sideways
 *  - Ranged/Siege attack (phase 1 = ranged_siege): CANNOT use sideways cards
 *    (sideways attack is only valid in melee Phase 4 = 'attack')
 *  - Fire/Ice/ColdFire element on attack/block: impossible via sideways (always physical)
 *  - Sideways attack is only valid during 'attack' phase (melee)
 */
export function validateSidewaysPlay(
  card: AnyCard,
  targetEffect: 'move' | 'influence' | 'attack' | 'block',
  combatPhase?: CombatPhase
): SidewaysPlayValidation {
  // Wound cards cannot be played sideways
  if (card.type === 'wound') {
    return {
      valid: false,
      element: 'physical',
      reason: 'Wound cards cannot be played sideways',
    }
  }

  // Attack sideways is only valid during melee phase ('attack'), not ranged/siege
  if (targetEffect === 'attack') {
    if (combatPhase === 'ranged_siege') {
      return {
        valid: false,
        element: 'physical',
        reason: 'Sideways attack cannot be used during ranged/siege phase — only melee (attack phase)',
      }
    }
    // If a combat phase is provided and it's not 'attack', block it
    if (combatPhase !== undefined && combatPhase !== 'attack') {
      return {
        valid: false,
        element: 'physical',
        reason: `Sideways attack is only valid during melee attack phase, not '${combatPhase}'`,
      }
    }
  }

  // Block sideways is only valid during block phase
  if (targetEffect === 'block') {
    if (combatPhase !== undefined && combatPhase !== 'block') {
      return {
        valid: false,
        element: 'physical',
        reason: `Sideways block is only valid during block phase, not '${combatPhase}'`,
      }
    }
  }

  // All other cases are valid — sideways always produces physical
  return {
    valid: true,
    element: 'physical',
  }
}
