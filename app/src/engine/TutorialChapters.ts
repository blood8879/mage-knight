// ═══════════════════════════════════════════
// Tutorial Chapter & Step Definitions
// Pure TypeScript — no React/DOM dependencies
// ═══════════════════════════════════════════

import type {
  GamePhase,
  CombatPhase,
  HexCoord,
  DayNight,
  TurnType,
} from './types'

// ── Snapshot: observable state for advance conditions ──

export interface TutorialSnapshot {
  phase: GamePhase
  combatPhase?: CombatPhase
  combatActive: boolean
  playerPosition: HexCoord
  cardsInPlayArea: number
  cardsInHand: number
  manaTokenCount: number
  crystalTotal: number
  sourceDieTaken: boolean
  unitCount: number
  fame: number
  level: number
  reputation: number
  turnType: TurnType
  dayNight: DayNight
  tilesRevealed: number
  interactionActive: boolean
  movePointsAvailable: number
  hasMovedThisTurn: boolean
  hasActedThisTurn: boolean
  woundsInHand: number
}

// ── Spotlight & Arrow Types ──

export type SpotlightArea =
  | 'none'
  | 'full'
  | 'bottom'
  | 'center'
  | 'top'
  | 'top-right'
  | 'side'
  | 'combat'
  | 'mana-area'
  | 'interaction'

export type ArrowDirection = 'up' | 'down' | 'down-left' | 'left' | 'right'

// ── Step Definition ──

export interface TutorialStepDef {
  id: string
  icon: string
  i18nKey: string
  spotlight: SpotlightArea
  arrow?: ArrowDirection
  /** data-tutorial attribute value to highlight */
  highlightTarget?: string
  requiresAction: boolean
  /** If provided, step auto-advances when this returns true. */
  advanceWhen?: (prev: TutorialSnapshot, curr: TutorialSnapshot) => boolean
}

// ── Chapter Definition ──

export interface TutorialChapter {
  id: number
  titleKey: string
  descriptionKey: string
  icon: string
  estimatedMinutes: number
  steps: TutorialStepDef[]
}

// ══════════════════════════════════════════════════════════════
//  CHAPTER 1 — First Steps
//  Teaches: card play, basic movement, combat 4 phases, end turn
// ══════════════════════════════════════════════════════════════

