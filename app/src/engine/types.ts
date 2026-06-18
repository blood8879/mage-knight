// ═══════════════════════════════════════════
// Mage Knight Engine — Core Type Definitions
// ═══════════════════════════════════════════

// ── Mana ──────────────────────────────────
export type ManaColor = 'red' | 'blue' | 'green' | 'white'
export type ExtendedManaColor = ManaColor | 'gold' | 'black'
export type CardColor = ManaColor | ManaColor[]

// ── Elements & Resistances ────────────────
export type Element = 'physical' | 'fire' | 'ice' | 'cold_fire'

export type AttackType = 'normal' | 'fire' | 'ice' | 'cold_fire' | 'summon'

export type Resistance =
  | 'physical'
  | 'fire'
  | 'ice'
  | 'fire_ice'
  | 'physical_fire'
  | 'physical_ice'
  | 'physical_fire_ice'

// ── Card Sets ─────────────────────────────
export type CardSet = 'base' | 'expansion' | 'ultimate' | 'lost_legion'

// ── Card Actions ──────────────────────────
export interface CardAction {
  type: string
  value?: number
  element?: string
  color?: string
  choice?: boolean
  condition?: string
  description?: string
  [key: string]: unknown
}

export interface CardEffect {
  text: string
  actions: CardAction[]
  manaCost?: string | string[]
  name?: string // for spells
}

// ── Card Types ────────────────────────────
export interface BasicActionCard {
  id: number
  name: string
  type: 'basic_action'
  color: CardColor
  basicEffect: CardEffect
  strongEffect: CardEffect
  copies: number
  heroSpecific: string | null
  replaces: string | null
  set: CardSet
}

export interface AdvancedActionCard {
  id: number
  name: string
  type: 'advanced_action'
  color: CardColor
  basicEffect: CardEffect
  strongEffect: CardEffect
  set: CardSet
}

export interface SpellCard {
  id: number
  name: string
  type: 'spell'
  color: CardColor
  basicSpell: CardEffect & { name: string }
  strongSpell: CardEffect & { name: string }
  competitive?: boolean
  set: CardSet
}

export interface ArtifactCard {
  id: number
  name: string
  type: 'artifact'
  /** 'banner' artifacts attach to units instead of resolving normally (EC-02-C-3) */
  subtype?: string
  color?: CardColor
  basicEffect: CardEffect
  strongEffect: CardEffect
  set: CardSet
}

export interface WoundCard {
  type: 'wound'
  id: string // unique instance id like 'wound_1'
}

export type DeedCard = BasicActionCard | AdvancedActionCard | SpellCard | ArtifactCard
export type AnyCard = DeedCard | WoundCard
export type AnyNonWoundCard = DeedCard

// ── Units ─────────────────────────────────
export type UnitTier = 'regular' | 'elite'
export type RecruitSite = 'village' | 'keep' | 'city' | 'monastery' | 'mage_tower' | 'glade'
export type UnitStatus = 'ready' | 'spent' | 'wounded'

export interface UnitAbility {
  name: string
  text: string
  manaCost?: string | null
  actions: CardAction[]
}

interface BaseUnit {
  id: number
  name: string
  type: string
  tier: UnitTier
  level: number
  cost: number
  armor: number
  recruitSites: RecruitSite[]
  abilities: UnitAbility[]
  resistance: Resistance | null
  copies: number
  set: CardSet
}

export interface RegularUnit extends BaseUnit {
  tier: 'regular'
}

export interface EliteUnit extends BaseUnit {
  tier: 'elite'
}

export type AnyUnit = RegularUnit | EliteUnit

// Runtime unit instance (on player's board)
export interface UnitInstance {
  unit: AnyUnit
  status: UnitStatus
  woundCount: number // 0 = healthy, 1+ = wounded (poison can cause 2)
  bannerId?: string // artifact card id if banner attached
  /** attached banner artifact (EC-02-C-3) — returns to discard on disband (EC-06-C-4) */
  bannerCard?: ArtifactCard
  /** once-a-round banner abilities (Courage/Fortitude) flip until round start */
  bannerFlipped?: boolean
}

// ── Enemies ───────────────────────────────
export type EnemyColor = 'green' | 'grey' | 'violet' | 'brown' | 'red' | 'white'

export type EnemyAbility =
  | 'fortified'
  | 'physical_resistance'
  | 'fire_resistance'
  | 'ice_resistance'
  | 'swift'
  | 'brutal'
  | 'poison'
  | 'paralyze'
  | 'arcane_immunity'
  | 'cumbersome'
  | 'unfortified'
  | 'vampiric'
  | 'assassination'
  | 'defend_1'
  | 'defend_2'
  | 'reputation_minus_1'
  | string // for summon/elusive/multiple_attack variants

