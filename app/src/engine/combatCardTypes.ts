import type { CardAction, Element } from './types'

/** A single card/unit/skill contribution to the current combat phase */
export interface CombatCardPlay {
  id: string                          // unique play ID (counter-based: 'play_0', 'play_1', etc.)
  sourceType: 'card' | 'unit' | 'skill'
  cardIndex?: number                  // index in hand (for cards)
  unitIndex?: number                  // index in player.units (for units)
  skillIndex?: number                 // index in player.skills (for skills)
  cardId: string | number             // card.id or unit.unit.id
  cardName: string                    // display name
  effectType: 'basic' | 'strong' | 'sideways'
  chosenAction: CardAction | null     // the specific action chosen (null for sideways)
  value: number                       // contributed value (1 for sideways)
  element: Element                    // 'physical' | 'fire' | 'ice' | 'cold_fire'
  targetEnemyId?: string              // for attacks: which enemy targeted
  manaCost?: string | string[]        // mana cost if strong effect used
}

/** State for building an attack declaration from multiple card plays */
export interface PendingAttack {
  id: string                          // unique attack ID
  targetEnemyIds: string[]            // which enemies are targeted
  plays: CombatCardPlay[]             // cards/units contributing to this attack
  totalValue: number                  // sum of all play values
  element: Element                    // combined element (physical if mixed)
  isSiege: boolean                    // true if any play is siege
  isRanged: boolean                   // true if any play is ranged
}

/** State for building a block declaration against one enemy */
export interface PendingBlock {
  enemyInstanceId: string             // which enemy being blocked
  plays: CombatCardPlay[]             // cards/units contributing to block
  totalValue: number                  // sum of all play values
  element: Element                    // combined element
  requiredValue: number               // enemy attack value (2x if swift)
  isSwift: boolean                    // if enemy is swift
}

/** The full state managed by useCombatCards hook */
export interface CombatCardsState {
  plays: CombatCardPlay[]             // all card/unit plays this phase
  pendingAttacks: PendingAttack[]     // attacks being built (ranged/melee phases)
  pendingBlocks: PendingBlock[]       // blocks being built (block phase)
  usedCardIndices: Set<number>        // hand indices already used this phase
  usedUnitIndices: Set<number>        // unit indices already used this phase
  usedSkillIndices: Set<number>       // skill indices already used this combat
  activeTargetEnemyId: string | null  // currently targeted enemy for attacks
}

/** Initial empty state for combat cards */
export const INITIAL_COMBAT_CARDS_STATE: CombatCardsState = {
  plays: [],
  pendingAttacks: [],
  pendingBlocks: [],
  usedCardIndices: new Set(),
  usedUnitIndices: new Set(),
  usedSkillIndices: new Set(),
  activeTargetEnemyId: null,
}