const CHAPTER_1_STEPS: TutorialStepDef[] = [
  {
    id: 'ch1_welcome',
    icon: '👋',
    i18nKey: 'ch1.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch1_hand_overview',
    icon: '🃏',
    i18nKey: 'ch1.handOverview',
    spotlight: 'bottom',
    arrow: 'down',
    highlightTarget: 'card-hand',
    requiresAction: false,
  },
  {
    id: 'ch1_play_card',
    icon: '▶️',
    i18nKey: 'ch1.playCard',
    spotlight: 'bottom',
    arrow: 'down-left',
    highlightTarget: 'card-hand',
    requiresAction: true,
    advanceWhen: (_prev, curr) => curr.cardsInPlayArea > 0,
  },
  {
    id: 'ch1_movement_points',
    icon: '🔢',
    i18nKey: 'ch1.movementPoints',
    spotlight: 'center',
    highlightTarget: 'phase-hint',
    requiresAction: false,
  },
  {
    id: 'ch1_terrain_intro',
    icon: '⛰️',
    i18nKey: 'ch1.terrainIntro',
    spotlight: 'center',
    highlightTarget: 'hex-map',
    requiresAction: false,
  },
  {
    id: 'ch1_move_to_hex',
    icon: '🗺️',
    i18nKey: 'ch1.moveToHex',
    spotlight: 'center',
    arrow: 'down',
    highlightTarget: 'hex-map',
    requiresAction: true,
    advanceWhen: (_prev, curr) => curr.hasMovedThisTurn,
  },
  {
    id: 'ch1_enemy_spotted',
    icon: '⚔️',
    i18nKey: 'ch1.enemySpotted',
    spotlight: 'center',
    highlightTarget: 'fight-button',
    requiresAction: true,
    advanceWhen: (_prev, curr) => curr.combatActive,
  },
  {
    id: 'ch1_combat_ranged',
    icon: '🏹',
    i18nKey: 'ch1.combatRanged',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (_prev, curr) =>
      !curr.combatActive || curr.combatPhase !== 'ranged_siege',
  },
  {
    id: 'ch1_combat_block',
    icon: '🛡️',
    i18nKey: 'ch1.combatBlock',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (_prev, curr) =>
      !curr.combatActive ||
      curr.combatPhase === 'assign_damage' || curr.combatPhase === 'attack' || curr.combatPhase === 'combat_end',
  },
  {
    id: 'ch1_combat_damage',
    icon: '💥',
    i18nKey: 'ch1.combatDamage',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (_prev, curr) =>
      !curr.combatActive || curr.combatPhase === 'attack' || curr.combatPhase === 'combat_end',
  },
  {
    id: 'ch1_combat_melee',
    icon: '⚔️',
    i18nKey: 'ch1.combatMelee',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (_prev, curr) =>
      !curr.combatActive || curr.combatPhase === 'combat_end',
  },
  {
    id: 'ch1_combat_victory',
    icon: '🏆',
    i18nKey: 'ch1.combatVictory',
    spotlight: 'combat',
    requiresAction: true,
    // Monotonic: this step is only reached once combat has started, so
    // "combat no longer active" is enough — a prev→curr transition check
    // can be missed when several steps cascade in one state update.
    advanceWhen: (_prev, curr) => !curr.combatActive,
  },
  {
    id: 'ch1_end_turn',
    icon: '⏭️',
    i18nKey: 'ch1.endTurn',
    spotlight: 'top',
    arrow: 'up',
    highlightTarget: 'end-turn',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.phase === 'end_of_turn' ||
      curr.phase === 'end_of_round' ||
      curr.phase === 'game_over' ||
      curr.phase === 'round_start' ||
      (curr.phase === 'player_turn_start' && prev.phase !== curr.phase),
  },
  {
    id: 'ch1_complete',
    icon: '🎉',
    i18nKey: 'ch1.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER 2 — Terrain & Exploration
//  Teaches: terrain costs, day/night, tile reveal, mana source,
//           crystals, strong effects, sideways play
// ══════════════════════════════════════════════════════════════

const CHAPTER_2_STEPS: TutorialStepDef[] = [
  {
    id: 'ch2_welcome',
    icon: '🌍',
    i18nKey: 'ch2.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch2_terrain_types',
    icon: '🏔️',
    i18nKey: 'ch2.terrainTypes',
    spotlight: 'center',
    requiresAction: false,
  },
  {
    id: 'ch2_day_night',
    icon: '🌙',
    i18nKey: 'ch2.dayNight',
    spotlight: 'top',
    requiresAction: false,
  },
  {
    id: 'ch2_mana_source',
    icon: '🔮',
    i18nKey: 'ch2.manaSource',
    spotlight: 'top-right',
    arrow: 'right',
    highlightTarget: 'mana-source',
    requiresAction: false,
  },
  {
    id: 'ch2_take_mana',
    icon: '✨',
    i18nKey: 'ch2.takeMana',
    spotlight: 'top-right',
    arrow: 'right',
    highlightTarget: 'mana-source',
    requiresAction: true,
    advanceWhen: (_prev, curr) => curr.sourceDieTaken,
  },
  {
    id: 'ch2_strong_effect',
    icon: '⚡',
    i18nKey: 'ch2.strongEffect',
    spotlight: 'bottom',
    arrow: 'down',
    highlightTarget: 'card-hand',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.cardsInPlayArea > prev.cardsInPlayArea && curr.manaTokenCount < prev.manaTokenCount,
  },
  {
    id: 'ch2_sideways_play',
    icon: '↔️',
    i18nKey: 'ch2.sidewaysPlay',
    spotlight: 'bottom',
    requiresAction: false,
  },
  {
    id: 'ch2_move_forest',
    icon: '🌲',
    i18nKey: 'ch2.moveForest',
    spotlight: 'center',
    arrow: 'down',
    highlightTarget: 'hex-map',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.hasMovedThisTurn && !prev.hasMovedThisTurn,
  },
  {
    id: 'ch2_tile_reveal',
    icon: '🗺️',
    i18nKey: 'ch2.tileReveal',
    spotlight: 'center',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.tilesRevealed > prev.tilesRevealed,
  },
  {
    id: 'ch2_crystals',
    icon: '💎',
    i18nKey: 'ch2.crystals',
    spotlight: 'side',
    requiresAction: false,
  },
  {
    id: 'ch2_end_turn',
    icon: '⏭️',
    i18nKey: 'ch2.endTurn',
    spotlight: 'top',
    arrow: 'up',
    highlightTarget: 'end-turn',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      (curr.phase === 'end_of_turn' ||
        curr.phase === 'end_of_round' ||
        curr.phase === 'game_over' ||
        curr.phase === 'player_turn_start' ||
        curr.phase === 'round_start') &&
      prev.phase !== curr.phase,
  },
  {
    id: 'ch2_complete',
    icon: '🎉',
    i18nKey: 'ch2.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER 3 — Mana & Card Mastery
//  Teaches: mana system depth, card types, wound management,
//           gold/black mana, spell/artifact mechanics
// ══════════════════════════════════════════════════════════════

const CHAPTER_3_STEPS: TutorialStepDef[] = [
  {
    id: 'ch3_welcome',
    icon: '🔮',
    i18nKey: 'ch3.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch3_mana_colors',
    icon: '🎨',
    i18nKey: 'ch3.manaColors',
    spotlight: 'top-right',
    requiresAction: false,
  },
  {
    id: 'ch3_gold_mana',
    icon: '🟡',
    i18nKey: 'ch3.goldMana',
    spotlight: 'top-right',
    requiresAction: false,
  },
  {
    id: 'ch3_crystal_usage',
    icon: '💎',
    i18nKey: 'ch3.crystalUsage',
    spotlight: 'side',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.crystalTotal < prev.crystalTotal,
  },
  {
    id: 'ch3_power_spell',
    icon: '📖',
    i18nKey: 'ch3.powerSpell',
    spotlight: 'bottom',
    arrow: 'down',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.cardsInPlayArea > prev.cardsInPlayArea,
  },
  {
    id: 'ch3_wounds',
    icon: '🩹',
    i18nKey: 'ch3.wounds',
    spotlight: 'bottom',
    requiresAction: false,
  },
  {
    id: 'ch3_wound_effects',
    icon: '💀',
    i18nKey: 'ch3.woundEffects',
    spotlight: 'bottom',
    requiresAction: false,
  },
  {
    id: 'ch3_artifact_cards',
    icon: '🏺',
    i18nKey: 'ch3.artifactCards',
    spotlight: 'bottom',
    requiresAction: false,
  },
  {
    id: 'ch3_card_sideways_detail',
    icon: '↔️',
    i18nKey: 'ch3.cardSidewaysDetail',
    spotlight: 'bottom',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.cardsInPlayArea > prev.cardsInPlayArea,
  },
  {
    id: 'ch3_end_turn',
    icon: '⏭️',
    i18nKey: 'ch3.endTurn',
    spotlight: 'top',
    arrow: 'up',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      (curr.phase === 'end_of_turn' ||
        curr.phase === 'end_of_round' ||
        curr.phase === 'game_over' ||
        curr.phase === 'player_turn_start' ||
        curr.phase === 'round_start') &&
      prev.phase !== curr.phase,
  },
  {
    id: 'ch3_complete',
    icon: '🎉',
    i18nKey: 'ch3.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER 4 — Interaction & Units
//  Teaches: village healing, monastery, mage tower, influence,
//           unit recruitment, unit activation, rest, reputation
// ══════════════════════════════════════════════════════════════

const CHAPTER_4_STEPS: TutorialStepDef[] = [
  {
    id: 'ch4_welcome',
    icon: '🏘️',
    i18nKey: 'ch4.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch4_influence',
    icon: '🤝',
    i18nKey: 'ch4.influence',
    spotlight: 'bottom',
    requiresAction: false,
  },
  {
    id: 'ch4_move_to_village',
    icon: '🏠',
    i18nKey: 'ch4.moveToVillage',
    spotlight: 'center',
    arrow: 'down',
    highlightTarget: 'hex-map',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.hasMovedThisTurn && !prev.hasMovedThisTurn,
  },
  {
    id: 'ch4_village_healing',
    icon: '💚',
    i18nKey: 'ch4.villageHealing',
    spotlight: 'interaction',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.woundsInHand < prev.woundsInHand,
  },
  {
    id: 'ch4_reputation',
    icon: '⭐',
    i18nKey: 'ch4.reputation',
    spotlight: 'side',
    requiresAction: false,
  },
  {
    id: 'ch4_monastery',
    icon: '⛪',
    i18nKey: 'ch4.monastery',
    spotlight: 'center',
    requiresAction: false,
  },
  {
    id: 'ch4_mage_tower',
    icon: '🗼',
    i18nKey: 'ch4.mageTower',
    spotlight: 'center',
    requiresAction: false,
  },
  {
    id: 'ch4_unit_recruit',
    icon: '🛡️',
    i18nKey: 'ch4.unitRecruit',
    spotlight: 'side',
    highlightTarget: 'units',
    requiresAction: true,
    advanceWhen: (prev, curr) => curr.unitCount > prev.unitCount,
  },
  {
    id: 'ch4_unit_activation',
    icon: '⚡',
    i18nKey: 'ch4.unitActivation',
    spotlight: 'side',
    requiresAction: false,
  },
  {
    id: 'ch4_resting',
    icon: '😴',
    i18nKey: 'ch4.resting',
    spotlight: 'top',
    highlightTarget: 'rest',
    requiresAction: false,
  },
  {
    id: 'ch4_end_turn',
    icon: '⏭️',
    i18nKey: 'ch4.endTurn',
    spotlight: 'top',
    arrow: 'up',
    highlightTarget: 'end-turn',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      (curr.phase === 'end_of_turn' ||
        curr.phase === 'end_of_round' ||
        curr.phase === 'game_over' ||
        curr.phase === 'player_turn_start' ||
        curr.phase === 'round_start') &&
      prev.phase !== curr.phase,
  },
  {
    id: 'ch4_complete',
    icon: '🎉',
    i18nKey: 'ch4.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER 5 — Advanced Combat
//  Teaches: elements, enemy abilities, fortified, swift, brutal,
//           poison, ranged cards, blocking, unit combat use
// ══════════════════════════════════════════════════════════════

const CHAPTER_5_STEPS: TutorialStepDef[] = [
  {
    id: 'ch5_welcome',
    icon: '⚔️',
    i18nKey: 'ch5.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch5_elements',
    icon: '🔥',
    i18nKey: 'ch5.elements',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch5_enemy_abilities',
    icon: '👹',
    i18nKey: 'ch5.enemyAbilities',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch5_fortified',
    icon: '🏰',
    i18nKey: 'ch5.fortified',
    spotlight: 'combat',
    requiresAction: false,
  },
  {
    id: 'ch5_engage_combat',
    icon: '⚔️',
    i18nKey: 'ch5.engageCombat',
    spotlight: 'center',
    requiresAction: true,
    advanceWhen: (_prev, curr) => curr.combatActive,
  },
  {
    id: 'ch5_ranged_attack',
    icon: '🏹',
    i18nKey: 'ch5.rangedAttack',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.combatPhase === 'block' && prev.combatPhase === 'ranged_siege',
  },
  {
    id: 'ch5_block_elements',
    icon: '🛡️',
    i18nKey: 'ch5.blockElements',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.combatPhase === 'assign_damage' && prev.combatPhase === 'block',
  },
  {
    id: 'ch5_damage_special',
    icon: '💥',
    i18nKey: 'ch5.damageSpecial',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      curr.combatPhase === 'attack' && prev.combatPhase === 'assign_damage',
  },
  {
    id: 'ch5_melee_finish',
    icon: '⚔️',
    i18nKey: 'ch5.meleeFinish',
    spotlight: 'combat',
    requiresAction: true,
    advanceWhen: (prev, curr) => !curr.combatActive && prev.combatActive,
  },
  {
    id: 'ch5_fame_reward',
    icon: '🏆',
    i18nKey: 'ch5.fameReward',
    spotlight: 'side',
    requiresAction: false,
  },
  {
    id: 'ch5_end_turn',
    icon: '⏭️',
    i18nKey: 'ch5.endTurn',
    spotlight: 'top',
    arrow: 'up',
    requiresAction: true,
    advanceWhen: (prev, curr) =>
      (curr.phase === 'end_of_turn' ||
        curr.phase === 'end_of_round' ||
        curr.phase === 'game_over' ||
        curr.phase === 'player_turn_start' ||
        curr.phase === 'round_start') &&
      prev.phase !== curr.phase,
  },
  {
    id: 'ch5_complete',
    icon: '🎉',
    i18nKey: 'ch5.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER 6 — City Assault & Game Mastery
//  Teaches: city assault, garrison, city bonuses, round transition,
//           level up, skills, scoring, game flow
// ══════════════════════════════════════════════════════════════

const CHAPTER_6_STEPS: TutorialStepDef[] = [
  {
    id: 'ch6_welcome',
    icon: '🏙️',
    i18nKey: 'ch6.welcome',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch6_city_overview',
    icon: '🏰',
    i18nKey: 'ch6.cityOverview',
    spotlight: 'center',
    requiresAction: false,
  },
  {
    id: 'ch6_city_colors',
    icon: '🎨',
    i18nKey: 'ch6.cityColors',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch6_garrison',
    icon: '👹',
    i18nKey: 'ch6.garrison',
    spotlight: 'combat',
    requiresAction: false,
  },
  {
    id: 'ch6_assault_penalty',
    icon: '⚠️',
    i18nKey: 'ch6.assaultPenalty',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch6_round_transition',
    icon: '🌅',
    i18nKey: 'ch6.roundTransition',
    spotlight: 'full',
    requiresAction: false,
  },
  {
    id: 'ch6_level_up',
    icon: '⬆️',
    i18nKey: 'ch6.levelUp',
    spotlight: 'full',
    requiresAction: false,
  },
  {
    id: 'ch6_skills',
    icon: '🎯',
    i18nKey: 'ch6.skills',
    spotlight: 'none',
    requiresAction: false,
  },
  {
    id: 'ch6_scoring',
    icon: '📊',
    i18nKey: 'ch6.scoring',
    spotlight: 'full',
    requiresAction: false,
  },
  {
    id: 'ch6_complete',
    icon: '🎓',
    i18nKey: 'ch6.complete',
    spotlight: 'none',
    requiresAction: false,
  },
]

// ══════════════════════════════════════════════════════════════
//  CHAPTER REGISTRY
// ══════════════════════════════════════════════════════════════

export const TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: 1,
    titleKey: 'tutorialChapters.ch1.title',
    descriptionKey: 'tutorialChapters.ch1.desc',
    icon: '👋',
    estimatedMinutes: 10,
    steps: CHAPTER_1_STEPS,
  },
  {
    id: 2,
    titleKey: 'tutorialChapters.ch2.title',
    descriptionKey: 'tutorialChapters.ch2.desc',
    icon: '🌍',
    estimatedMinutes: 12,
    steps: CHAPTER_2_STEPS,
  },
  {
    id: 3,
    titleKey: 'tutorialChapters.ch3.title',
    descriptionKey: 'tutorialChapters.ch3.desc',
    icon: '🔮',
    estimatedMinutes: 10,
    steps: CHAPTER_3_STEPS,
  },
  {
    id: 4,
    titleKey: 'tutorialChapters.ch4.title',
    descriptionKey: 'tutorialChapters.ch4.desc',
    icon: '🏘️',
    estimatedMinutes: 12,
    steps: CHAPTER_4_STEPS,
  },
  {
    id: 5,
    titleKey: 'tutorialChapters.ch5.title',
    descriptionKey: 'tutorialChapters.ch5.desc',
    icon: '⚔️',
    estimatedMinutes: 12,
    steps: CHAPTER_5_STEPS,
  },
  {
    id: 6,
    titleKey: 'tutorialChapters.ch6.title',
    descriptionKey: 'tutorialChapters.ch6.desc',
    icon: '🏙️',
    estimatedMinutes: 8,
    steps: CHAPTER_6_STEPS,
  },
]

// ── Helpers ──

export function getChapter(chapterId: number): TutorialChapter | undefined {
  return TUTORIAL_CHAPTERS.find((c) => c.id === chapterId)
}

export function getChapterSteps(chapterId: number): TutorialStepDef[] {
  return getChapter(chapterId)?.steps ?? []
}

export const TOTAL_TUTORIAL_STEPS = TUTORIAL_CHAPTERS.reduce(
  (sum, ch) => sum + ch.steps.length,
  0,
)