export interface EnemyToken {
  id: number
  name: string
  color: EnemyColor
  category: string
  armor: number
  attack: number
  attackType: AttackType
  abilities: EnemyAbility[]
  fameReward: number
  copies: number
  set: CardSet
}

// Runtime enemy instance in combat
export interface EnemyInstance {
  token: EnemyToken
  instanceId: string // unique per combat, e.g. 'enemy_3_1'
  isDefeated: boolean
  isBlocked: boolean
  isFortified: boolean // computed from abilities + site
  currentArmor: number // may be modified by city bonuses
  currentAttack: number // may be modified by city bonuses
  currentAttackType: AttackType
  appliedAbilities: EnemyAbility[] // effective abilities including city bonuses
}

// ── Day/Night ─────────────────────────────
export type DayNight = 'day' | 'night'

// ── Terrain & Map ─────────────────────────
export type TerrainType =
  | 'plains'
  | 'hills'
  | 'forest'
  | 'wasteland'
  | 'desert'
  | 'swamp'
  | 'lake'
  | 'mountain'
  | 'sea'
  | 'city'

export type SiteType =
  | 'village'
  | 'monastery'
  | 'keep'
  | 'mageTower'
  | 'dungeon'
  | 'tomb'
  | 'ancientRuins'
  | 'monsterDen'
  | 'spawningGrounds'
  | 'crystalMine'
  | 'magicalGlade'
  | 'city'
  | 'portal'

export type CityColor = 'green' | 'blue' | 'white' | 'red'

export interface HexCoord {
  q: number
  r: number
}

export interface HexCell {
  coord: HexCoord
  terrain: TerrainType
  site?: SiteType
  siteData?: SiteState
  enemyTokens: EnemyToken[]
  tileId: string // which tile this hex belongs to
  isRevealed: boolean
}

export interface MapTile {
  id: string // e.g. 'countryside_3', 'core_5'
  type: 'starting' | 'countryside' | 'core'
  side?: 'A' | 'B'
  hasCity: boolean
  cityColor?: CityColor
  hexes: HexCell[]
  position: HexCoord // tile center position on the map grid
  isRevealed: boolean
}

export interface SiteState {
  type: SiteType
  owner?: string // player who conquered it
  isConquered: boolean
  enemyTokenIds: string[] // face-down enemy tokens
  shieldTokens: number // for cities
  cityColor?: CityColor
  cityLevel?: number // city difficulty (Solo Conquest: first revealed = 5, second = 8)
  mineColor?: ManaColor // for crystal mines
}

// ── Mana System ───────────────────────────
export interface ManaDie {
  id: string // 'die_0', 'die_1', etc.
  color: ExtendedManaColor
  isInSource: boolean // true if in source pool, false if taken by player
  takenByTactic?: boolean // e.g. Mana Steal tactic
}

export interface ManaToken {
  color: ManaColor | 'gold' | 'black'
  source: 'die' | 'effect' | 'crystal' | 'glade' // how it was obtained
}

export interface CrystalInventory {
  red: number // max 3 each
  blue: number
  green: number
  white: number
}

export interface ManaPoolState {
  dice: ManaDie[]
  playerMana: ManaToken[] // mana tokens in play area (lost at end of turn)
  crystals: CrystalInventory
  sourceDieTakenThisTurn: boolean // player can take 1 die per turn normally
  /** Extra Source dice allowed this turn beyond the first (Mana Draw basic) */
  extraSourceDice?: number
  /** Amulet of the Sun (Night): gold mana may be used as a wild basic colour
   *  even at Night this turn. */
  goldUsableAtNight?: boolean
  /** Amulet of Darkness (Day): black mana may be used (as if Night) this turn. */
  blackUsableAtDay?: boolean
}

// ── Deck System ───────────────────────────
export interface DeckState {
  drawPile: AnyCard[] // face down
  hand: AnyCard[] // player's hand
  playArea: AnyCard[] // cards played this turn
  discardPile: AnyCard[] // face up discard
}

// ── Tactics ───────────────────────────────
export interface TacticCard {
  id: number
  name: string
  type: 'day' | 'night'
  number: number
  effect: string
  isUsed: boolean // flipped face-down (e.g. "The Right Moment")
  storedCards?: AnyCard[] // for "Sparing Power"
  storedDie?: ManaDie // for "Mana Steal"
}

// ── Skills ────────────────────────────────
export type SkillUsage = 'once_per_turn' | 'once_per_round' | 'passive' | 'interactive_once_per_round'

