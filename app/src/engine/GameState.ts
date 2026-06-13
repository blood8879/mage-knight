import type {
  DayNight,
  GamePhase,
  PlayerState,
  DummyPlayerState,
  OfferState,
  CombatState,
  MapTile,
  HexCell,
  HexCoord,
  TacticCard,
  EnemyToken,
  FinalScore,
  RandomSeed,
  TurnState,
  DeckState,
  ManaPoolState,
  CrystalInventory,
  CombatPhase,
  InteractionState,
  PendingLevelUp,
  PendingReward,
} from './types'

export interface GameState {
  phase: GamePhase
  round: number
  totalRounds: number
  dayNight: DayNight
  roundPattern: DayNight[]

  player: PlayerState
  dummyPlayer: DummyPlayerState

  map: MapState
  offers: OfferState
  combat: CombatState
  interaction: InteractionState | null

  availableTactics: TacticCard[]
  usedTactics: TacticCard[]
  enemyPools: EnemyPoolState

  seed: RandomSeed
  turnCount: number
  isGameOver: boolean
  finalScore: FinalScore | null

  /** Level-ups waiting for the player to pick rewards (UNIT-10) */
  pendingLevelUps?: PendingLevelUp[]
  /** Combat/site rewards waiting to be claimed (UNIT-07-G) */
  pendingRewards?: PendingReward[]
  /** Solo Conquest: all cities conquered → player gets exactly one more turn (UNIT-12-B) */
  finalTurnPending?: boolean
  finalTurnUsed?: boolean

  log: GameLogEntry[]
}

export interface MapState {
  tiles: MapTile[]
  tileDeck: string[]
  hexGrid: Map<string, HexCell>
}

export interface EnemyPoolState {
  green: EnemyToken[]
  grey: EnemyToken[]
  violet: EnemyToken[]
  brown: EnemyToken[]
  red: EnemyToken[]
  white: EnemyToken[]
  discarded: {
    green: EnemyToken[]
    grey: EnemyToken[]
    violet: EnemyToken[]
    brown: EnemyToken[]
    red: EnemyToken[]
    white: EnemyToken[]
  }
}

export interface GameLogEntry {
  timestamp: number
  round: number
  turn: number
  type: GameLogType
  message: string
  data?: Record<string, unknown>
}

export type GameLogType =
  | 'game_start'
  | 'round_start'
  | 'round_end'
  | 'turn_start'
  | 'turn_end'
  | 'movement'
  | 'tile_reveal'
  | 'combat_start'
  | 'combat_phase'
  | 'combat_end'
  | 'card_play'
  | 'card_draw'
  | 'mana_use'
  | 'crystal_gain'
  | 'unit_recruit'
  | 'unit_activate'
  | 'unit_wound'
  | 'unit_disband'
  | 'level_up'
  | 'skill_use'
  | 'skill_gain'
  | 'interaction'
  | 'fame_gain'
  | 'reputation_change'
  | 'wound_gain'
  | 'wound_heal'
  | 'tactic_select'
  | 'dummy_turn'
  | 'site_conquer'
  | 'card_acquire'
  | 'game_end'

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`
}

export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export const INITIAL_TURN_STATE: TurnState = {
  turnNumber: 0,
  turnType: 'regular',
  hasMovedThisTurn: false,
  hasActedThisTurn: false,
  cardsPlayedThisTurn: [],
  unitsActivatedThisTurn: [],
  sidewaysCardsPlayed: 0,
  movePointsAvailable: 0,
  movePointsSpent: 0,
  forcedCombat: false,
  endOfRoundDeclared: false,
}

export const INITIAL_DECK_STATE: DeckState = {
  drawPile: [],
  hand: [],
  playArea: [],
  discardPile: [],
}

export const INITIAL_CRYSTALS: CrystalInventory = {
  red: 0,
  blue: 0,
  green: 0,
  white: 0,
}

export const INITIAL_MANA_POOL: ManaPoolState = {
  dice: [],
  playerMana: [],
  crystals: { ...INITIAL_CRYSTALS },
  sourceDieTakenThisTurn: false,
}

export const INITIAL_COMBAT_STATE: CombatState = {
  isActive: false,
  phase: 'ranged_siege' as CombatPhase,
  enemies: [],
  attacks: [],
  blocks: [],
  damageAssignments: [],
  isFortifiedSite: false,
  fameEarned: 0,
  reputationChange: 0,
  rewards: [],
}

export const INITIAL_INTERACTION_STATE: InteractionState = {
  isActive: false,
  siteType: 'village',
  siteHex: { q: 0, r: 0 },
  influencePool: 0,
  reputationModifierApplied: false,
  purchasesMade: [],
  shieldTokens: 0,
}

export const MAX_CRYSTAL_PER_COLOR = 3

export const TERRAIN_MOVE_COST: Record<string, { day: number | null; night: number | null }> = {
  plains: { day: 2, night: 2 },
  hills: { day: 3, night: 3 },
  forest: { day: 3, night: 5 },
  wasteland: { day: 4, night: 4 },
  desert: { day: 5, night: 3 },
  swamp: { day: 5, night: 5 },
  lake: { day: null, night: null },
  mountain: { day: null, night: null },
  sea: { day: null, night: null },
  city: { day: 2, night: 2 },
}

export const REPUTATION_TABLE: Array<{ position: number; modifier: number; canInteract: boolean }> = [
  { position: -7, modifier: 0, canInteract: false },
  { position: -6, modifier: 0, canInteract: false },
  { position: -5, modifier: 0, canInteract: false },
  { position: -4, modifier: -5, canInteract: true },
  { position: -3, modifier: -3, canInteract: true },
  { position: -2, modifier: -1, canInteract: true },
  { position: -1, modifier: 0, canInteract: true },
  { position: 0, modifier: 0, canInteract: true },
  { position: 1, modifier: 0, canInteract: true },
  { position: 2, modifier: 1, canInteract: true },
  { position: 3, modifier: 2, canInteract: true },
  { position: 4, modifier: 3, canInteract: true },
  { position: 5, modifier: 5, canInteract: true },
  { position: 6, modifier: 5, canInteract: true },
  { position: 7, modifier: 5, canInteract: true },
]

export const FAME_LEVEL_THRESHOLDS = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99]
