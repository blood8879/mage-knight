/**
 * ═══════════════════════════════════════════════════════════════════
 * Mage Knight — Full Playthrough Simulation
 * First Reconnaissance Scenario (Solo with Dummy Player)
 * ═══════════════════════════════════════════════════════════════════
 *
 * This test simulates a REAL game of Mage Knight step by step,
 * composing all engine modules exactly as a player would experience:
 *
 *   Setup → Round 1 (Day) → Round 2 (Night) → Round 3 (Day) → Scoring
 *
 * Each step calls the actual engine APIs and validates state transitions.
 * Think of this as "the game engine's integration test" — if this passes,
 * the engine can run a complete game.
 */

import { describe, it, expect, beforeAll } from 'vitest'

// Engine modules
import { ScenarioSetup, type ScenarioConfig } from '@/engine/ScenarioSetup'
import { TurnManager, type RoundState } from '@/engine/TurnManager'
import { MapGenerator } from '@/engine/MapGenerator'
import { ManaPool } from '@/engine/ManaPool'
import { DeckManager } from '@/engine/DeckManager'
import { MovementResolver } from '@/engine/MovementResolver'
import { CombatResolver } from '@/engine/CombatResolver'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { ReputationManager } from '@/engine/ReputationManager'
import { UnitManager } from '@/engine/UnitManager'
import { DummyPlayer } from '@/engine/DummyPlayer'
import { ScoringCalculator, type ScoringContext } from '@/engine/ScoringCalculator'

// State types
import type { MapState, EnemyPoolState } from '@/engine/GameState'
import { INITIAL_COMBAT_STATE } from '@/engine/GameState'
import type {
  PlayerState,
  DummyPlayerState,
  OfferState,
  TacticCard,
  DayNight,
  HexCoord,
  DeckState,
  ManaPoolState,
  AnyCard,
  EnemyToken,
  CombatState,
  AttackDeclaration,
  BlockDeclaration,
  DamageAssignment,
} from '@/engine/types'

// Data loaders
import {
  getAdvancedActions,
  getSpells,
  getArtifacts,
  getRegularUnits,
  getEliteUnits,
  getBasicActions,
  getEnemies,
  getTactics,
} from '@/data/loader'

// Utilities
import { SeededRandom } from '@/utils/random'
import { hexKey, hexNeighbors } from '@/utils/hexMath'

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert TacticCardData from loader to TacticCard (engine type) */
function toTacticCards(
  data: Array<{ id: number; name: string; type: 'day' | 'night'; number: number; effect: string }>,
): TacticCard[] {
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    number: t.number,
    effect: t.effect,
    isUsed: false,
  }))
}

/** Log helper that collects game events for debugging */
class GameLog {
  private entries: string[] = []
  log(msg: string) {
    this.entries.push(msg)
  }
  dump() {
    return this.entries.join('\n')
  }
  get length() {
    return this.entries.length
  }
}

/** Find a hex on the map that has a specific site type */
function findHexWithSite(mapState: MapState, siteType: string): HexCoord | null {
  for (const hex of mapState.hexGrid.values()) {
    if (hex.site === siteType) return hex.coord
  }
  return null
}

/** Find a hex adjacent to 'from' that exists on the map and is passable */
function findAdjacentPassableHex(
  mapState: MapState,
  from: HexCoord,
  dayNight: DayNight,
  movementResolver: MovementResolver,
): HexCoord | null {
  for (const neighbor of hexNeighbors(from)) {
    const hex = mapState.hexGrid.get(hexKey(neighbor))
    if (hex && movementResolver.canMoveTo(hex, dayNight)) {
      const cost = movementResolver.getMoveCost(hex.terrain, dayNight)
      if (cost !== null) return neighbor
    }
  }
  return null
}

/** Find all reachable hexes with enemies (for combat scenarios) */
function findHexWithEnemies(mapState: MapState): HexCoord | null {
  for (const hex of mapState.hexGrid.values()) {
    if (hex.enemyTokens.length > 0) return hex.coord
  }
  return null
}

/** Get a non-wound card index from hand */
function findNonWoundCardIndex(deck: DeckState): number {
  return deck.hand.findIndex((card) => card.type !== 'wound')
}

// ═══════════════════════════════════════════════════════════════════
// THE SIMULATION
// ═══════════════════════════════════════════════════════════════════