export interface HeroSkill {
  id: number
  name: string
  type: SkillUsage
  effect: string
  actions: CardAction[]
  isFlipped: boolean // used this round (for once_per_round)
  isUsedThisTurn: boolean // used this turn (for once_per_turn)
}

// ── Combat ────────────────────────────────
export type CombatPhase =
  | 'ranged_siege'
  | 'block'
  | 'assign_damage'
  | 'attack'
  | 'combat_end'

export interface AttackDeclaration {
  id: string
  targetEnemyIds: string[] // which enemies are targeted
  attackValue: number
  attackElement: Element
  isSiege: boolean
  isRanged: boolean
  cardIds: string[] // cards used for this attack
  unitIds: string[] // units used for this attack
}

export interface BlockDeclaration {
  enemyInstanceId: string
  blockValue: number
  blockElement: Element
  cardIds: string[]
  unitIds: string[]
  isSuccessful: boolean
}

export interface DamageAssignment {
  enemyInstanceId: string
  totalDamage: number
  assignments: Array<{
    targetType: 'hero' | 'unit'
    unitInstanceIndex?: number
    damageAbsorbed: number
    woundsInflicted: number
  }>
}

export interface CombatState {
  isActive: boolean
  phase: CombatPhase
  enemies: EnemyInstance[]
  attacks: AttackDeclaration[]
  blocks: BlockDeclaration[]
  damageAssignments: DamageAssignment[]
  isFortifiedSite: boolean // enemies get fortified bonus from site
  cityColor?: CityColor // city bonuses apply
  fameEarned: number
  reputationChange: number
  rewards: CombatReward[]
  combatHexCoord?: HexCoord // which hex the combat is taking place on
}

export interface CombatReward {
  type: 'artifact' | 'spell' | 'advanced_action' | 'crystal' | 'unit' | 'fame'
  quantity: number
  color?: ManaColor // for crystal rewards
}

// ── Game Phases & Turns ───────────────────
export type GamePhase =
  | 'setup'
  | 'round_start' // round preparation
  | 'tactic_selection'
  | 'player_turn_start'
  | 'movement'
  | 'action_declaration' // choose: interact, explore, challenge, rest, do nothing
  | 'interaction' // village/monastery/tower/etc
  | 'combat_ranged_siege'
  | 'combat_block'
  | 'combat_assign_damage'
  | 'combat_attack'
  | 'combat_end'
  | 'level_up'
  | 'end_of_turn'
  | 'end_of_round'
  | 'game_over'

export type TurnType = 'regular' | 'resting'
export type RestType = 'standard' | 'slow_recovery'

export interface TurnState {
  turnNumber: number
  turnType: TurnType
  hasMovedThisTurn: boolean
  hasActedThisTurn: boolean
  cardsPlayedThisTurn: string[]
  unitsActivatedThisTurn: string[]
  sidewaysCardsPlayed: number
  movePointsAvailable: number
  movePointsSpent: number
  forcedCombat: boolean
  endOfRoundDeclared: boolean
  extraTurnGranted?: boolean
  /** Healing points accumulated from card effects this turn (EC-03-B-7: unusable in combat) */
  healingAvailable?: number
  /** A village may be plundered only once per turn (rulebook). */
  hasPlunderedThisTurn?: boolean
  /** Mana Search tactic may be used only once per turn (rulebook). */
  manaSearchUsedThisTurn?: boolean
  /** Mountain Lore played this turn: hand-limit bonus if you end in hills/mountains. */
  mountainLore?: 'basic' | 'strong'
  /** Steady Tempo played this turn: at end of turn it returns to the deck
   *  (bottom for basic, top for strong) instead of the discard pile. */
  steadyTempo?: 'basic' | 'strong'
  /** Ambush played this turn: +bonus to the FIRST Attack OR FIRST Block in
   *  combat, whichever is played first this turn. Consumed once. */
  ambush?: { attackBonus: number; blockBonus: number }
  /** Agility played this turn: leftover Move points may be spent as Attack
   *  (1:1). Strong also allows 2 Move → 1 Ranged Attack. */
  agility?: { ranged: boolean }
  /** Cure (basic) / Golden Grail (strong): draw this many cards for each Wound
   *  healed from hand for the rest of this turn. */
  drawPerWoundHeal?: number
  /** Golden Grail (basic): grant Fame +1 for each of this card's Healing points
   *  spent this turn (counter of remaining fame-granting heals). */
  fameOnHeal?: number
  /** Where this turn started — forced withdrawal retreats here (EC-03-D-1) */
  turnStartPosition?: HexCoord
  /** Turn-scoped terrain cost modifiers from cards (Frost Bridge, Path Finding…) */
  terrainModifiers?: CardAction[]
}