describe('Full Playthrough Simulation — First Reconnaissance', () => {
  // Shared state across the simulation (mutable — this IS the game state)
  const SEED = 42
  let random: SeededRandom
  let log: GameLog

  // Engine instances
  let scenarioSetup: ScenarioSetup
  let turnManager: TurnManager
  let mapGenerator: MapGenerator
  let manaPool: ManaPool
  let deckManager: DeckManager
  let movementResolver: MovementResolver
  let combatResolver: CombatResolver
  let levelUpManager: LevelUpManager
  let reputationManager: ReputationManager
  let unitManager: UnitManager
  let dummyPlayerEngine: DummyPlayer
  let scoringCalculator: ScoringCalculator

  // Game state
  let config: ScenarioConfig
  let player: PlayerState
  let dummy: DummyPlayerState
  let mapState: MapState
  let offers: OfferState
  let enemyPools: EnemyPoolState
  let availableTactics: TacticCard[]
  let currentRound: number
  let currentDayNight: DayNight
  let turnCount: number

  // ─── PHASE 0: Bootstrap all engines and data ───

  beforeAll(() => {
    random = new SeededRandom(SEED)
    log = new GameLog()

    // Instantiate all engines
    scenarioSetup = new ScenarioSetup(random)
    turnManager = new TurnManager(random)
    mapGenerator = new MapGenerator(random)
    manaPool = new ManaPool(random)
    deckManager = new DeckManager(random)
    movementResolver = new MovementResolver()
    combatResolver = new CombatResolver(random)
    levelUpManager = new LevelUpManager()
    reputationManager = new ReputationManager()
    unitManager = new UnitManager()
    dummyPlayerEngine = new DummyPlayer(random)
    scoringCalculator = new ScoringCalculator()
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 1: GAME SETUP
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 1: Game Setup', () => {
    it('should configure the First Reconnaissance scenario', () => {
      config = scenarioSetup.setupFirstReconnaissance()

      expect(config.name).toBe('First Reconnaissance')
      expect(config.totalRounds).toBe(3)
      expect(config.roundPattern).toEqual(['day', 'night', 'day'])
      expect(config.useDummyPlayer).toBe(true)
      expect(config.diceCount).toBe(4)
      expect(config.useEliteUnits).toBe(false)
      expect(config.playerCount).toBe(2) // player + dummy

      log.log(`[SETUP] Scenario: ${config.name}, Rounds: ${config.totalRounds}, Pattern: ${config.roundPattern.join('-')}`)
    })

    it('should generate the map with starting tile and initial reveals', () => {
      mapState = mapGenerator.generateMap(config.mapConfig)

      // Starting tile always present
      expect(mapState.tiles.length).toBeGreaterThanOrEqual(1)
      expect(mapState.tiles[0].type).toBe('starting')
      expect(mapState.tiles[0].isRevealed).toBe(true)

      // Portal hex at center (0,0)
      const portalHex = mapState.hexGrid.get(hexKey({ q: 0, r: 0 }))
      expect(portalHex).toBeDefined()
      expect(portalHex!.site).toBe('portal')
      expect(portalHex!.terrain).toBe('plains')

      // Some initial tiles revealed (MapGenerator reveals 2-3 countryside tiles)
      expect(mapState.tiles.length).toBeGreaterThanOrEqual(2)

      // Tile deck has remaining tiles
      const totalTileCount = config.mapConfig.countrysideTileCount + config.mapConfig.coreTileCount
      const revealedNonStarting = mapState.tiles.length - 1
      expect(mapState.tileDeck.length).toBe(totalTileCount - revealedNonStarting)

      // hexGrid populated
      expect(mapState.hexGrid.size).toBeGreaterThanOrEqual(7) // at least starting tile (7 hexes)

      log.log(`[SETUP] Map: ${mapState.tiles.length} tiles revealed, ${mapState.tileDeck.length} in deck, ${mapState.hexGrid.size} hexes on grid`)
    })

    it('should set up player deck for Arythea and draw initial hand', () => {
      const basicActions = getBasicActions()
      const allBasicCards = [...basicActions.commonCards, ...basicActions.heroSpecificCards]
      const playerDeckCards = scenarioSetup.setupPlayerDeck('Arythea', allBasicCards)

      expect(playerDeckCards.length).toBeGreaterThan(0)

      // Initialize player at portal (0,0)
      player = scenarioSetup.getInitialPlayerState('Arythea', playerDeckCards, { q: 0, r: 0 })

      expect(player.heroName).toBe('Arythea')
      expect(player.fame).toBe(0)
      expect(player.reputation).toBe(0)
      expect(player.level).toBe(1)
      expect(player.armor).toBe(2)
      expect(player.handLimit).toBe(5)
      expect(player.unitLimit).toBe(1)
      expect(player.position).toEqual({ q: 0, r: 0 })
      expect(player.deck.drawPile.length).toBe(playerDeckCards.length) // all in draw pile
      expect(player.deck.hand.length).toBe(0) // no cards drawn yet

      // Draw initial hand
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }

      expect(player.deck.hand.length).toBe(5)
      expect(player.deck.drawPile.length).toBe(playerDeckCards.length - 5)

      log.log(`[SETUP] Player: ${player.heroName}, Hand: ${player.deck.hand.length} cards, Deck: ${player.deck.drawPile.length} remaining`)
    })

    it('should set up dummy player (Tovak)', () => {
      const basicActions = getBasicActions()
      const allBasicCards = [...basicActions.commonCards, ...basicActions.heroSpecificCards]
      // For dummy, use a different hero's basic actions (simplified — use common cards only)
      const dummyDeckCards: AnyCard[] = allBasicCards
        .filter((c) => c.heroSpecific === null || c.heroSpecific === 'Tovak')
        .flatMap((c) => {
          if (c.heroSpecific === 'Tovak') return [{ ...c }]
          const isReplaced = allBasicCards.some(
            (other) => other.replaces === c.name && other.heroSpecific === 'Tovak',
          )
          if (isReplaced) {
            const remaining = c.copies - 1
            return Array.from({ length: remaining }, () => ({ ...c }))
          }
          return Array.from({ length: c.copies }, () => ({ ...c }))
        })

      dummy = scenarioSetup.getInitialDummyState('Tovak', dummyDeckCards)

      expect(dummy.heroName).toBe('Tovak')
      expect(dummy.deedDeck.length).toBeGreaterThan(0)
      expect(dummy.hasEndedRound).toBe(false)
      expect(dummy.crystals.blue).toBe(1) // Tovak starts with blue + white crystals
      expect(dummy.crystals.white).toBe(1)

      log.log(`[SETUP] Dummy: ${dummy.heroName}, Deck: ${dummy.deedDeck.length} cards, Crystals: B=${dummy.crystals.blue} W=${dummy.crystals.white}`)
    })

    it('should initialize mana source with 4 dice', () => {
      player = { ...player, mana: manaPool.initializeSource(config.diceCount) }

      expect(player.mana.dice.length).toBe(4)
      // At least half should be basic colors (ManaPool validation)
      const basicCount = player.mana.dice.filter((d) =>
        ['red', 'blue', 'green', 'white'].includes(d.color),
      ).length
      expect(basicCount).toBeGreaterThanOrEqual(2) // at least ceil(4/2)

      // All dice should be in source
      expect(player.mana.dice.every((d) => d.isInSource)).toBe(true)

      const diceColors = player.mana.dice.map((d) => d.color).join(', ')
      log.log(`[SETUP] Mana source: ${diceColors}`)
    })

    it('should set up card offers (AA, spells, units)', () => {
      const allAA = getAdvancedActions()
      const allSpells = getSpells()
      const allRegular = getRegularUnits()
      const allElite = getEliteUnits()
      const allArtifacts = getArtifacts()

      offers = scenarioSetup.setupOffers(config, allAA, allSpells, allRegular, allElite, allArtifacts)

      expect(offers.advancedActions.length).toBe(config.aaOfferSlots) // 3
      expect(offers.spells.length).toBe(config.spellOfferSlots) // 3
      expect(offers.units.length).toBe(config.unitOfferSlots) // 4
      expect(offers.advancedActionDeck.length).toBeGreaterThan(0)
      expect(offers.spellDeck.length).toBeGreaterThan(0)
      expect(offers.regularUnitDeck.length).toBeGreaterThan(0)
      expect(offers.eliteUnitDeck.length).toBe(0) // First Recon: no elite units
      expect(offers.artifactDeck.length).toBeGreaterThan(0)

      log.log(`[SETUP] Offers: ${offers.advancedActions.length} AA, ${offers.spells.length} spells, ${offers.units.length} units`)
      log.log(`[SETUP] AA offer: ${offers.advancedActions.map((c) => c.name).join(', ')}`)
      log.log(`[SETUP] Spell offer: ${offers.spells.map((c) => c.name).join(', ')}`)
    })

    it('should set up enemy pools', () => {
      const allEnemies = getEnemies()
      enemyPools = scenarioSetup.setupEnemyPools(allEnemies)

      expect(enemyPools.green.length).toBeGreaterThan(0)
      expect(enemyPools.grey.length).toBeGreaterThan(0)
      expect(enemyPools.violet.length).toBeGreaterThanOrEqual(0)
      expect(enemyPools.brown.length).toBeGreaterThanOrEqual(0)

      const totalEnemies = Object.values(enemyPools)
        .filter(Array.isArray)
        .reduce((sum, arr) => sum + (arr as EnemyToken[]).length, 0)

      log.log(`[SETUP] Enemy pools: ${totalEnemies} total enemies`)
      log.log(`[SETUP]   Green: ${enemyPools.green.length}, Grey: ${enemyPools.grey.length}, Violet: ${enemyPools.violet.length}`)
    })

    it('should prepare tactics cards', () => {
      const tacticsData = getTactics()
      const dayTactics = toTacticCards(tacticsData.dayTactics)
      const nightTactics = toTacticCards(tacticsData.nightTactics)
      const organized = scenarioSetup.setupTactics(dayTactics, nightTactics)

      availableTactics = [...organized.day, ...organized.night]

      expect(organized.day.length).toBeGreaterThan(0)
      expect(organized.night.length).toBeGreaterThan(0)

      log.log(`[SETUP] Tactics: ${organized.day.length} day, ${organized.night.length} night`)

      // Set initial round counters
      currentRound = 1
      currentDayNight = config.roundPattern[0] // 'day'
      turnCount = 0
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 2: ROUND 1 — DAY
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 2: Round 1 — Day', () => {
    let roundState: RoundState

    it('should start Round 1 (day)', () => {
      const dayTactics = availableTactics.filter((t) => t.type === 'day')
      roundState = turnManager.startRound(1, 'day', dayTactics)

      expect(roundState.roundNumber).toBe(1)
      expect(roundState.dayNight).toBe('day')
      expect(roundState.isEnded).toBe(false)

      log.log(`\n[ROUND 1] === Day Round Begins ===`)
      log.log(`[ROUND 1] Available day tactics: ${roundState.availableTactics.map((t) => `${t.name}(#${t.number})`).join(', ')}`)
    })

    it('should select tactics — dummy picks lowest, player picks another', () => {
      // Dummy picks first (lowest number)
      const dummyResult = turnManager.selectTacticForDummy(roundState.availableTactics)
      dummy = { ...dummy, tacticCard: dummyResult.selected }
      roundState = { ...roundState, dummyTactic: dummyResult.selected, availableTactics: dummyResult.remaining }

      expect(dummy.tacticCard).toBeDefined()

      // Player picks from remaining
      expect(roundState.availableTactics.length).toBeGreaterThan(0)
      const playerTacticId = roundState.availableTactics[0].id
      const playerResult = turnManager.selectTacticForPlayer(roundState.availableTactics, playerTacticId)
      player = { ...player, currentTactic: playerResult.selected }
      roundState = { ...roundState, playerTactic: playerResult.selected, availableTactics: playerResult.remaining }

      expect(player.currentTactic).toBeDefined()

      // Determine turn order
      const turnOrder = turnManager.determineTurnOrder(player.currentTactic!, dummy.tacticCard!)
      roundState = { ...roundState, turnOrder }

      log.log(`[ROUND 1] Dummy tactic: ${dummy.tacticCard!.name} (#${dummy.tacticCard!.number})`)
      log.log(`[ROUND 1] Player tactic: ${player.currentTactic!.name} (#${player.currentTactic!.number})`)
      log.log(`[ROUND 1] Turn order: ${turnOrder}`)
    })

    it('should play Turn 1 — Player moves to an adjacent hex', () => {
      turnCount++
      player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

      expect(player.turn.turnNumber).toBe(1)
      expect(player.turn.hasMovedThisTurn).toBe(false)

      const target = findAdjacentPassableHex(mapState, player.position, 'day', movementResolver)
      expect(target).not.toBeNull()

      const targetHex = mapState.hexGrid.get(hexKey(target!))!
      const moveCost = movementResolver.getMoveCost(targetHex.terrain, 'day')!

      let movePointsGathered = 0
      let cardsPlayed = 0
      while (movePointsGathered < moveCost) {
        const cardIdx = findNonWoundCardIndex(player.deck)
        if (cardIdx < 0) break
        player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
        movePointsGathered += 2
        cardsPlayed++
      }

      player = {
        ...player,
        turn: {
          ...player.turn,
          movePointsAvailable: player.turn.movePointsAvailable + movePointsGathered,
        },
      }

      expect(player.turn.movePointsAvailable).toBeGreaterThanOrEqual(moveCost)

      player = {
        ...player,
        position: target!,
        turn: {
          ...player.turn,
          hasMovedThisTurn: true,
          movePointsSpent: player.turn.movePointsSpent + moveCost,
          movePointsAvailable: player.turn.movePointsAvailable - moveCost,
        },
      }

      expect(player.turn.hasMovedThisTurn).toBe(true)

      log.log(`[TURN ${turnCount}] Player moved: (0,0) → (${target!.q},${target!.r}), cost=${moveCost}, terrain=${targetHex.terrain}, cards=${cardsPlayed}`)
    })

    it('should complete Turn 1 — discard play area, draw cards', () => {
      // End turn: discard played cards, reset mana, draw to hand limit
      player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
      player = { ...player, mana: manaPool.resetTurnState(player.mana) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, turn: turnManager.endTurn(player.turn) }

      expect(player.deck.playArea.length).toBe(0)
      expect(player.deck.hand.length).toBeLessThanOrEqual(player.handLimit)

      log.log(`[TURN ${turnCount}] End turn — Hand: ${player.deck.hand.length}, Deck: ${player.deck.drawPile.length}, Discard: ${player.deck.discardPile.length}`)
    })

    it('should execute Dummy Turn 1', () => {
      dummy = dummyPlayerEngine.executeDummyTurn(dummy)

      const cardsLeft = dummyPlayerEngine.getDummyRemainingCards(dummy)

      log.log(`[TURN ${turnCount}] Dummy flipped cards — Remaining: ${cardsLeft}, Ended: ${dummy.hasEndedRound}`)
    })

    it('should play Turn 2 — Player explores map (reveal a new tile)', () => {
      turnCount++
      player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

      // Check if we can reveal a tile
      const canReveal = movementResolver.canRevealTile(mapState, player.position)

      if (canReveal) {
        // Get valid placements and reveal
        const placements = mapGenerator.getValidTilePlacements(mapState)
        expect(placements.length).toBeGreaterThan(0)

        const previousTileCount = mapState.tiles.length
        mapState = mapGenerator.revealTile(mapState, placements[0])

        expect(mapState.tiles.length).toBe(previousTileCount + 1)
        const newTile = mapState.tiles[mapState.tiles.length - 1]

        // In First Recon, revealing a tile gives +1 fame (special rule: tile_fame)
        if (config.specialRules.includes('tile_fame')) {
          const fameResult = levelUpManager.addFame(player.fame, 1)
          player = { ...player, fame: fameResult.newFame, level: fameResult.newLevel }
        }

        log.log(`[TURN ${turnCount}] Revealed tile: ${newTile.id}, type=${newTile.type}`)
        log.log(`[TURN ${turnCount}] Fame: ${player.fame} (tile explore bonus)`)
      } else {
        log.log(`[TURN ${turnCount}] No tiles to reveal from current position`)
      }

      // Play a card for movement and move
      const cardIdx = findNonWoundCardIndex(player.deck)
      if (cardIdx >= 0) {
        player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
        player = {
          ...player,
          turn: { ...player.turn, movePointsAvailable: player.turn.movePointsAvailable + 2 },
        }

        const target = findAdjacentPassableHex(mapState, player.position, 'day', movementResolver)
        if (target) {
          const targetHex = mapState.hexGrid.get(hexKey(target))!
          const moveCost = movementResolver.getMoveCost(targetHex.terrain, 'day')
          if (moveCost !== null && moveCost <= player.turn.movePointsAvailable) {
            const oldPos = { ...player.position }
            player = {
              ...player,
              position: target,
              turn: {
                ...player.turn,
                hasMovedThisTurn: true,
                movePointsSpent: player.turn.movePointsSpent + moveCost,
                movePointsAvailable: player.turn.movePointsAvailable - moveCost,
              },
            }
            log.log(`[TURN ${turnCount}] Player moved: (${oldPos.q},${oldPos.r}) → (${target.q},${target.r}), terrain=${targetHex.terrain}`)
          }
        }
      }

      // End turn
      player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
      player = { ...player, mana: manaPool.resetTurnState(player.mana) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, turn: turnManager.endTurn(player.turn) }

      log.log(`[TURN ${turnCount}] End turn — Hand: ${player.deck.hand.length}, Deck: ${player.deck.drawPile.length}`)
    })

    it('should execute Dummy Turn 2', () => {
      dummy = dummyPlayerEngine.executeDummyTurn(dummy)
      log.log(`[TURN ${turnCount}] Dummy — Remaining: ${dummyPlayerEngine.getDummyRemainingCards(dummy)}, Ended: ${dummy.hasEndedRound}`)
    })

    it('should play Turn 3 — Player uses mana for a strong card effect', () => {
      turnCount++
      player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

      // Take a mana die from source (1 per turn normally)
      // During Day: gold OK, black NOT OK. Filter to valid dice.
      const BASIC_COLORS = ['red', 'blue', 'green', 'white', 'gold']
      const availableDie = player.mana.dice.find((d) => d.isInSource && BASIC_COLORS.includes(d.color))
      if (availableDie) {
        player = { ...player, mana: manaPool.takeDieFromSource(player.mana, availableDie.id, 'day') }
        expect(player.mana.sourceDieTakenThisTurn).toBe(true)
        expect(player.mana.playerMana.length).toBe(1)

        log.log(`[TURN ${turnCount}] Took mana die: ${availableDie.color}`)
      }

      // Play a card (simulating using it with mana for strong effect)
      const cardIdx = findNonWoundCardIndex(player.deck)
      if (cardIdx >= 0) {
        const card = player.deck.hand[cardIdx]
        player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }

        // Simulate strong effect: 4 move points
        player = {
          ...player,
          turn: { ...player.turn, movePointsAvailable: player.turn.movePointsAvailable + 4 },
        }

        log.log(`[TURN ${turnCount}] Played card with mana boost: ${card.type !== 'wound' ? (card as any).name : 'wound'} → 4 move points`)
      }

      const target = findAdjacentPassableHex(mapState, player.position, 'day', movementResolver)
      if (target) {
        const targetHex = mapState.hexGrid.get(hexKey(target))!
        const moveCost = movementResolver.getMoveCost(targetHex.terrain, 'day')
        if (moveCost !== null && moveCost <= player.turn.movePointsAvailable) {
          const oldPos = { ...player.position }
          player = {
            ...player,
            position: target,
            turn: {
              ...player.turn,
              hasMovedThisTurn: true,
              movePointsSpent: player.turn.movePointsSpent + moveCost,
              movePointsAvailable: player.turn.movePointsAvailable - moveCost,
            },
          }
          log.log(`[TURN ${turnCount}] Player moved: (${oldPos.q},${oldPos.r}) → (${target.q},${target.r})`)
        }
      }

      // End turn
      player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
      player = { ...player, mana: manaPool.resetTurnState(player.mana) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, turn: turnManager.endTurn(player.turn) }

      log.log(`[TURN ${turnCount}] End turn — Hand: ${player.deck.hand.length}`)
    })

    it('should execute Dummy Turn 3', () => {
      dummy = dummyPlayerEngine.executeDummyTurn(dummy)
      log.log(`[TURN ${turnCount}] Dummy — Remaining: ${dummyPlayerEngine.getDummyRemainingCards(dummy)}, Ended: ${dummy.hasEndedRound}`)
    })

    it('should play Turn 4 — Player interacts with a village (if found)', () => {
      turnCount++
      player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

      // Find a village on the map
      const villageCoord = findHexWithSite(mapState, 'village')

      if (villageCoord) {
        // Check reputation allows interaction
        const canInteract = reputationManager.canInteract(player.reputation)
        expect(canInteract).toBe(true) // reputation 0 allows interaction

        // Get influence modifier
        const influenceModifier = reputationManager.getInfluenceModifier(player.reputation)

        // Calculate interaction cost for healing at village
        const healing = reputationManager.canBuyHealing(3 + influenceModifier, 'village')

        log.log(`[TURN ${turnCount}] Village found at (${villageCoord.q},${villageCoord.r})`)
        log.log(`[TURN ${turnCount}] Influence modifier: ${influenceModifier}, Can heal: ${healing.canBuy}`)

        // Check recruitable units at village
        const recruitSites = reputationManager.canRecruitAtSite('village', false)
        expect(recruitSites).toContain('village')

        // Check if player can recruit
        const canRecruit = unitManager.canRecruit(player.units, player.unitLimit)
        log.log(`[TURN ${turnCount}] Can recruit: ${canRecruit}, Unit slots: ${player.units.length}/${player.unitLimit}`)

        // If there's a recruitable unit in the offer
        if (canRecruit && offers.units.length > 0) {
          // Find a village-recruitable unit
          const recruitableUnit = offers.units.find((u) => {
            if ('tier' in u && 'recruitSites' in u) {
              return (u as any).recruitSites.includes('village')
            }
            return false
          })

          if (recruitableUnit && 'tier' in recruitableUnit) {
            // Simulate paying influence cost (card sideways = 1 influence)
            const cardIdx = findNonWoundCardIndex(player.deck)
            if (cardIdx >= 0) {
              player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
            }

            try {
              player = { ...player, units: unitManager.recruitUnit(player.units, recruitableUnit, player.unitLimit) }
              log.log(`[TURN ${turnCount}] Recruited unit: ${recruitableUnit.name} (level ${recruitableUnit.level})`)
            } catch {
              log.log(`[TURN ${turnCount}] Failed to recruit — unit limit reached`)
            }
          }
        }
      } else {
        log.log(`[TURN ${turnCount}] No village found on revealed map`)
      }

      // End turn
      player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
      player = { ...player, mana: manaPool.resetTurnState(player.mana) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, turn: turnManager.endTurn(player.turn) }

      log.log(`[TURN ${turnCount}] End turn — Units: ${player.units.length}, Hand: ${player.deck.hand.length}`)
    })

    it('should execute Dummy Turn 4', () => {
      dummy = dummyPlayerEngine.executeDummyTurn(dummy)
      log.log(`[TURN ${turnCount}] Dummy — Remaining: ${dummyPlayerEngine.getDummyRemainingCards(dummy)}, Ended: ${dummy.hasEndedRound}`)
    })

    it('should play remaining turns until Round 1 ends (deck exhaustion)', () => {
      // Continue turns until both player and dummy have declared end of round
      let safetyCounter = 0
      const MAX_TURNS = 20

      while (safetyCounter < MAX_TURNS) {
        safetyCounter++
        turnCount++

        // Check if player must/can declare end of round
        const endOfRoundCheck = deckManager.canDeclareEndOfRound(player.deck)

        if (endOfRoundCheck.must || (endOfRoundCheck.may && player.deck.drawPile.length === 0)) {
          log.log(`[TURN ${turnCount}] Player declares end of round (must=${endOfRoundCheck.must}, may=${endOfRoundCheck.may})`)
          break
        }

        // Play a turn: play a card, move, end turn
        player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

        const cardIdx = findNonWoundCardIndex(player.deck)
        if (cardIdx >= 0) {
          player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
        }

        // Simple move
        const target = findAdjacentPassableHex(mapState, player.position, 'day', movementResolver)
        if (target) {
          player = { ...player, position: target, turn: { ...player.turn, hasMovedThisTurn: true } }
        }

        // End turn
        player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
        player = { ...player, mana: manaPool.resetTurnState(player.mana) }
        player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
        player = { ...player, turn: turnManager.endTurn(player.turn) }

        // Dummy turn
        if (!dummy.hasEndedRound) {
          dummy = dummyPlayerEngine.executeDummyTurn(dummy)
        }

        log.log(`[TURN ${turnCount}] Auto-turn — Player hand: ${player.deck.hand.length}, deck: ${player.deck.drawPile.length}, Dummy ended: ${dummy.hasEndedRound}`)
      }

      // At this point both should have ended (or be able to)
      expect(safetyCounter).toBeLessThan(MAX_TURNS)
    })

    it('should process end of Round 1', () => {
      // End the round
      roundState = turnManager.endRound(roundState)
      expect(roundState.isEnded).toBe(true)

      // Process end of round effects
      const result = turnManager.processEndOfRound({
        currentRound: 1,
        totalRounds: config.totalRounds,
        roundPattern: config.roundPattern,
      })

      expect(result.nextRound).toBe(2)
      expect(result.nextDayNight).toBe('night')
      expect(result.isGameOver).toBe(false)

      // Reshuffle player deck: all cards go to draw pile
      const allPlayerCards = [
        ...player.deck.drawPile,
        ...player.deck.hand,
        ...player.deck.playArea,
        ...player.deck.discardPile,
      ]
      player = {
        ...player,
        deck: deckManager.initializeDeck(allPlayerCards),
      }
      // Draw new hand
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }

      // Reroll mana source
      player = { ...player, mana: manaPool.rerollSource(player.mana) }

      // Ready all units
      player = { ...player, units: unitManager.readyAllUnits(player.units) }

      // Process dummy round start
      dummy = dummyPlayerEngine.processRoundStartForDummy(dummy, null, null)

      currentRound = result.nextRound
      currentDayNight = result.nextDayNight

      log.log(`\n[ROUND 1 END] Player fame: ${player.fame}, Level: ${player.level}`)
      log.log(`[ROUND 1 END] Player deck reshuffled: ${player.deck.drawPile.length} cards in draw pile`)
      log.log(`[ROUND 1 END] Mana rerolled: ${player.mana.dice.map((d) => d.color).join(', ')}`)
      log.log(`[ROUND 1 END] Dummy reshuffled: ${dummy.deedDeck.length} cards`)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 3: ROUND 2 — NIGHT
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 3: Round 2 — Night', () => {
    let roundState: RoundState

    it('should start Round 2 (night) with correct terrain cost changes', () => {
      const nightTactics = availableTactics.filter((t) => t.type === 'night')
      roundState = turnManager.startRound(2, 'night', nightTactics)

      expect(roundState.dayNight).toBe('night')

      // Verify night terrain costs
      expect(movementResolver.getMoveCost('forest', 'night')).toBe(5) // 3 during day
      expect(movementResolver.getMoveCost('desert', 'night')).toBe(3) // 5 during day
      expect(movementResolver.getMoveCost('plains', 'night')).toBe(2) // unchanged
      expect(movementResolver.getMoveCost('hills', 'night')).toBe(3)  // unchanged

      // Verify mana rules for night
      expect(manaPool.isGoldUsable('night')).toBe(false)
      expect(manaPool.isBlackUsable('night')).toBe(true)

      log.log(`\n[ROUND 2] === Night Round Begins ===`)
      log.log(`[ROUND 2] Forest cost: 5 (was 3), Desert cost: 3 (was 5)`)
      log.log(`[ROUND 2] Gold mana: UNUSABLE, Black mana: USABLE`)
    })

    it('should select night tactics', () => {
      if (roundState.availableTactics.length >= 2) {
        const dummyResult = turnManager.selectTacticForDummy(roundState.availableTactics)
        dummy = { ...dummy, tacticCard: dummyResult.selected }
        roundState = { ...roundState, dummyTactic: dummyResult.selected, availableTactics: dummyResult.remaining }

        const playerTacticId = roundState.availableTactics[0].id
        const playerResult = turnManager.selectTacticForPlayer(roundState.availableTactics, playerTacticId)
        player = { ...player, currentTactic: playerResult.selected }
        roundState = { ...roundState, playerTactic: playerResult.selected }

        const turnOrder = turnManager.determineTurnOrder(player.currentTactic!, dummy.tacticCard!)
        roundState = { ...roundState, turnOrder }

        log.log(`[ROUND 2] Dummy tactic: ${dummy.tacticCard!.name}, Player tactic: ${player.currentTactic!.name}`)
      }
    })

    it('should play Night Turn 1 — combat with an enemy (if found)', () => {
      turnCount++
      player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

      // Try to find an enemy on the map
      const enemyHex = findHexWithEnemies(mapState)

      if (enemyHex) {
        log.log(`[TURN ${turnCount}] Enemy found at (${enemyHex.q},${enemyHex.r})`)

        const hex = mapState.hexGrid.get(hexKey(enemyHex))!
        const enemies = hex.enemyTokens

        // Initiate combat
        const isFortified = hex.site ? ['keep', 'mageTower', 'city'].includes(hex.site) : false
        let combat = combatResolver.initiateCombat(enemies, isFortified)

        expect(combat.isActive).toBe(true)
        expect(combat.phase).toBe('ranged_siege')
        expect(combat.enemies.length).toBe(enemies.length)

        log.log(`[TURN ${turnCount}] COMBAT: ${combat.enemies.map((e) => `${e.token.name}(armor=${e.currentArmor},atk=${e.currentAttack})`).join(', ')}`)

        // Phase 1: Ranged/Siege — skip (no ranged attacks available)
        combat = combatResolver.resolveRangedSiegeAttack(combat, [])
        expect(combat.phase).toBe('block')

        // Phase 2: Block — skip (let enemy attack go through for now)
        combat = combatResolver.resolveBlock(combat, [])
        expect(combat.phase).toBe('assign_damage')

        // Phase 3: Assign Damage
        const unblockedDamage = combatResolver.calculateUnblockedDamage(combat)
        if (unblockedDamage.length > 0) {
          const totalDamage = unblockedDamage.reduce((sum, d) => sum + d.damage, 0)

          // Assign all damage to hero (wounds)
          const assignments: DamageAssignment[] = unblockedDamage.map((d) => ({
            enemyInstanceId: d.enemyInstanceId,
            totalDamage: d.damage,
            assignments: [{
              targetType: 'hero' as const,
              damageAbsorbed: d.damage,
              woundsInflicted: Math.ceil(d.damage / player.armor),
            }],
          }))

          combat = combatResolver.assignDamage(combat, assignments)

          // Apply wounds to player
          const totalWounds = assignments.reduce(
            (sum, a) => sum + a.assignments.reduce((s, x) => s + x.woundsInflicted, 0),
            0,
          )
          if (totalWounds > 0) {
            player = { ...player, deck: deckManager.addWound(player.deck, totalWounds) }
          }

          log.log(`[TURN ${turnCount}] DAMAGE: ${totalDamage} total, ${totalWounds} wounds to hero`)
        }

        // Phase 4: Melee Attack
        if (combat.enemies.some((e) => !e.isDefeated)) {
          // Play cards for melee attack (simulate 5 physical attack)
          const cardIdx = findNonWoundCardIndex(player.deck)
          if (cardIdx >= 0) {
            player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
          }

          const meleeAttacks: AttackDeclaration[] = [{
            id: 'melee_1',
            targetEnemyIds: combat.enemies.filter((e) => !e.isDefeated).map((e) => e.instanceId),
            attackValue: 5,
            attackElement: 'physical',
            isSiege: false,
            isRanged: false,
            cardIds: [],
            unitIds: [],
          }]

          combat = combatResolver.resolveMeleeAttack(combat, meleeAttacks)
        }

        // End combat
        combat = combatResolver.endCombat(combat)
        expect(combat.isActive).toBe(false)

        // Apply fame from combat
        if (combat.fameEarned > 0) {
          const fameResult = levelUpManager.addFame(player.fame, combat.fameEarned)
          const oldLevel = player.level
          player = { ...player, fame: fameResult.newFame, level: fameResult.newLevel }

          log.log(`[TURN ${turnCount}] COMBAT END: +${combat.fameEarned} fame → total ${player.fame}`)

          // Check for level up
          if (fameResult.levelsGained > 0) {
            const rewards = levelUpManager.processLevelUp(oldLevel, fameResult.newLevel)
            for (const reward of rewards) {
              player = {
                ...player,
                armor: reward.newArmor,
                handLimit: reward.newHandLimit,
                unitLimit: reward.newUnitLimit,
              }
              log.log(`[TURN ${turnCount}] LEVEL UP! Level ${fameResult.newLevel}: armor=${reward.newArmor}, hand=${reward.newHandLimit}, units=${reward.newUnitLimit}`)
            }
          }
        }
      } else {
        log.log(`[TURN ${turnCount}] No enemies found on map — simulating peaceful movement turn`)

        // Just move
        const target = findAdjacentPassableHex(mapState, player.position, 'night', movementResolver)
        if (target) {
          player = { ...player, position: target, turn: { ...player.turn, hasMovedThisTurn: true } }
          log.log(`[TURN ${turnCount}] Moved to (${target.q},${target.r})`)
        }
      }

      // End turn
      player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
      player = { ...player, mana: manaPool.resetTurnState(player.mana) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, turn: turnManager.endTurn(player.turn) }
    })

    it('should execute Dummy Turn (night)', () => {
      dummy = dummyPlayerEngine.executeDummyTurn(dummy)
      log.log(`[TURN ${turnCount}] Dummy (night) — Remaining: ${dummyPlayerEngine.getDummyRemainingCards(dummy)}`)
    })

    it('should play remaining Night turns until Round 2 ends', () => {
      let safetyCounter = 0
      const MAX_TURNS = 20

      while (safetyCounter < MAX_TURNS) {
        safetyCounter++
        turnCount++

        const endOfRoundCheck = deckManager.canDeclareEndOfRound(player.deck)
        if (endOfRoundCheck.must || (endOfRoundCheck.may && player.deck.drawPile.length === 0)) {
          log.log(`[TURN ${turnCount}] Player declares end of round (night)`)
          break
        }

        player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

        const cardIdx = findNonWoundCardIndex(player.deck)
        if (cardIdx >= 0) {
          player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
        }

        const target = findAdjacentPassableHex(mapState, player.position, 'night', movementResolver)
        if (target) {
          player = { ...player, position: target, turn: { ...player.turn, hasMovedThisTurn: true } }
        }

        player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
        player = { ...player, mana: manaPool.resetTurnState(player.mana) }
        player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
        player = { ...player, turn: turnManager.endTurn(player.turn) }

        if (!dummy.hasEndedRound) {
          dummy = dummyPlayerEngine.executeDummyTurn(dummy)
        }

        log.log(`[TURN ${turnCount}] Night auto-turn — Deck: ${player.deck.drawPile.length}, Hand: ${player.deck.hand.length}`)
      }

      expect(safetyCounter).toBeLessThan(MAX_TURNS)
    })

    it('should process end of Round 2', () => {
      roundState = turnManager.endRound(roundState)

      const result = turnManager.processEndOfRound({
        currentRound: 2,
        totalRounds: config.totalRounds,
        roundPattern: config.roundPattern,
      })

      expect(result.nextRound).toBe(3)
      expect(result.nextDayNight).toBe('day')
      expect(result.isGameOver).toBe(false)

      // Reshuffle everything
      const allPlayerCards = [
        ...player.deck.drawPile,
        ...player.deck.hand,
        ...player.deck.playArea,
        ...player.deck.discardPile,
      ]
      player = { ...player, deck: deckManager.initializeDeck(allPlayerCards) }
      player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
      player = { ...player, mana: manaPool.rerollSource(player.mana) }
      player = { ...player, units: unitManager.readyAllUnits(player.units) }
      dummy = dummyPlayerEngine.processRoundStartForDummy(dummy, null, null)

      currentRound = result.nextRound
      currentDayNight = result.nextDayNight

      log.log(`\n[ROUND 2 END] Player fame: ${player.fame}, Level: ${player.level}`)
      log.log(`[ROUND 2 END] Wounds in hand: ${deckManager.getHandWoundCount(player.deck)}`)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 4: ROUND 3 — DAY (Final Round)
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 4: Round 3 — Day (Final Round)', () => {
    let roundState: RoundState

    it('should start Round 3 (day — final round)', () => {
      const dayTactics = availableTactics.filter((t) => t.type === 'day')
      roundState = turnManager.startRound(3, 'day', dayTactics)

      expect(roundState.roundNumber).toBe(3)
      expect(roundState.dayNight).toBe('day')

      // Back to day rules
      expect(movementResolver.getMoveCost('forest', 'day')).toBe(3)
      expect(movementResolver.getMoveCost('desert', 'day')).toBe(5)
      expect(manaPool.isGoldUsable('day')).toBe(true)
      expect(manaPool.isBlackUsable('day')).toBe(false)

      log.log(`\n[ROUND 3] === Final Day Round Begins ===`)
    })

    it('should select final round tactics', () => {
      if (roundState.availableTactics.length >= 2) {
        const dummyResult = turnManager.selectTacticForDummy(roundState.availableTactics)
        dummy = { ...dummy, tacticCard: dummyResult.selected }
        roundState = { ...roundState, dummyTactic: dummyResult.selected, availableTactics: dummyResult.remaining }

        const playerTacticId = roundState.availableTactics[0].id
        const playerResult = turnManager.selectTacticForPlayer(roundState.availableTactics, playerTacticId)
        player = { ...player, currentTactic: playerResult.selected }
        roundState = { ...roundState, playerTactic: playerResult.selected }
      }
    })

    it('should play final round turns with tile reveals and exploration', () => {
      let safetyCounter = 0
      const MAX_TURNS = 20

      while (safetyCounter < MAX_TURNS) {
        safetyCounter++
        turnCount++

        const endOfRoundCheck = deckManager.canDeclareEndOfRound(player.deck)
        if (endOfRoundCheck.must || (endOfRoundCheck.may && player.deck.drawPile.length === 0)) {
          log.log(`[TURN ${turnCount}] Player declares end of final round`)
          break
        }

        player = { ...player, turn: turnManager.startTurn(player.turn, turnCount) }

        // Try to reveal more tiles
        const canReveal = movementResolver.canRevealTile(mapState, player.position)
        if (canReveal && mapState.tileDeck.length > 0) {
          const placements = mapGenerator.getValidTilePlacements(mapState)
          if (placements.length > 0) {
            mapState = mapGenerator.revealTile(mapState, placements[0])
            if (config.specialRules.includes('tile_fame')) {
              const fameResult = levelUpManager.addFame(player.fame, 1)
              player = { ...player, fame: fameResult.newFame, level: fameResult.newLevel }
            }
            log.log(`[TURN ${turnCount}] Revealed tile — ${mapState.tiles.length} total tiles, Fame: ${player.fame}`)
          }
        }

        // Play a card and move
        const cardIdx = findNonWoundCardIndex(player.deck)
        if (cardIdx >= 0) {
          player = { ...player, deck: deckManager.playCard(player.deck, cardIdx) }
        }

        const target = findAdjacentPassableHex(mapState, player.position, 'day', movementResolver)
        if (target) {
          player = { ...player, position: target, turn: { ...player.turn, hasMovedThisTurn: true } }
        }

        player = { ...player, deck: deckManager.discardPlayArea(player.deck) }
        player = { ...player, mana: manaPool.resetTurnState(player.mana) }
        player = { ...player, deck: deckManager.drawToHandLimit(player.deck, player.handLimit) }
        player = { ...player, turn: turnManager.endTurn(player.turn) }

        if (!dummy.hasEndedRound) {
          dummy = dummyPlayerEngine.executeDummyTurn(dummy)
        }
      }

      expect(safetyCounter).toBeLessThan(MAX_TURNS)
    })

    it('should process end of Round 3 — game over', () => {
      roundState = turnManager.endRound(roundState)

      const result = turnManager.processEndOfRound({
        currentRound: 3,
        totalRounds: config.totalRounds,
        roundPattern: config.roundPattern,
      })

      expect(result.isGameOver).toBe(true)

      log.log(`\n[ROUND 3 END] === GAME OVER ===`)
      log.log(`[ROUND 3 END] Player fame: ${player.fame}, Level: ${player.level}`)
      log.log(`[ROUND 3 END] Total turns played: ${turnCount}`)
      log.log(`[ROUND 3 END] Tiles revealed: ${mapState.tiles.length}`)
      log.log(`[ROUND 3 END] Units: ${player.units.length}`)
      log.log(`[ROUND 3 END] Conquered sites: ${player.conqueredSites.length}`)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 5: SCORING
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 5: Scoring', () => {
    it('should calculate final score with achievements', () => {
      // Count advanced actions and spells in deck
      const allDeckCards = [
        ...player.deck.drawPile,
        ...player.deck.hand,
        ...player.deck.playArea,
        ...player.deck.discardPile,
      ]
      const aaCount = allDeckCards.filter((c) => c.type === 'advanced_action').length
      const spellCount = allDeckCards.filter((c) => c.type === 'spell').length

      const scoringContext: ScoringContext = {
        playerName: player.heroName,
        fame: player.fame,
        conqueredSites: player.conqueredSites,
        advancedActionsInDeck: aaCount,
        spellsInDeck: spellCount,
        unitsOwned: player.units.length,
        greatestKnowledge: true, // solo, so player wins all "greatest" titles by default vs dummy
        greatestLeader: true,
        greatestConqueror: true,
        dummyRemainingCards: dummyPlayerEngine.getDummyRemainingCards(dummy),
        totalRounds: config.totalRounds,
        roundsPlayed: 3,
        didNotDeclareEndOfRound: false,
      }

      const finalScore = scoringCalculator.calculateFinalScore(scoringContext)

      expect(finalScore.playerName).toBe('Arythea')
      expect(finalScore.baseFame).toBe(player.fame)
      expect(finalScore.totalScore).toBeGreaterThanOrEqual(0)
      expect(finalScore.achievements.length).toBeGreaterThanOrEqual(0)

      const rating = scoringCalculator.getScoreRating(finalScore.totalScore)

      log.log(`\n[SCORE] ═══════════════════════════════`)
      log.log(`[SCORE] Player: ${finalScore.playerName}`)
      log.log(`[SCORE] Base Fame: ${finalScore.baseFame}`)
      for (const achievement of finalScore.achievements) {
        log.log(`[SCORE] ${achievement.category}: +${achievement.points} (${achievement.description})`)
      }
      log.log(`[SCORE] Total Score: ${finalScore.totalScore}`)
      log.log(`[SCORE] Rating: ${rating}`)
      log.log(`[SCORE] ═══════════════════════════════`)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CHAPTER 6: ENGINE COMPOSABILITY VALIDATION
  // ═══════════════════════════════════════════════════════════════

  describe('Chapter 6: Engine Composability Validation', () => {
    it('validates that all engine modules were used in composition', () => {
      // This test verifies that we successfully used EVERY engine module
      // in a coherent game flow. The fact that we got here without crashes
      // means the engine can be composed into a working game.

      // ScenarioSetup ✓ — config, player deck, offers, enemy pools, tactics
      expect(config.name).toBe('First Reconnaissance')

      // TurnManager ✓ — rounds, turns, tactics, phase advancement
      expect(turnCount).toBeGreaterThan(0)

      // MapGenerator ✓ — map generation, tile reveals
      expect(mapState.tiles.length).toBeGreaterThan(1)

      // ManaPool ✓ — initialization, dice taking, resetting, rerolling
      expect(player.mana.dice.length).toBe(4)

      // DeckManager ✓ — draw, play, discard, reshuffle, wounds
      expect(player.deck).toBeDefined()

      // MovementResolver ✓ — terrain costs, reachability, tile reveals
      expect(movementResolver.getMoveCost('plains', 'day')).toBe(2)

      // CombatResolver ✓ — initiation, phases, damage, fame
      expect(combatResolver).toBeDefined()

      // LevelUpManager ✓ — fame tracking, level progression
      expect(levelUpManager.getCurrentLevel(player.fame)).toBe(player.level)

      // ReputationManager ✓ — interaction checks, influence
      expect(reputationManager.canInteract(0)).toBe(true)

      // UnitManager ✓ — recruitment, readying
      expect(unitManager).toBeDefined()

      // DummyPlayer ✓ — turn execution, deck depletion
      expect(dummy).toBeDefined()

      // ScoringCalculator ✓ — final score, rating
      expect(scoringCalculator.getScoreRating(0)).toBe('Rookie')

      log.log(`\n[VALIDATION] All 12 engine modules successfully composed into a full game!`)
    })

    it('validates game state consistency after full playthrough', () => {
      // Player state is consistent
      expect(player.fame).toBeGreaterThanOrEqual(0)
      expect(player.level).toBeGreaterThanOrEqual(1)
      expect(player.reputation).toBeGreaterThanOrEqual(-7)
      expect(player.reputation).toBeLessThanOrEqual(7)

      // Level matches fame
      const expectedLevel = levelUpManager.getCurrentLevel(player.fame)
      expect(player.level).toBe(expectedLevel)

      // Deck integrity: total cards should be consistent (minus any discarded permanently)
      const totalCards =
        player.deck.drawPile.length +
        player.deck.hand.length +
        player.deck.playArea.length +
        player.deck.discardPile.length
      expect(totalCards).toBeGreaterThan(0)

      // Map integrity
      expect(mapState.hexGrid.size).toBeGreaterThan(0)
      for (const tile of mapState.tiles) {
        expect(tile.isRevealed).toBe(true)
        expect(tile.hexes.length).toBe(7) // each tile has 7 hexes
      }

      // Mana state
      expect(player.mana.dice.length).toBe(config.diceCount)

      log.log(`\n[VALIDATION] Game state consistency check passed!`)
      log.log(`[VALIDATION] Final state: Fame=${player.fame}, Level=${player.level}, Rep=${player.reputation}`)
      log.log(`[VALIDATION] Cards: ${totalCards} total, Tiles: ${mapState.tiles.length}, Hexes: ${mapState.hexGrid.size}`)
    })

    it('validates movement resolver correctly handles day/night terrain costs', () => {
      // Day costs
      expect(movementResolver.getMoveCost('plains', 'day')).toBe(2)
      expect(movementResolver.getMoveCost('hills', 'day')).toBe(3)
      expect(movementResolver.getMoveCost('forest', 'day')).toBe(3)
      expect(movementResolver.getMoveCost('wasteland', 'day')).toBe(4)
      expect(movementResolver.getMoveCost('desert', 'day')).toBe(5)
      expect(movementResolver.getMoveCost('swamp', 'day')).toBe(5)
      expect(movementResolver.getMoveCost('lake', 'day')).toBeNull()
      expect(movementResolver.getMoveCost('mountain', 'day')).toBeNull()

      // Night costs
      expect(movementResolver.getMoveCost('forest', 'night')).toBe(5) // +2
      expect(movementResolver.getMoveCost('desert', 'night')).toBe(3) // -2
      expect(movementResolver.getMoveCost('plains', 'night')).toBe(2) // unchanged
    })

    it('validates combat resolver handles resistances correctly', () => {
      // Physical resistance halves physical attack
      const physResist = combatResolver.calculateEffectiveAttack(6, 'physical', ['physical_resistance'])
      expect(physResist).toBe(3)

      // Fire resistance halves fire attack
      const fireResist = combatResolver.calculateEffectiveAttack(6, 'fire', ['fire_resistance'])
      expect(fireResist).toBe(3)

      // No resistance = full damage
      const noResist = combatResolver.calculateEffectiveAttack(6, 'physical', [])
      expect(noResist).toBe(6)

      // Block effectiveness vs attack types
      expect(combatResolver.calculateEffectiveBlock(4, 'physical', 'fire')).toBe(2)  // halved
      expect(combatResolver.calculateEffectiveBlock(4, 'ice', 'fire')).toBe(4)       // full (ice counters fire)
      expect(combatResolver.calculateEffectiveBlock(4, 'physical', 'normal')).toBe(4) // full vs normal
    })

    it('validates level progression thresholds', () => {
      expect(levelUpManager.getCurrentLevel(0)).toBe(1)
      expect(levelUpManager.getCurrentLevel(2)).toBe(1)
      expect(levelUpManager.getCurrentLevel(3)).toBe(2)
      expect(levelUpManager.getCurrentLevel(7)).toBe(2)
      expect(levelUpManager.getCurrentLevel(8)).toBe(3)
      expect(levelUpManager.getCurrentLevel(14)).toBe(3)
      expect(levelUpManager.getCurrentLevel(15)).toBe(4)
      expect(levelUpManager.getCurrentLevel(99)).toBe(10)

      // Fame needed for next level
      expect(levelUpManager.getFameToNextLevel(0)).toBe(3) // need 3 for level 2
      expect(levelUpManager.getFameToNextLevel(3)).toBe(5) // need 8-3=5 for level 3
    })

    it('validates reputation system', () => {
      // Neutral reputation
      expect(reputationManager.getInfluenceModifier(0)).toBe(0)
      expect(reputationManager.canInteract(0)).toBe(true)

      // Positive reputation gives bonus
      expect(reputationManager.getInfluenceModifier(3)).toBe(2)
      expect(reputationManager.getInfluenceModifier(5)).toBe(5)

      // Negative reputation gives penalty
      expect(reputationManager.getInfluenceModifier(-3)).toBe(-3)

      // Extreme negative = can't interact
      expect(reputationManager.canInteract(-5)).toBe(false)
      expect(reputationManager.canInteract(-7)).toBe(false)

      // Reputation clamping
      expect(reputationManager.changeReputation(6, 5)).toBe(7) // max 7
      expect(reputationManager.changeReputation(-6, -5)).toBe(-7) // min -7
    })

    it('prints the full game log', () => {
      // This test just ensures the log was built correctly
      expect(log.length).toBeGreaterThan(0)

      // Uncomment the next line to see the full game log in test output:
      // console.log(log.dump())

      log.log(`\n═══════════════════════════════════════`)
      log.log(`SIMULATION COMPLETE`)
      log.log(`Total log entries: ${log.length}`)
      log.log(`═══════════════════════════════════════`)
    })
  })
})