// ── Pending Level-Up (queued until player resolves) ──
export interface PendingLevelUp {
  level: number
  rewardType: 'stat_boost' | 'advanced_action_and_skill'
  newArmor: number
  newHandLimit: number
  newUnitLimit: number
  /** Top 2 skills revealed from the player's skill deck (for even levels) */
  revealedSkills: HeroSkill[]
}

// ── Pending Combat/Site Rewards (UNIT-07-G) ──
export type PendingReward =
  | { type: 'artifact_choice'; options: ArtifactCard[]; pickCount: number }
  | { type: 'spell_choice' }
  | { type: 'artifact_or_spell' }
  | { type: 'crystal_roll'; rolledColor: ManaColor | 'gold' | 'black' }
  | { type: 'unit_choice' }

// ── Offers (Shared) ───────────────────────
export interface OfferState {
  advancedActions: AdvancedActionCard[] // visible AA offer (3 slots)
  spells: SpellCard[] // visible spell offer (3 slots)
  units: Array<AnyUnit | AdvancedActionCard> // unit offer (player_count+2 slots), may include AA from monastery
  advancedActionDeck: AdvancedActionCard[] // remaining AA deck
  spellDeck: SpellCard[] // remaining spell deck
  regularUnitDeck: RegularUnit[]
  eliteUnitDeck: EliteUnit[]
  artifactDeck: ArtifactCard[]
}

// ── Dummy Player ──────────────────────────
export interface DummyPlayerState {
  heroName: string
  deedDeck: AnyCard[]
  discardPile: AnyCard[]
  crystals: CrystalInventory
  tacticCard: TacticCard | null
  hasEndedRound: boolean
  cardsFlippedThisRound: number
  /** EC-09-A-3: one dummy skill is revealed into the Common Skills pool per player skill acquisition */
  skillDeck?: HeroSkill[]
}

// ── Reputation ────────────────────────────
export interface ReputationLevel {
  position: number // -7 to +7 (or similar)
  influenceModifier: number // added to influence during interactions
  canInteract: boolean // false at extreme negative
}

// ── Player State ──────────────────────────
export interface PlayerState {
  name: string
  heroName: string

  // Deck
  deck: DeckState

  // Stats
  fame: number
  reputation: number
  level: number
  armor: number
  handLimit: number
  unitLimit: number

  // Units
  units: UnitInstance[]

  // Mana
  mana: ManaPoolState

  // Skills
  skills: HeroSkill[]
  commonSkillsAvailable: HeroSkill[]
  /** Face-down personal skill deck — top 2 are revealed on even-level level-ups (UNIT-09-A) */
  skillDeck?: HeroSkill[]

  // Tactics
  currentTactic: TacticCard | null

  // Position
  position: HexCoord

  // Turn state
  turn: TurnState

  // Conquered sites
  conqueredSites: Array<{
    siteType: SiteType
    tileId: string
    hexCoord: HexCoord
    shieldTokens: number
  }>

  // Level progression
  levelTokens: Array<{
    level: number
    armor: number
    handLimit: number
  }>
}

// ── Interaction ──────────────────────────
export type InteractionSiteType = 'village' | 'monastery' | 'keep' | 'mageTower' | 'city'

export interface InteractionPurchase {
  type: 'healing' | 'unit' | 'advanced_action' | 'spell' | 'artifact'
  cost: number
  itemId?: number | string
  itemName?: string
}

export interface InteractionState {
  isActive: boolean
  siteType: InteractionSiteType
  siteHex: HexCoord
  influencePool: number
  reputationModifierApplied: boolean
  purchasesMade: InteractionPurchase[]
  cityColor?: CityColor
  shieldTokens: number
}

// ── Scoring ───────────────────────────────
export interface ScoreEntry {
  category: string
  description: string
  points: number
  /** Stable key for i18n lookup (score.entryTitle.<id> / score.entryDesc.<id>) */
  id?: string
  /** Interpolation values for the translated description */
  params?: Record<string, number>
}

export interface FinalScore {
  playerName: string
  baseFame: number
  achievements: ScoreEntry[]
  totalScore: number
}

// ── Game Log ──────────────────────────────
// NOTE: GameLogEntry is defined in GameState.ts - import from there

// ── UI Screen ─────────────────────────────
export type Screen = 'main_menu' | 'game' | 'score' | 'settings'

// ── Random Seed ───────────────────────────
export type RandomSeed = number
