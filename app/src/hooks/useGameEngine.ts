import { useCallback } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useUndo } from '@/hooks/useUndo'
import { SeededRandom, generateSeed } from '@/utils/random'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import type { ScenarioConfig } from '@/engine/ScenarioSetup'
import { TurnManager } from '@/engine/TurnManager'
import type { PhaseContext } from '@/engine/TurnManager'
import { DeckManager } from '@/engine/DeckManager'
import { ManaPool } from '@/engine/ManaPool'
import { MapGenerator } from '@/engine/MapGenerator'
import { MovementResolver } from '@/engine/MovementResolver'
import { CombatResolver } from '@/engine/CombatResolver'
import { UnitManager } from '@/engine/UnitManager'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { DummyPlayer } from '@/engine/DummyPlayer'
import { ReputationManager } from '@/engine/ReputationManager'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import { CardEffectResolver, selectEffectActions, parseColorSpec } from '@/engine/CardEffectResolver'
import { TacticEffectManager } from '@/engine/TacticEffectManager'
import { InteractionManager } from '@/engine/InteractionManager'
import { SkillManager } from '@/engine/SkillManager'
import type { GameState, GameLogEntry } from '@/engine/GameState'
import { INITIAL_COMBAT_STATE, hexKey } from '@/engine/GameState'
import type {
  HexCoord,
  ManaColor,
  EnemyToken,
  GamePhase,
  CityColor,
  RestType,
  TacticCard,
  FinalScore,
  AnyUnit,
  InteractionSiteType,
  SiteType,
  OfferState,
  HeroSkill,
  PendingLevelUp,
  PendingReward,
  ArtifactCard,
  HexCell,
} from '@/engine/types'
import {
  getBasicActions,
  getAdvancedActions,
  getSpells,
  getArtifacts,
  getRegularUnits,
  getEliteUnits,
  getEnemies,
  getTactics,
  getSites,
  getHeroSkills,
  PLAYABLE_HEROES,
} from '@/data/loader'
import type { TacticCardData } from '@/data/loader'
import { createChapterState } from '@/engine/TutorialScenario'
import { hexNeighbors } from '@/utils/hexMath'

// ── Engine Refs ──────────────────────────────
export interface EngineRefs {
  random: SeededRandom
  scenarioSetup: ScenarioSetup
  turnManager: TurnManager
  deckManager: DeckManager
  manaPool: ManaPool
  mapGenerator: MapGenerator
  movementResolver: MovementResolver
  combatResolver: CombatResolver
  unitManager: UnitManager
  levelUpManager: LevelUpManager
  dummyPlayer: DummyPlayer
  reputationManager: ReputationManager
  scoringCalculator: ScoringCalculator
  cardEffectResolver: CardEffectResolver
  tacticEffectManager: TacticEffectManager
  interactionManager: InteractionManager
  skillManager: SkillManager
  config: ScenarioConfig
}

// ── Module-level singletons (shared across all useGameEngine instances) ──
export let sharedEngine: EngineRefs | null = null
let sharedState: GameState | null = null

/** Reset both singletons (e.g. when returning to main menu) */
export function resetEngine(): void {
  sharedEngine = null
  sharedState = null
}

/** Allow useCombat (and other external hooks) to update sharedState without going through useGameEngine */
export function setSharedState(state: GameState): void {
  sharedState = state
}

// ── Tactic data -> TacticCard converter ───────
function toTacticCard(data: TacticCardData): TacticCard {
  return {
    id: data.id,
    name: data.name,
    type: data.type,
    number: data.number,
    effect: data.effect,
    isUsed: false,
  }
}

// ── Fame gain + level-up queueing (UNIT-10) ──
// Applies fame, immediately applies stat changes for every level crossed and
// queues a PendingLevelUp per level so the UI can resolve rewards one by one.
// (exported for unit tests)
export function applyFameGain(engine: EngineRefs, state: GameState, amount: number): GameState {
  if (amount === 0) return state
  const fameResult = engine.levelUpManager.addFame(state.player.fame, amount)
  let newState: GameState = {
    ...state,
    player: { ...state.player, fame: fameResult.newFame },
  }
  if (fameResult.levelsGained <= 0) return newState

  const rewards = engine.levelUpManager.processLevelUp(state.player.level, fameResult.newLevel)
  let newArmor = state.player.armor
  let newHandLimit = state.player.handLimit
  let newUnitLimit = state.player.unitLimit
  const queued: PendingLevelUp[] = [...(state.pendingLevelUps ?? [])]
  const skillDeck = state.player.skillDeck ?? []
  // Reveals from consecutive level-ups must not overlap (EC-10-A-1)
  let skillRevealOffset = queued.filter((p) => p.rewardType === 'advanced_action_and_skill').length * 2
  let level = state.player.level

  for (const reward of rewards) {
    level += 1
    newArmor = reward.newArmor
    newHandLimit = reward.newHandLimit
    newUnitLimit = reward.newUnitLimit
    const revealedSkills =
      reward.type === 'advanced_action_and_skill'
        ? skillDeck.slice(skillRevealOffset, skillRevealOffset + 2)
        : []
    if (reward.type === 'advanced_action_and_skill') skillRevealOffset += 2
    queued.push({
      level,
      rewardType: reward.type,
      newArmor: reward.newArmor,
      newHandLimit: reward.newHandLimit,
      newUnitLimit: reward.newUnitLimit,
      revealedSkills,
    })
  }

  // Bonds of Loyalty etc.: passive command bonuses stack on top of the
  // level-table unit limit (which is absolute) so they survive level-ups
  const commandBonus = state.player.skills.reduce(
    (sum, sk) =>
      sum +
      sk.actions.reduce(
        (s2, a) =>
          s2 + (a.type === 'passive_command_bonus' && typeof a.extraCommand === 'number' ? a.extraCommand : 0),
        0,
      ),
    0,
  )

  return {
    ...newState,
    player: {
      ...newState.player,
      level: fameResult.newLevel,
      armor: newArmor,
      handLimit: newHandLimit,
      unitLimit: newUnitLimit + commandBonus,
    },
    pendingLevelUps: queued,
  }
}

// ── Keep / City hand-limit bonus (rulebook p.9) ──────────
// If you are on or next to a keep you own, your Hand limit is increased by the
// number of keeps you own. On/next to a conquered city you hold → +2 (solo
// player is always the city leader). (exported for unit tests)
export function keepCityHandLimitBonus(state: GameState): number {
  const pos = state.player.position
  const near = new Set<string>([hexKey(pos), ...hexNeighbors(pos).map(hexKey)])
  const keeps = state.player.conqueredSites.filter((s) => s.siteType === 'keep')
  let bonus = keeps.some((s) => near.has(hexKey(s.hexCoord))) ? keeps.length : 0
  const cities = state.player.conqueredSites.filter((s) => s.siteType === 'city')
  if (cities.some((s) => near.has(hexKey(s.hexCoord)))) bonus += 2
  // Mountain Lore: +1 in hills (basic/strong); strong also gives +2 in mountains.
  if (state.player.turn.mountainLore) {
    const terrain = state.map.hexGrid.get(hexKey(pos))?.terrain
    if (terrain === 'hills') bonus += 1
    else if (terrain === 'mountain' && state.player.turn.mountainLore === 'strong') bonus += 2
  }
  return bonus
}

// ── Combat site rewards (UNIT-07-G) ──────────
// (exported for unit tests)
export function buildSiteRewards(
  engine: EngineRefs,
  siteType: SiteType | undefined,
  artifactDeck: ArtifactCard[],
): { rewards: PendingReward[]; artifactsConsumed: number } {
  const rewards: PendingReward[] = []
  let consumed = 0

  const drawArtifactChoice = () => {
    // EC-07-G-1: draw quantity+1, keep quantity, return the rest to the bottom
    const options = artifactDeck.slice(consumed, consumed + 2)
    consumed += options.length
    if (options.length > 0) rewards.push({ type: 'artifact_choice', options, pickCount: Math.min(1, options.length) })
  }
  const rollCrystal = () => {
    const rolled = engine.manaPool.rollDie()
    rewards.push({ type: 'crystal_roll', rolledColor: rolled as ManaColor | 'gold' | 'black' })
  }

  switch (siteType) {
    case 'mageTower':
      // Rulebook (Combat Outcomes): conquering a mage tower lets you choose a Spell.
      rewards.push({ type: 'spell_choice' })
      break
    case 'monastery':
      // Rulebook: burning a monastery (defeating its defenders) yields an Artifact.
      drawArtifactChoice()
      break
    case 'dungeon':
      drawArtifactChoice()
      break
    case 'tomb':
      drawArtifactChoice()
      rewards.push({ type: 'spell_choice' })
      break
    case 'ancientRuins':
      rewards.push({ type: 'artifact_or_spell' })
      break
    case 'monsterDen':
      // Gain 2 mana crystals (roll the die twice)
      rollCrystal()
      rollCrystal()
      break
    case 'spawningGrounds':
      // Gain 1 Artifact and 3 mana crystals
      drawArtifactChoice()
      rollCrystal()
      rollCrystal()
      rollCrystal()
      break
    default:
      break
  }

  return { rewards, artifactsConsumed: consumed }
}

// ── Rampaging enemies (UNIT-05-B) ────────────
// Enemy tokens sitting on a hex with no site (e.g. orcs/draconum) are rampaging.
// (exported for unit tests)
export function isRampagingHex(hex: HexCell | undefined): boolean {
  if (!hex) return false
  return hex.enemyTokens.length > 0 && !hex.siteData
}

// ── Log entry factory ────────────────────────
function createLogEntry(
  state: GameState,
  type: GameLogEntry['type'],
  message: string,
  data?: Record<string, unknown>,
): GameLogEntry {
  return {
    timestamp: Date.now(),
    round: state.round,
    turn: state.turnCount,
    type,
    message,
    data,
  }
}

// ── Hook ─────────────────────────────────────
export function useGameEngine() {
  const setEngineState = useGameStore((s) => s.setEngineState)
  const syncFromEngine = useGameStore((s) => s.syncFromEngine)
  const engineState = useGameStore((s) => s.engineState)

  const { pushState, undo, canUndo, clearStack: clearUndoStack } = useUndo()

  // ── Private: persist state to both singleton and stores ──
  const updateState = useCallback(
    (newState: GameState) => {
      sharedState = newState
      setEngineState(newState)
      syncFromEngine(newState)
      // QA/E2E: expose state when ?debug is present (read-only inspection)
      if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
        ;(window as unknown as Record<string, unknown>).__MK_STATE__ = newState
      }
    },
    [setEngineState, syncFromEngine],
  )

  // ── Private: append log and persist ──
  const withLog = useCallback(
    (
      state: GameState,
      type: GameLogEntry['type'],
      message: string,
      data?: Record<string, unknown>,
    ): GameState => {
      const entry = createLogEntry(state, type, message, data)
      return { ...state, log: [...state.log, entry] }
    },
    [],
  )

  // ════════════════════════════════════════════
  //  GAME INITIALIZATION
  // ════════════════════════════════════════════
  const initializeGame = useCallback((heroName: string = 'Arythea') => {
    // Deterministic seed via ?seed= for QA/E2E reproducibility
    const urlSeed =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('seed')
        : null
    const seed = urlSeed && !Number.isNaN(Number(urlSeed)) ? Number(urlSeed) : generateSeed()
    const random = new SeededRandom(seed)

    // Create engine instances
    const scenarioSetup = new ScenarioSetup(random)
    const turnManager = new TurnManager(random)
    const deckManager = new DeckManager(random)
    const manaPool = new ManaPool(random)
    const mapGenerator = new MapGenerator(random)
    const movementResolver = new MovementResolver()
    const combatResolver = new CombatResolver(random)
    const unitManager = new UnitManager()
    const levelUpManager = new LevelUpManager()
    const dummyPlayer = new DummyPlayer(random)
    const reputationManager = new ReputationManager()
    const scoringCalculator = new ScoringCalculator()
    const cardEffectResolver = new CardEffectResolver()
    const tacticEffectManager = new TacticEffectManager(random)
    const interactionManager = new InteractionManager()
    const skillManager = new SkillManager()
    const config = scenarioSetup.setupFirstReconnaissance()

    sharedEngine = {
      random,
      scenarioSetup,
      turnManager,
      deckManager,
      manaPool,
      mapGenerator,
      movementResolver,
      combatResolver,
      unitManager,
      levelUpManager,
      dummyPlayer,
      reputationManager,
      scoringCalculator,
      cardEffectResolver,
      tacticEffectManager,
      interactionManager,
      skillManager,
      config,
    }

    // Load data
    const basicActions = getBasicActions()
    const advancedActions = getAdvancedActions()
    const spells = getSpells()
    const artifacts = getArtifacts()
    const regularUnits = getRegularUnits()
    const eliteUnits = getEliteUnits()
    const enemies = getEnemies()
    const tacticsRaw = getTactics()

    // Player deck — hero-specific cards merged with common cards
    const allBasicCards = basicActions.commonCards.concat(basicActions.heroSpecificCards)
    const playerDeck = scenarioSetup.setupPlayerDeck(heroName, allBasicCards)

    // Player state
    const playerState = scenarioSetup.getInitialPlayerState(
      heroName,
      playerDeck,
      { q: 0, r: 0 },
    )

    // Skill deck — shuffled, interactive skills removed in solo (EC-12-A-2)
    const skillDeck: HeroSkill[] = random.shuffle(
      getHeroSkills(heroName)
        .filter((s) => !s.type.startsWith('interactive'))
        .map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type as HeroSkill['type'],
          effect: s.effect,
          actions: s.actions,
          isFlipped: false,
          isUsedThisTurn: false,
        })),
    )

    // Dummy player — solo rule: randomly pick a hero NOT in the game as the
    // Dummy. Its skills are revealed into the Common Skills pool on the player's
    // level-ups (so choice B can use them). Exclude the player's chosen hero.
    const dummyName = random.pick(PLAYABLE_HEROES.filter((h) => h !== heroName))
    const dummyState = {
      ...scenarioSetup.getInitialDummyState(dummyName, basicActions.commonCards),
      // EC-09-A-3: dummy skill deck — revealed into Common Skills on player level-ups
      skillDeck: random.shuffle(
        getHeroSkills(dummyName)
          .filter((s) => !s.type.startsWith('interactive'))
          .map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type as HeroSkill['type'],
            effect: s.effect,
            actions: s.actions,
            isFlipped: false,
            isUsedThisTurn: false,
          })),
      ),
    }

    // Offers
    const offers = scenarioSetup.setupOffers(
      config,
      advancedActions,
      spells,
      regularUnits,
      eliteUnits,
      artifacts,
    )

    // Enemy pools
    const enemyPools = scenarioSetup.setupEnemyPools(enemies)

    // Map
    let map = mapGenerator.generateMap(config.mapConfig)

    // Assign enemies to sites on initial revealed tiles
    const sitesData = getSites()
    const newHexGrid = new Map(map.hexGrid)

    for (const [key, hex] of map.hexGrid.entries()) {
      if (hex.site && hex.siteData && hex.isRevealed) {
        // Find site data for this site type
        const siteInfo = sitesData.find((s) => s.type === hex.site)
        if (siteInfo && siteInfo.enemyColor && siteInfo.enemyColor !== 'null' && siteInfo.enemyColor !== 'special' && siteInfo.enemyColor !== 'multiple') {
          const color = siteInfo.enemyColor as 'green' | 'grey' | 'violet' | 'brown' | 'red' | 'white'

          // Draw the site's enemies from the pool (Spawning Grounds = 2, else 1)
          const count = siteInfo.enemyCount ?? 1
          const drawn = enemyPools[color].slice(0, count)
          if (drawn.length > 0) {
            enemyPools[color] = enemyPools[color].slice(drawn.length)

            // Update hex with enemies
            const updatedHex: typeof hex = {
              ...hex,
              enemyTokens: drawn,
            }
            newHexGrid.set(key, updatedHex)
          }
        }
      }
    }

    map = {
      ...map,
      hexGrid: newHexGrid,
    }

    // Mana source
    const manaState = manaPool.initializeSource(config.diceCount)

    // Tactics
    const dayTactics = tacticsRaw.dayTactics.map(toTacticCard)
    const nightTactics = tacticsRaw.nightTactics.map(toTacticCard)
    const allTactics = [...dayTactics, ...nightTactics]

    // Draw initial hand
    const deckAfterDraw = deckManager.drawToHandLimit(
      playerState.deck,
      playerState.handLimit,
    )

    // Build complete GameState
    let gameState: GameState = {
      phase: 'setup',
      round: 1,
      totalRounds: config.totalRounds,
      dayNight: config.roundPattern[0],
      roundPattern: config.roundPattern,

      player: {
        ...playerState,
        deck: deckAfterDraw,
        mana: manaState,
        skillDeck,
      },
      dummyPlayer: dummyState,

      map,
      offers,
      combat: { ...INITIAL_COMBAT_STATE },
      interaction: null,

      availableTactics: allTactics,
      usedTactics: [],
      enemyPools,

      seed,
      turnCount: 0,
      isGameOver: false,
      finalScore: null,

      pendingLevelUps: [],
      pendingRewards: [],
      finalTurnPending: false,
      finalTurnUsed: false,

      log: [],
    }

    // Add game start log
    gameState = withLog(gameState, 'game_start', 'Game initialized — First Reconnaissance scenario', {
      hero: 'Arythea',
      seed,
    })

    // Advance from 'setup' to 'round_start'
    const nextPhase = turnManager.advancePhase('setup', {})
    gameState = { ...gameState, phase: nextPhase }
    gameState = withLog(gameState, 'round_start', `Round ${gameState.round} begins — ${gameState.dayNight}`)

    updateState(gameState)
  }, [updateState, withLog])

  // ════════════════════════════════════════════
  //  RESTORE FROM SAVE
  // ════════════════════════════════════════════
  /**
   * Rebuild the engine singletons around a loaded GameState.
   * The RNG restarts from the original seed (its draw position isn't part of
   * the save), so post-load shuffles differ from an uninterrupted session —
   * still seed-stable for the loaded state itself.
   */
  const restoreGame = useCallback((state: GameState) => {
    const random = new SeededRandom(state.seed)
    const scenarioSetup = new ScenarioSetup(random)
    const deckManager = new DeckManager(random)

    // Keep wound ids unique across the load boundary
    let maxWound = 0
    const scanWounds = (cards: import('@/engine/types').AnyCard[]) => {
      for (const c of cards) {
        if (c.type === 'wound') {
          const n = Number(/wound_(\d+)/.exec(String(c.id))?.[1] ?? 0)
          if (n > maxWound) maxWound = n
        }
      }
    }
    scanWounds(state.player.deck.drawPile)
    scanWounds(state.player.deck.hand)
    scanWounds(state.player.deck.playArea)
    scanWounds(state.player.deck.discardPile)
    deckManager.setWoundCounter(maxWound + 1)

    sharedEngine = {
      random,
      scenarioSetup,
      turnManager: new TurnManager(random),
      deckManager,
      manaPool: new ManaPool(random),
      mapGenerator: new MapGenerator(random),
      movementResolver: new MovementResolver(),
      combatResolver: new CombatResolver(random),
      unitManager: new UnitManager(),
      levelUpManager: new LevelUpManager(),
      dummyPlayer: new DummyPlayer(random),
      reputationManager: new ReputationManager(),
      scoringCalculator: new ScoringCalculator(),
      cardEffectResolver: new CardEffectResolver(),
      tacticEffectManager: new TacticEffectManager(random),
      interactionManager: new InteractionManager(),
      skillManager: new SkillManager(),
      config: scenarioSetup.setupFirstReconnaissance(),
    }

    clearUndoStack()
    const newState = withLog(state, 'game_start', 'Game restored from save')
    updateState(newState)
  }, [updateState, withLog, clearUndoStack])

  // ════════════════════════════════════════════
  //  TUTORIAL INITIALIZATION
  // ════════════════════════════════════════════
  const initializeTutorial = useCallback((chapter: number = 1) => {
    const seed = 12345
    const random = new SeededRandom(seed)
    const scenarioSetup = new ScenarioSetup(random)
    const turnManager = new TurnManager(random)
    const deckManager = new DeckManager(random)
    const manaPool = new ManaPool(random)
    const mapGenerator = new MapGenerator(random)
    const movementResolver = new MovementResolver()
    const combatResolver = new CombatResolver(random)
    const unitManager = new UnitManager()
    const levelUpManager = new LevelUpManager()
    const dummyPlayerEngine = new DummyPlayer(random)
    const reputationManager = new ReputationManager()
    const scoringCalculator = new ScoringCalculator()
    const config = scenarioSetup.setupFirstReconnaissance()
    const cardEffectResolver = new CardEffectResolver()
    const tacticEffectManager = new TacticEffectManager(random)
    const interactionManager = new InteractionManager()
    const skillManager = new SkillManager()

    sharedEngine = {
      random,
      scenarioSetup,
      turnManager,
      deckManager,
      manaPool,
      mapGenerator,
      movementResolver,
      combatResolver,
      unitManager,
      levelUpManager,
      dummyPlayer: dummyPlayerEngine,
      reputationManager,
      scoringCalculator,
      cardEffectResolver,
      tacticEffectManager,
      interactionManager,
      skillManager,
      config,
    }

    const tutorialState: GameState = createChapterState(chapter)
    updateState(tutorialState)
  }, [updateState])

  // ════════════════════════════════════════════
  //  PHASE TRANSITIONS
  // ════════════════════════════════════════════
  const advancePhase = useCallback(
    (context?: PhaseContext) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      const ctx = context ?? {}
      const nextPhase = engine.turnManager.advancePhase(state.phase, ctx)
      const newState: GameState = { ...state, phase: nextPhase }
      updateState(newState)
    },
    [updateState],
  )

  // ════════════════════════════════════════════
  //  TURN ACTIONS
  // ════════════════════════════════════════════
  const startTurn = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    const newTurnCount = state.turnCount + 1
    const newTurn = {
      ...engine.turnManager.startTurn(state.player.turn, newTurnCount),
      turnStartPosition: { ...state.player.position },
    }
    const freshSkills = engine.skillManager.resetSkillsForTurn(state.player.skills)
    let newState: GameState = {
      ...state,
      turnCount: newTurnCount,
      player: { ...state.player, turn: newTurn, skills: freshSkills },
      phase: 'player_turn_start' as GamePhase,
    }
    newState = withLog(newState, 'turn_start', `Turn ${newTurnCount} begins`)
    updateState(newState)
  }, [updateState, withLog])

  const endTurn = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    clearUndoStack()

    // Rule 14.6: If no cards were played or discarded this turn, must discard 1 non-wound card
    let currentDeck = state.player.deck
    if (
      state.player.turn.cardsPlayedThisTurn.length === 0 &&
      state.player.turn.sidewaysCardsPlayed === 0 &&
      currentDeck.playArea.length === 0
    ) {
      const nonWoundIndex = currentDeck.hand.findIndex((c) => c.type !== 'wound')
      if (nonWoundIndex !== -1) {
        const forcedCard = currentDeck.hand[nonWoundIndex]
        const newHand = [...currentDeck.hand]
        newHand.splice(nonWoundIndex, 1)
        currentDeck = {
          ...currentDeck,
          hand: newHand,
          discardPile: [...currentDeck.discardPile, forcedCard],
        }
      }
    }

    const playerDeclaredEnd = state.player.turn.endOfRoundDeclared
    const hadExtraTurn = state.player.turn.extraTurnGranted === true

    const newTurn = engine.turnManager.endTurn(state.player.turn)
    // Steady Tempo: pull it out of the play area and return it to the deck
    // (bottom for basic, top for strong) before the rest is discarded.
    let deckForEnd = currentDeck
    if (state.player.turn.steadyTempo) {
      const stIdx = deckForEnd.playArea.findIndex((c) => 'name' in c && c.name === 'Steady Tempo')
      if (stIdx !== -1) {
        const st = deckForEnd.playArea[stIdx]
        const playArea = deckForEnd.playArea.filter((_, i) => i !== stIdx)
        deckForEnd = state.player.turn.steadyTempo === 'strong'
          ? { ...deckForEnd, playArea, drawPile: [st, ...deckForEnd.drawPile] }
          : { ...deckForEnd, playArea, drawPile: [...deckForEnd.drawPile, st] }
      }
    }
    const newDeck = engine.deckManager.discardPlayArea(deckForEnd)
    const newMana = engine.manaPool.resetTurnState(state.player.mana)
    const newUnits = state.player.units

    let newState: GameState = {
      ...state,
      player: {
        ...state.player,
        turn: newTurn,
        deck: newDeck,
        mana: newMana,
        units: newUnits,
      },
    }
    newState = withLog(newState, 'turn_end', `Turn ${state.turnCount} ends`)

    // EC-03-D-1: Forced Withdrawal — ending the turn on a hex with surviving
    // enemies is unsafe; retreat to the turn's starting position and take 1 wound.
    const standingHex = newState.map.hexGrid.get(hexKey(newState.player.position))
    const startPos = newState.player.turn.turnStartPosition
    if (
      standingHex &&
      standingHex.enemyTokens.length > 0 &&
      startPos &&
      (startPos.q !== newState.player.position.q || startPos.r !== newState.player.position.r)
    ) {
      newState = {
        ...newState,
        player: {
          ...newState.player,
          position: { ...startPos },
          deck: engine.deckManager.addWound(newState.player.deck, 1),
        },
      }
      newState = withLog(newState, 'wound_gain', 'logmsg.forcedWithdrawal')
    }

    // EC-03-D step 4: site benefits at the final position
    const endHex = newState.map.hexGrid.get(hexKey(newState.player.position))
    if (endHex?.siteData?.type === 'magicalGlade') {
      // EC-03-D-4: throw away 1 wound from hand (preferred) or discard pile
      const handWoundIdx = newState.player.deck.hand.findIndex(c => c.type === 'wound')
      if (handWoundIdx !== -1) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            deck: {
              ...newState.player.deck,
              hand: newState.player.deck.hand.filter((_, i) => i !== handWoundIdx),
            },
          },
        }
        newState = withLog(newState, 'wound_heal', 'logmsg.gladeHealHand')
      } else {
        const discWoundIdx = newState.player.deck.discardPile.findIndex(c => c.type === 'wound')
        if (discWoundIdx !== -1) {
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: {
                ...newState.player.deck,
                discardPile: newState.player.deck.discardPile.filter((_, i) => i !== discWoundIdx),
              },
            },
          }
          newState = withLog(newState, 'wound_heal', 'logmsg.gladeHealDiscard')
        }
      }
    }
    if (endHex?.siteData?.type === 'crystalMine' && endHex.siteData.mineColor) {
      // EC-01-E-3: mine yields nothing when that color is already at 3 crystals
      if (engine.manaPool.canAddCrystal(newState.player.mana, endHex.siteData.mineColor)) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            mana: engine.manaPool.addCrystal(newState.player.mana, endHex.siteData.mineColor),
          },
        }
        newState = withLog(newState, 'crystal_gain', 'logmsg.mineCrystal', { color: endHex.siteData.mineColor })
      }
    }

    // UNIT-12-B: all cities conquered → player gets exactly one final turn, then the game ends
    if (newState.finalTurnPending) {
      if (!newState.finalTurnUsed) {
        const nextTurnCount = newState.turnCount + 1
        const nextTurn = {
          ...engine.turnManager.startTurn(newState.player.turn, nextTurnCount),
          turnStartPosition: { ...newState.player.position },
        }
        const nextDeck = engine.deckManager.drawToHandLimit(newState.player.deck, newState.player.handLimit)
        const nextSkills = engine.skillManager.resetSkillsForTurn(newState.player.skills)
        newState = {
          ...newState,
          turnCount: nextTurnCount,
          finalTurnUsed: true,
          player: { ...newState.player, turn: nextTurn, deck: nextDeck, skills: nextSkills },
          phase: 'player_turn_start' as GamePhase,
        }
        newState = withLog(newState, 'turn_start', `Final turn begins (turn ${nextTurnCount})`)
        updateState(newState)
        return
      }
      newState = { ...newState, isGameOver: true, phase: 'game_over' as GamePhase }
      newState = withLog(newState, 'game_end', 'Final turn complete — the game ends in victory!')
      updateState(newState)
      return
    }

    if (hadExtraTurn) {
      const nextTurnCount = newState.turnCount + 1
      const nextTurn2 = {
        ...engine.turnManager.startTurn(newState.player.turn, nextTurnCount),
        turnStartPosition: { ...newState.player.position },
      }

      const effectiveHandLimit = engine.tacticEffectManager.getEffectiveHandLimit(
        newState.player.currentTactic,
        newState.player.handLimit,
        newState.player.deck.hand,
      )

      const nextDeck = engine.deckManager.drawToHandLimit(newState.player.deck, effectiveHandLimit + keepCityHandLimitBonus(newState))
      const nextSkillsExtra = engine.skillManager.resetSkillsForTurn(newState.player.skills)
      newState = {
        ...newState,
        turnCount: nextTurnCount,
        player: { ...newState.player, turn: nextTurn2, deck: nextDeck, skills: nextSkillsExtra },
        phase: 'player_turn_start' as GamePhase,
      }
      newState = withLog(newState, 'tactic_select', 'The Right Moment: 추가 턴 시작 (더미 턴 건너뜀)')
      newState = withLog(newState, 'turn_start', `Turn ${nextTurnCount} begins (extra turn)`)
      updateState(newState)
      return
    }

    let currentDummy = engine.dummyPlayer.executeDummyTurn(state.dummyPlayer)
    newState = {
      ...newState,
      dummyPlayer: currentDummy,
    }
    newState = withLog(newState, 'dummy_turn', `Dummy player flipped cards`, {
      cardsFlipped: currentDummy.cardsFlippedThisRound,
      hasEndedRound: currentDummy.hasEndedRound,
    })

    const playerEnded = playerDeclaredEnd || engine.deckManager.isDeckEmpty(newDeck)

    if (playerEnded && !currentDummy.hasEndedRound) {
      let safety = 0
      while (!currentDummy.hasEndedRound && safety < 50) {
        currentDummy = engine.dummyPlayer.executeDummyTurn(currentDummy)
        safety++
      }
      newState = { ...newState, dummyPlayer: currentDummy }
      newState = withLog(newState, 'dummy_turn', `Dummy finished round (${currentDummy.cardsFlippedThisRound} cards flipped)`)
    }

    const roundOver = engine.turnManager.isRoundOver(playerEnded, currentDummy.hasEndedRound)

    if (roundOver) {
      const nextPhase = engine.turnManager.advancePhase('end_of_turn', { roundEnding: true })
      newState = { ...newState, phase: nextPhase }
    } else {
      const nextTurnCount = newState.turnCount + 1
      const nextTurn2 = {
        ...engine.turnManager.startTurn(newState.player.turn, nextTurnCount),
        turnStartPosition: { ...newState.player.position },
      }

      const effectiveHandLimit = engine.tacticEffectManager.getEffectiveHandLimit(
        newState.player.currentTactic,
        newState.player.handLimit,
        newState.player.deck.hand,
      )

      const nextDeck = engine.deckManager.drawToHandLimit(newState.player.deck, effectiveHandLimit + keepCityHandLimitBonus(newState))
      const nextSkills = engine.skillManager.resetSkillsForTurn(newState.player.skills)
      newState = {
        ...newState,
        turnCount: nextTurnCount,
        player: { ...newState.player, turn: nextTurn2, deck: nextDeck, skills: nextSkills },
        phase: 'player_turn_start' as GamePhase,
      }

      if (effectiveHandLimit > newState.player.handLimit) {
        newState = withLog(newState, 'tactic_select', `Planning: 핸드 리밋 +1 적용 (${effectiveHandLimit})`)
      }

      newState = withLog(newState, 'turn_start', `Turn ${nextTurnCount} begins`)
    }

    updateState(newState)
  }, [updateState, withLog, clearUndoStack])

  const declareRest = useCallback(
    (type: RestType, selectedCardIndices?: number[]) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const newTurn = engine.turnManager.setTurnType(state.player.turn, 'resting')

      let newDeck = state.player.deck
      if (type === 'standard') {
        if (selectedCardIndices && selectedCardIndices.length > 0) {
          // Player-selected cards to discard
          // Sort descending to avoid index shifting
          const sortedIndices = [...selectedCardIndices].sort((a, b) => b - a)
          for (const idx of sortedIndices) {
            const card = newDeck.hand[idx]
            if (card) {
              if (card.type === 'wound') {
                newDeck = engine.deckManager.discardFromHandForced(newDeck, idx)
              } else {
                newDeck = engine.deckManager.discardFromHand(newDeck, idx)
              }
            }
          }
        } else {
          // Fallback: auto-discard first non-wound + all wounds (simplified)
          // EC-03-C-1: Standard Rest = discard exactly 1 non-wound + any number of wounds
          // Wounds go to discard pile (NOT wound pile) → they come back next round (EC-03-C-5).
          const woundIndices: number[] = []
          let firstNonWoundIndex = -1
          for (let i = 0; i < newDeck.hand.length; i++) {
            if (newDeck.hand[i].type === 'wound') {
              woundIndices.push(i)
            } else if (firstNonWoundIndex === -1) {
              firstNonWoundIndex = i
            }
          }
          // Discard wounds first (reverse order), using forced discard to discard pile
          for (let i = woundIndices.length - 1; i >= 0; i--) {
            newDeck = engine.deckManager.discardFromHandForced(newDeck, woundIndices[i])
          }
          // Discard exactly 1 non-wound card (recalculate index after wounds removed)
          if (firstNonWoundIndex !== -1) {
            const adjustedIdx = newDeck.hand.findIndex((c) => c.type !== 'wound')
            if (adjustedIdx !== -1) {
              newDeck = engine.deckManager.discardFromHand(newDeck, adjustedIdx)
            }
          }
        }
      } else if (type === 'slow_recovery') {
        // EC-03-C: Slow Recovery = only Wounds in hand → discard exactly 1 wound
        // Wound goes to discard pile (comes back next round via shuffle).
        const woundIdx = newDeck.hand.findIndex((c) => c.type === 'wound')
        if (woundIdx !== -1) {
          newDeck = engine.deckManager.discardFromHandForced(newDeck, woundIdx)
        }
      }

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          turn: newTurn,
          deck: newDeck,
        },
      }
      newState = withLog(newState, 'turn_end', `Player rests (${type})`)

      const nextPhase = engine.turnManager.advancePhase('player_turn_start', { isResting: true })
      newState = { ...newState, phase: nextPhase }
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const declareEndOfRound = useCallback(() => {
    const state = sharedState
    if (!state) return

    const newTurn = {
      ...state.player.turn,
      endOfRoundDeclared: true,
    }

    let newState: GameState = {
      ...state,
      player: { ...state.player, turn: newTurn },
    }
    newState = withLog(newState, 'turn_end', 'Player declared end of round')
    updateState(newState)
  }, [updateState, withLog])

  const activateTacticEffect = useCallback(
    (action: 'right_moment' | 'long_night' | 'midnight_meditation' | 'sparing_power_store' | 'sparing_power_retrieve' | 'mana_steal_use' | 'mana_search', options?: {
      midnightMeditationCardIndices?: number[]
      manaSearchDieIds?: string[]
    }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (!state.player.currentTactic) return

      pushState(state)

      const tactic = state.player.currentTactic
      let result: import('@/engine/TacticEffectManager').TacticActivationResult = {}

      switch (action) {
        case 'right_moment':
          result = engine.tacticEffectManager.activateRightMoment(tactic)
          break
        case 'long_night':
          result = engine.tacticEffectManager.activateLongNight(tactic, state.player.deck)
          break
        case 'midnight_meditation':
          result = engine.tacticEffectManager.activateMidnightMeditation(
            tactic, state.player.deck, options?.midnightMeditationCardIndices,
          )
          break
        case 'sparing_power_store':
          result = engine.tacticEffectManager.activateSparingPowerStore(tactic, state.player.deck)
          break
        case 'sparing_power_retrieve':
          result = engine.tacticEffectManager.activateSparingPowerRetrieve(tactic, state.player.deck)
          break
        case 'mana_steal_use':
          result = engine.tacticEffectManager.useManaStealDie(tactic, state.player.mana)
          break
        case 'mana_search': {
          // Mana Search is once per turn — bail if already used this turn.
          if (state.player.turn.manaSearchUsedThisTurn) return
          const searchResult = engine.tacticEffectManager.applyManaSearch(
            state.player.mana, options?.manaSearchDieIds,
          )
          result = { mana: searchResult.mana, log: searchResult.log }
          break
        }
      }

      let newState: GameState = { ...state }
      if (result.deck) {
        newState = { ...newState, player: { ...newState.player, deck: result.deck } }
      }
      if (result.mana) {
        newState = { ...newState, player: { ...newState.player, mana: result.mana } }
      }
      if (result.tactic) {
        newState = { ...newState, player: { ...newState.player, currentTactic: result.tactic } }
      }
      if (result.log) {
        newState = withLog(newState, 'tactic_select', result.log)
      }

      if (result.grantExtraTurn) {
        newState = { ...newState, player: { ...newState.player, turn: { ...newState.player.turn, extraTurnGranted: true } } }
      }

      // Mana Search is once per turn — record that it was used so the button
      // disables until the next turn.
      if (action === 'mana_search') {
        newState = { ...newState, player: { ...newState.player, turn: { ...newState.player.turn, manaSearchUsedThisTurn: true } } }
      }

      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  MOVEMENT
  // ════════════════════════════════════════════
  const getReachableHexes = useCallback(
    (movePoints: number): Map<string, number> => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return new Map()

      return engine.movementResolver.getReachableHexes(
        state.map,
        state.player.position,
        movePoints,
        state.dayNight,
        state.player.turn.terrainModifiers,
      )
    },
    [],
  )

  const movePlayer = useCallback(
    (to: HexCoord) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const pathResult = engine.movementResolver.getMovementPath(
        state.map,
        state.player.position,
        to,
        state.dayNight,
        state.player.turn.terrainModifiers,
      )
      if (!pathResult) return
      // Validate move point budget BEFORE pushing undo state
      const totalSpent = state.player.turn.movePointsSpent + pathResult.cost
      if (totalSpent > state.player.turn.movePointsAvailable) return
      pushState(state)

      const newTurn = {
        ...state.player.turn,
        hasMovedThisTurn: true,
        movePointsSpent: state.player.turn.movePointsSpent + pathResult.cost,
      }

      let newState: GameState = {
        ...state,
        phase: 'action_declaration' as GamePhase,
        player: {
          ...state.player,
          position: { ...to },
          turn: newTurn,
        },
      }
      newState = withLog(newState, 'movement', `Moved to (${to.q}, ${to.r})`, {
        cost: pathResult.cost,
        path: pathResult.path,
      })

      // UNIT-05-B/C: combat triggers after moving
      const destHex = newState.map.hexGrid.get(hexKey(to))

      // 1) Entering a hex occupied by enemies → mandatory combat
      //    (fortified garrison at keep/mageTower/city, or rampaging enemies)
      if (destHex && destHex.enemyTokens.length > 0) {
        const isFortified = (destHex.siteData?.type === 'keep' ||
          destHex.siteData?.type === 'mageTower' ||
          destHex.siteData?.type === 'city') && !destHex.siteData?.isConquered
        const isAdventureSite = destHex.siteData && !isFortified
        // Adventure sites (dungeon/tomb/...) are voluntary — combat starts via the Fight button.
        if (!isAdventureSite) {
          const combat = engine.combatResolver.initiateCombat(
            destHex.enemyTokens, isFortified, destHex.siteData?.cityColor, to,
          )
          newState = {
            ...newState,
            combat,
            phase: 'combat_ranged_siege' as GamePhase,
          }
          newState = withLog(newState, 'combat_start', `Forced combat at ${destHex.siteData?.type ?? 'rampaging enemies'}`)
        }
      } else {
        // 2) EC-05-B: moving from a hex adjacent to a rampaging enemy to another
        //    hex adjacent to the SAME enemy provokes it → combat immediately
        const from = state.player.position
        const provoked: EnemyToken[] = []
        let provokedHex: HexCoord | undefined
        for (const n of hexNeighbors(from)) {
          const nHex = newState.map.hexGrid.get(hexKey(n))
          if (!isRampagingHex(nHex)) continue
          // is this rampaging hex also adjacent to the destination?
          const adjacentToDest = hexNeighbors(to).some((d) => d.q === n.q && d.r === n.r)
          if (adjacentToDest) {
            provoked.push(...(nHex?.enemyTokens ?? []))
            provokedHex = n
          }
        }
        if (provoked.length > 0 && provokedHex) {
          const combat = engine.combatResolver.initiateCombat(provoked, false, undefined, provokedHex)
          newState = {
            ...newState,
            combat,
            phase: 'combat_ranged_siege' as GamePhase,
          }
          newState = withLog(newState, 'combat_start', 'Provoked rampaging enemies — combat begins!')
        }
      }

      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  TILE EXPLORATION (manual reveal)
  // ════════════════════════════════════════════
  const canExploreTile = useCallback((): boolean => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return false

    const revealCost = engine.movementResolver.getTileRevealCost()
    const remaining =
      state.player.turn.movePointsAvailable - state.player.turn.movePointsSpent
    if (remaining < revealCost) return false

    if (!engine.movementResolver.canRevealTile(state.map, state.player.position))
      return false

    return engine.mapGenerator.getValidTilePlacements(state.map).length > 0
  }, [])

  const getExplorePlacements = useCallback((): HexCoord[] => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return []
    return engine.mapGenerator.getValidTilePlacements(state.map)
  }, [])

  const exploreTile = useCallback((position: HexCoord) => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    const revealCost = engine.movementResolver.getTileRevealCost()
    const remaining =
      state.player.turn.movePointsAvailable - state.player.turn.movePointsSpent
    if (remaining < revealCost) return

    const updatedMap = engine.mapGenerator.revealTile(state.map, position)

    // Deduct MP
    const newTurn = {
      ...state.player.turn,
      movePointsSpent: state.player.turn.movePointsSpent + revealCost,
    }

    let newState: GameState = {
      ...state,
      player: { ...state.player, turn: newTurn },
      map: updatedMap,
    }

    // Assign enemies to sites that have enemyColor (same logic as movePlayer)
    const sitesData = getSites()
    const newHexGrid = new Map(updatedMap.hexGrid)
    let enemiesAssigned = 0

    // Solo Conquest: the first revealed city is level 5, the second level 8.
    const CITY_LEVELS = [5, 8]
    const CITY_POOLS: Array<'white' | 'grey' | 'red' | 'violet'> = ['white', 'grey', 'red', 'violet']
    let citiesWithLevel = 0
    for (const h of updatedMap.hexGrid.values()) {
      if (h.site === 'city' && h.siteData?.cityLevel != null) citiesWithLevel++
    }

    for (const [key, hex] of updatedMap.hexGrid.entries()) {
      if (!hex.site || !hex.siteData) continue
      // Never re-garrison a site that already has enemies or is conquered.
      if (hex.enemyTokens.length > 0 || hex.siteData.isConquered) continue
      const siteInfo = sitesData.find((s) => s.type === hex.site)
      if (
        !siteInfo || !siteInfo.enemyColor ||
        siteInfo.enemyColor === 'null' || siteInfo.enemyColor === 'special'
      ) continue

      if (siteInfo.enemyColor === 'multiple') {
        // City garrison (rulebook-based approximation): defenders scale with the
        // city level and are drawn from city-defender pools. They fight fortified
        // with the city's colour bonuses, applied at combat start.
        const level = CITY_LEVELS[Math.min(citiesWithLevel, CITY_LEVELS.length - 1)]
        citiesWithLevel++
        const garrisonSize = Math.ceil(level / 2) + 1 // L5 → 4, L8 → 5
        const drawn: typeof hex.enemyTokens = []
        for (const color of CITY_POOLS) {
          while (drawn.length < garrisonSize && newState.enemyPools[color].length > 0) {
            drawn.push(newState.enemyPools[color][0])
            newState = {
              ...newState,
              enemyPools: { ...newState.enemyPools, [color]: newState.enemyPools[color].slice(1) },
            }
          }
          if (drawn.length >= garrisonSize) break
        }
        if (drawn.length > 0) {
          newHexGrid.set(key, { ...hex, enemyTokens: drawn, siteData: { ...hex.siteData, cityLevel: level } })
          enemiesAssigned += drawn.length
        }
        continue
      }

      const color = siteInfo.enemyColor as 'green' | 'grey' | 'violet' | 'brown' | 'red' | 'white'
      const count = siteInfo.enemyCount ?? 1
      const drawn = newState.enemyPools[color].slice(0, count)
      if (drawn.length > 0) {
        newState = {
          ...newState,
          enemyPools: { ...newState.enemyPools, [color]: newState.enemyPools[color].slice(drawn.length) },
        }
        newHexGrid.set(key, { ...hex, enemyTokens: drawn })
        enemiesAssigned += drawn.length
      }
    }

    newState = {
      ...newState,
      map: { ...newState.map, hexGrid: newHexGrid },
    }

    // (Solo Conquest does not grant Fame for revealing tiles — that is a
    // First Reconnaissance special rule only.)

    newState = withLog(
      newState,
      'tile_reveal',
      `Explored tile at (${position.q}, ${position.r})${enemiesAssigned > 0 ? ` — placed ${enemiesAssigned} enemy token(s)` : ''}`,
      { position, cost: revealCost, enemiesAssigned },
    )

    clearUndoStack()
    updateState(newState)
  }, [updateState, withLog, clearUndoStack])

  // ════════════════════════════════════════════
  //  CARD PLAY
  // ════════════════════════════════════════════
  /** Player decisions for cards whose effects need a pick (Tranquility, Crystallize strong…) */
  type PlayCardOptions = {
    /** Index (within effect.actions) of the picked choice action */
    chosenActionIndex?: number
    /** Colors consumed in order by open-color crystal/mana gains */
    chosenColors?: import('@/engine/types').ExtendedManaColor[]
  }

  const playCard = useCallback(
    (handIndex: number, mode: 'basic' | 'strong' = 'basic', options?: PlayCardOptions) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      const card = state.player.deck.hand[handIndex]
      if (!card) return
      if (card.type === 'wound') return // EC-02-D: wounds can never be played

      let newMana = state.player.mana

      // Bug #2: Spell basic effect requires mana of card's color
      if (mode === 'basic' && card.type === 'spell') {
        const spellCard = card as import('@/engine/types').SpellCard
        const spellColor = Array.isArray(spellCard.color) ? spellCard.color[0] : spellCard.color
        const result = engine.manaPool.spendManaOfColor(newMana, spellColor, state.dayNight)
        if (!result) return // Can't play spell without mana
        newMana = result
      }

      // Strong mode: the FULL mana cost must be paid or the play is refused (EC-02-A-4)
      if (mode === 'strong' && card.type !== 'artifact') {
        // EC-02-B-2: spell strong is impossible during day (needs black mana)
        if (card.type === 'spell' && state.dayNight === 'day') return

        const deedCard = card as import('@/engine/types').DeedCard
        const effect = card.type === 'spell'
          ? (deedCard as import('@/engine/types').SpellCard).strongSpell
          : (deedCard as import('@/engine/types').BasicActionCard | import('@/engine/types').AdvancedActionCard).strongEffect

        const rawCosts: string[] = effect?.manaCost
          ? (Array.isArray(effect.manaCost) ? [...effect.manaCost] : [effect.manaCost])
          : ('color' in card && card.color
              ? [Array.isArray(card.color) ? card.color.join('_or_') : (card.color as string)]
              : [])

        for (const cost of rawCosts) {
          if (cost === 'black') {
            const result = engine.manaPool.spendBlackMana(newMana)
            if (!result) return // cost unpaid → refuse the play
            newMana = result
          } else {
            const colorParts = cost.split('_or_')
            let spent = false
            for (const cp of colorParts) {
              const result = engine.manaPool.spendManaOfColor(newMana, cp as import('@/engine/types').ManaColor, state.dayNight)
              if (result) { newMana = result; spent = true; break }
            }
            if (!spent) return // cost unpaid → refuse the play
          }
        }
      }

      // ── Named special effects (data action type 'special') ──
      // Crystallize basic: pay one mana of a basic color → gain a crystal of it
      let bonusCrystal: import('@/engine/types').ManaColor | null = null
      let manaDrawStrongColor: string | null = null
      if (card.type === 'basic_action' && card.name === 'Crystallize' && mode === 'basic') {
        const pick = options?.chosenColors?.[0]
        if (!pick || pick === 'gold' || pick === 'black') return
        const paid = engine.manaPool.spendManaOfColor(newMana, pick, state.dayNight)
        if (!paid) return // cost unpaid → refuse the play
        newMana = engine.manaPool.addCrystal(paid, pick)
        bonusCrystal = pick
      }
      // Mana Draw: basic = one extra Source die usable this turn;
      // strong = take a die, set it to a chosen non-gold color, gain 2 tokens
      if (card.type === 'basic_action' && card.name === 'Mana Draw') {
        if (mode === 'basic') {
          newMana = { ...newMana, extraSourceDice: (newMana.extraSourceDice ?? 0) + 1 }
        } else {
          const pick = options?.chosenColors?.[0]
          if (!pick || pick === 'gold') return
          if (pick === 'black' && state.dayNight !== 'night') return
          const dieIdx = newMana.dice.findIndex((d) => d.isInSource)
          if (dieIdx === -1) return
          newMana = {
            ...newMana,
            dice: newMana.dice.map((d, i) =>
              i === dieIdx ? { ...d, color: pick as import('@/engine/types').ExtendedManaColor, isInSource: false } : d,
            ),
            playerMana: [
              ...newMana.playerMana,
              { color: pick as import('@/engine/types').ExtendedManaColor, source: 'effect' as const },
              { color: pick as import('@/engine/types').ExtendedManaColor, source: 'effect' as const },
            ],
          }
          manaDrawStrongColor = pick
        }
      }

      pushState(state)

      // Artifact strong: throw away instead of play
      let newDeck: import('@/engine/types').DeckState
      let bannerStrongUnits: import('@/engine/types').UnitInstance[] | null = null
      let bannerStrongLog: string | null = null
      if (mode === 'strong' && card.type === 'artifact') {
        // Banner strong effects that resolve outside combat
        if (card.subtype === 'banner') {
          if (state.combat.isActive) return
          if (card.name === 'Banner of Courage') {
            // Ready all units you control
            bannerStrongUnits = state.player.units.map((u) =>
              u.status === 'spent' ? { ...u, status: 'ready' as const } : u,
            )
            bannerStrongLog = 'Banner of Courage: all units readied'
          } else if (card.name === 'Banner of Fortitude') {
            // Heal all of your units completely
            bannerStrongUnits = state.player.units.map((u) =>
              u.woundCount > 0 ? { ...u, woundCount: 0, status: 'ready' as const } : u,
            )
            bannerStrongLog = 'Banner of Fortitude: all units fully healed'
          } else {
            // Glory/Fear/Protection/Command strong effects are not supported yet
            return
          }
        }
        newDeck = engine.deckManager.throwAwayCard(state.player.deck, String(card.id))
      } else {
        newDeck = engine.deckManager.playCard(state.player.deck, handIndex)
      }

      let resolvedTurn = {
        ...state.player.turn,
        cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn, String(card.id)],
      }

      // Resolve card effects (card is a DeedCard — wounds were rejected above)
      let resolution: import('@/engine/CardEffectResolver').EffectResolution | null = null
      {
        const effectToResolve = mode === 'strong'
          ? (card.type === 'spell'
            ? (card as import('@/engine/types').SpellCard).strongSpell
            : 'strongEffect' in card ? (card as any).strongEffect : (card as any).basicEffect)
          : ('basicEffect' in card ? (card as any).basicEffect : (card.type === 'spell' ? (card as import('@/engine/types').SpellCard).basicSpell : null))

        if (effectToResolve) {
          // Honor the player's pick among choice actions (Tranquility heal-vs-draw…)
          const selected = selectEffectActions(effectToResolve, options?.chosenActionIndex)
          resolution = engine.cardEffectResolver.resolveEffect(selected, state.dayNight)
          // Restoration / Rebirth: Heal 5 instead of 3 when in a forest.
          if (card.name.startsWith('Restoration') && resolution.healingValue > 0) {
            const terrain = state.map.hexGrid.get(hexKey(state.player.position))?.terrain
            if (terrain === 'forest') resolution.healingValue += 2
          }
          resolvedTurn = engine.cardEffectResolver.applyToTurnState(resolvedTurn, resolution)
          // Mountain Lore: flag the hand-limit bonus to apply if the turn ends in
          // hills (basic/strong) or mountains (strong) at the next draw.
          if (card.name === 'Mountain Lore') {
            resolvedTurn = { ...resolvedTurn, mountainLore: mode === 'strong' ? 'strong' : 'basic' }
          }
          // Steady Tempo: at end of turn return it to the deck (bottom=basic,
          // top=strong) instead of the discard pile.
          if (card.name === 'Steady Tempo') {
            resolvedTurn = { ...resolvedTurn, steadyTempo: mode === 'strong' ? 'strong' : 'basic' }
          }
          // Ambush: +1/+2 (basic) or +2/+4 (strong) to the FIRST Attack OR Block
          // card played in combat this turn, whichever comes first.
          if (card.name === 'Ambush') {
            resolvedTurn = {
              ...resolvedTurn,
              ambush: mode === 'strong'
                ? { attackBonus: 2, blockBonus: 4 }
                : { attackBonus: 1, blockBonus: 2 },
            }
          }
          // Agility: leftover Move points may be spent as Attack (1:1) in combat
          // this turn; strong also allows 2 Move → 1 Ranged Attack.
          if (card.name === 'Agility') {
            resolvedTurn = { ...resolvedTurn, agility: { ranged: mode === 'strong' } }
          }
          // Cure (basic) / Golden Grail (strong): for the rest of this turn,
          // draw a card for each Wound healed from hand.
          if (
            (card.name.startsWith('Cure') && mode === 'basic') ||
            (card.name === 'Golden Grail' && mode === 'strong')
          ) {
            resolvedTurn = { ...resolvedTurn, drawPerWoundHeal: (resolvedTurn.drawPerWoundHeal ?? 0) + 1 }
          }
        }
      }

      // Turn-scoped terrain cost modifiers (Frost Bridge, Path Finding…)
      if (resolution && resolution.terrainModifiers.length > 0) {
        resolvedTurn = {
          ...resolvedTurn,
          terrainModifiers: [
            ...(resolvedTurn.terrainModifiers ?? []),
            ...resolution.terrainModifiers,
          ],
        }
      }

      // Mist Form (basic): "you cannot enter hills and mountains for the rest of
      // this turn" — add an impassable terrain modifier alongside the all-cost-2
      // modifier already parsed from the card's actions.
      if (card.name.startsWith('Mist Form') && mode === 'basic') {
        resolvedTurn = {
          ...resolvedTurn,
          terrainModifiers: [
            ...(resolvedTurn.terrainModifiers ?? []),
            { type: 'terrain_modifier', terrain: ['hills', 'mountain'], impassable: true },
          ],
        }
      }

      // Open-color gains consume the player's color picks in order
      const crystalsGained: import('@/engine/types').ManaColor[] = [...(resolution?.crystalsGained ?? [])]
      const manaTokensGained: string[] = [...(resolution?.manaTokensGained ?? [])]
      const colorPicks = [...(options?.chosenColors ?? [])]
      // Charm / Possess: when used during interaction, also gain a crystal of a
      // chosen colour (the "−3 Unit discount" alternative is not modelled).
      if (card.name.startsWith('Charm') && state.interaction?.isActive) {
        const pick = colorPicks.shift()
        if (pick && pick !== 'gold' && pick !== 'black') crystalsGained.push(pick)
      }
      for (const action of resolution?.openCrystalActions ?? []) {
        const allowed = parseColorSpec(String(action.color ?? 'any_basic'))
        const pick = colorPicks.shift()
        if (pick && pick !== 'gold' && pick !== 'black' && allowed.includes(pick)) {
          crystalsGained.push(pick)
        }
      }
      for (const action of resolution?.openManaActions ?? []) {
        const allowed = parseColorSpec(String(action.color ?? ''))
        const count = typeof action.count === 'number' ? action.count : 1
        for (let i = 0; i < count; i++) {
          const pick = colorPicks.shift()
          if (pick && allowed.includes(pick)) manaTokensGained.push(pick)
        }
      }

      // Crystal gains (e.g. Crushing Bolt basic) go to the mana inventory.
      // ManaPool.addCrystal converts overflow (3+ of a color) into a token.
      for (const color of crystalsGained) {
        newMana = engine.manaPool.addCrystal(newMana, color)
      }
      // Mana token gains — black is meaningless outside night, gold outside day (EC-01-D)
      const tokensGranted: string[] = []
      for (const color of manaTokensGained) {
        if (color === 'black' && state.dayNight !== 'night') continue
        if (color === 'gold' && state.dayNight !== 'day') continue
        newMana = engine.manaPool.addManaToken(newMana, color as import('@/engine/types').ManaColor | 'gold' | 'black', 'effect')
        tokensGranted.push(color)
      }

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          deck: newDeck,
          turn: resolvedTurn,
          mana: newMana,
          ...(bannerStrongUnits ? { units: bannerStrongUnits } : {}),
        },
      }
      if (bannerStrongLog) {
        newState = withLog(newState, 'unit_activate', bannerStrongLog)
      }

      // Bug #7: Apply influence from card effects to active interaction
      if (newState.interaction?.isActive) {
        const effectToCheck = mode === 'strong'
          ? (card.type === 'spell'
            ? (card as import('@/engine/types').SpellCard).strongSpell
            : 'strongEffect' in card ? (card as any).strongEffect : null)
          : ('basicEffect' in card ? (card as any).basicEffect : (card.type === 'spell' ? (card as import('@/engine/types').SpellCard).basicSpell : null))
        if (effectToCheck) {
          const influenceAction = effectToCheck.actions?.find((a: any) => a.type === 'influence')
          if (influenceAction?.value) {
            newState = {
              ...newState,
              interaction: engine.interactionManager.addInfluence(newState.interaction!, influenceAction.value),
            }
          }
        }
      }

      // Auto-advance to movement phase when move points become available
      if (state.phase === 'player_turn_start' && resolvedTurn.movePointsAvailable > 0) {
        newState = { ...newState, phase: 'movement' as GamePhase }
      }
      // ── Post-effects: draws, wounds, reputation, unit ready ──
      if (resolution && resolution.cardsToDraw > 0) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            deck: engine.deckManager.drawCards(newState.player.deck, resolution.cardsToDraw),
          },
        }
      }
      if (resolution && resolution.woundsTaken > 0) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            deck: engine.deckManager.addWound(newState.player.deck, resolution.woundsTaken),
          },
        }
      }
      if (resolution && resolution.reputationDelta !== 0) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            reputation: engine.reputationManager.changeReputation(
              newState.player.reputation,
              resolution.reputationDelta,
            ),
          },
        }
      }
      if (resolution && resolution.fameDelta !== 0) {
        newState = applyFameGain(engine, newState, resolution.fameDelta)
        newState = withLog(newState, 'fame_gain', `Fame +${resolution.fameDelta} (${card.name})`)
      }
      // In Need: influence per Wound (hand + wounded units) — interaction only
      if (resolution && resolution.influencePerWound > 0 && newState.interaction?.isActive) {
        const wounds =
          newState.player.deck.hand.filter((c) => c.type === 'wound').length +
          newState.player.units.reduce((s, u) => s + u.woundCount, 0)
        const gained = wounds * resolution.influencePerWound
        if (gained > 0) {
          newState = {
            ...newState,
            interaction: engine.interactionManager.addInfluence(newState.interaction, gained),
          }
          newState = withLog(newState, 'interaction', `+${gained} influence (${card.name}: ${wounds} wounds)`)
        }
      }
      // Acquire the bottom card of the AA / Spell offer (Learning, Training, Book of Wisdom…)
      if (resolution && resolution.gainAdvancedAction && newState.offers.advancedActions.length > 0) {
        const offerCard = newState.offers.advancedActions[newState.offers.advancedActions.length - 1]
        const newOffer = newState.offers.advancedActions.filter((c) => c.id !== offerCard.id)
        const deckAfter =
          resolution.gainAdvancedAction === 'hand'
            ? { ...newState.player.deck, hand: [...newState.player.deck.hand, offerCard] }
            : engine.deckManager.addCardToTopOfDeck(newState.player.deck, offerCard)
        newState = {
          ...newState,
          player: { ...newState.player, deck: deckAfter },
          offers: { ...newState.offers, advancedActions: newOffer },
        }
        newState = withLog(newState, 'card_acquire', `Gained ${offerCard.name} from the offer (${card.name})`)
      }
      if (resolution && resolution.gainSpell && newState.offers.spells.length > 0) {
        const offerCard = newState.offers.spells[newState.offers.spells.length - 1]
        const newOffer = newState.offers.spells.filter((c) => c.id !== offerCard.id)
        const deckAfter =
          resolution.gainSpell === 'hand'
            ? { ...newState.player.deck, hand: [...newState.player.deck.hand, offerCard] }
            : engine.deckManager.addCardToTopOfDeck(newState.player.deck, offerCard)
        newState = {
          ...newState,
          player: { ...newState.player, deck: deckAfter },
          offers: { ...newState.offers, spells: newOffer },
        }
        newState = withLog(newState, 'card_acquire', `Gained ${offerCard.name} from the offer (${card.name})`)
      }
      let readiedUnitName: string | null = null
      if (resolution && resolution.readyUnitMaxLevel !== null) {
        const maxLevel = resolution.readyUnitMaxLevel
        const idx = newState.player.units.findIndex(
          (u) => u.status === 'spent' && u.unit.level <= maxLevel,
        )
        if (idx >= 0) {
          readiedUnitName = newState.player.units[idx].unit.name
          newState = {
            ...newState,
            player: {
              ...newState.player,
              units: newState.player.units.map((u, i) =>
                i === idx ? { ...u, status: 'ready' as const } : u,
              ),
            },
          }
        }
      }

      // Noble Manners: Fame +1 during interaction (strong also Reputation +1)
      if (card.type === 'basic_action' && card.name === 'Noble Manners' && newState.interaction?.isActive) {
        newState = applyFameGain(engine, newState, 1)
        newState = withLog(newState, 'fame_gain', 'Noble Manners: +1 Fame')
        if (mode === 'strong') {
          newState = {
            ...newState,
            player: {
              ...newState.player,
              reputation: engine.reputationManager.changeReputation(newState.player.reputation, 1),
            },
          }
          newState = withLog(newState, 'reputation_change', 'Noble Manners: +1 Reputation')
        }
      }

      const cardName = card.name
      const modeLabel = mode === 'strong' ? ' (Strong)' : ''
      newState = withLog(newState, 'card_play', `Played card: ${cardName}${modeLabel}`)
      if (bonusCrystal) {
        newState = withLog(newState, 'crystal_gain', `Gained ${bonusCrystal} crystal (Crystallize)`)
      }
      if (manaDrawStrongColor) {
        newState = withLog(newState, 'mana_use', `Mana Draw: set a Source die to ${manaDrawStrongColor}, gained 2 ${manaDrawStrongColor} tokens`)
      }
      for (const color of crystalsGained) {
        newState = withLog(newState, 'crystal_gain', `Gained ${color} crystal (${cardName})`)
      }
      for (const color of tokensGranted) {
        newState = withLog(newState, 'mana_use', `Gained ${color} mana token (${cardName})`)
      }
      if (resolution && resolution.cardsToDraw > 0) {
        newState = withLog(newState, 'card_draw', `Drew ${resolution.cardsToDraw} card(s) (${cardName})`)
      }
      if (resolution && resolution.woundsTaken > 0) {
        newState = withLog(newState, 'wound_gain', `Took ${resolution.woundsTaken} wound(s) (${cardName})`)
      }
      if (resolution && resolution.reputationDelta !== 0) {
        newState = withLog(newState, 'reputation_change', `Reputation ${resolution.reputationDelta > 0 ? '+' : ''}${resolution.reputationDelta} (${cardName})`)
      }
      if (readiedUnitName) {
        newState = withLog(newState, 'unit_activate', `Readied ${readiedUnitName} (${cardName})`)
      }
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const playCardWithDiscard = useCallback(
    (cardIndex: number, discardIndex: number, effectType: 'move' | 'influence' | 'attack' | 'block', effectValue: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const card = state.player.deck.hand[cardIndex]
      if (!card) return

      // 1. Play the card (removes it from hand)
      const deckAfterPlay = engine.deckManager.playCard(state.player.deck, cardIndex)

      // 2. Discard the selected card from the remaining hand
      const deckAfterDiscard = engine.deckManager.discardFromHand(deckAfterPlay, discardIndex)

      // 3. Update turn state
      let resolvedTurn = {
        ...state.player.turn,
        cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn, String(card.id)],
      }

      if (effectType === 'move') {
        resolvedTurn = { ...resolvedTurn, movePointsAvailable: resolvedTurn.movePointsAvailable + effectValue }
      }
      // influence, attack, block tracked in turn state for future use
      // (combat system will read these when implemented)

      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: deckAfterDiscard, turn: resolvedTurn },
      }

      // Influence flows into an active interaction's pool (Bug #7)
      if (effectType === 'influence' && newState.interaction?.isActive) {
        newState = {
          ...newState,
          interaction: engine.interactionManager.addInfluence(newState.interaction, effectValue),
        }
      }

      // Auto-advance to movement phase when move points become available
      if (state.phase === 'player_turn_start' && resolvedTurn.movePointsAvailable > 0) {
        newState = { ...newState, phase: 'movement' as GamePhase }
      }

      const cardName = card.type === 'wound' ? 'Wound' : card.name
      newState = withLog(newState, 'card_play', `Played card: ${cardName} → chose ${effectType} ${effectValue}`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // Offering / Sacrifice (basic): gain a red crystal, then discard up to 3
  // non-Wound cards from hand — each grants a crystal of the matching colour
  // (for multi-colour cards the first basic colour; Artifacts use a chosen
  // colour supplied in artifactColors, in order). `discardIndices` index into
  // the hand AFTER Offering itself is removed (the UI shows that filtered hand).
  const playOffering = useCallback(
    (cardIndex: number, discardIndices: number[] = [], artifactColors: ManaColor[] = []) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const card = state.player.deck.hand[cardIndex]
      if (!card || card.type !== 'spell' || !card.name.startsWith('Offering')) return

      // Spell basic costs the card's colour (red).
      const spent = engine.manaPool.spendManaOfColor(state.player.mana, 'red', state.dayNight)
      if (!spent) return
      let mana = spent

      pushState(state)

      // Primary effect: gain a red crystal.
      mana = engine.manaPool.addCrystal(mana, 'red')

      // Resolve the discard targets from the post-play hand (Offering removed).
      const deckAfterPlay = engine.deckManager.playCard(state.player.deck, cardIndex)
      const targets = Array.from(new Set(discardIndices)).slice(0, 3)
      const artQueue = [...artifactColors]
      const basicColors: ManaColor[] = ['red', 'blue', 'green', 'white']
      const colorFor = (c: typeof deckAfterPlay.hand[number]): ManaColor | null => {
        if (c.type === 'wound') return null
        if (c.type === 'artifact') return artQueue.shift() ?? null
        const col = (c as { color?: ManaColor | ManaColor[] }).color
        const first = Array.isArray(col) ? col[0] : col
        return first && basicColors.includes(first) ? first : null
      }

      let deck = deckAfterPlay
      // Discard from the highest index down so earlier indices stay valid.
      const sorted = targets.filter((i) => i >= 0 && i < deckAfterPlay.hand.length).sort((a, b) => b - a)
      for (const idx of sorted) {
        const target = deckAfterPlay.hand[idx]
        if (target.type === 'wound') continue // only non-Wound cards
        const color = colorFor(target)
        if (color) mana = engine.manaPool.addCrystal(mana, color)
        deck = engine.deckManager.discardFromHand(deck, idx)
      }

      const resolvedTurn = {
        ...state.player.turn,
        cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn, String(card.id)],
      }
      let newState: GameState = {
        ...state,
        player: { ...state.player, deck, mana, turn: resolvedTurn },
      }
      newState = withLog(newState, 'card_play', `Offering: gained ${sorted.length + 1} crystal(s)`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const discardCard = useCallback(
    (handIndex: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const newDeck = engine.deckManager.discardFromHand(state.player.deck, handIndex)
      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck },
      }
      newState = withLog(newState, 'card_play', 'Discarded a card from hand')
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )


  type SidewaysEffectType = 'move' | 'attack' | 'block' | 'influence'

  const playSidewaysCard = useCallback(
    (handIndex: number, effectType: SidewaysEffectType) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      const card = state.player.deck.hand[handIndex]
      if (!card) return
      if (card.type === 'wound') return // wounds can't be played sideways

      pushState(state)

      const newDeck = engine.deckManager.playCard(state.player.deck, handIndex)
      const newTurn = {
        ...state.player.turn,
        cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn, String(card.id)],
        sidewaysCardsPlayed: state.player.turn.sidewaysCardsPlayed + 1,
        ...(effectType === 'move' ? { movePointsAvailable: state.player.turn.movePointsAvailable + 1 } : {}),
      }

      const cardName = card.name
      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck, turn: newTurn },
      }
      if (effectType === 'influence' && newState.interaction?.isActive) {
        newState = {
          ...newState,
          interaction: engine.interactionManager.addInfluence(newState.interaction, 1),
        }
      }
      if (effectType === 'move' && state.phase === 'player_turn_start' && newTurn.movePointsAvailable > 0) {
        newState = { ...newState, phase: 'movement' as GamePhase }
      }
      newState = withLog(newState, 'card_play', `Played ${cardName} sideways for +1 ${effectType}`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * Activate a recruited unit's ability outside combat (Move / Influence / Heal).
   * Attack / Block abilities are combat-only and handled by the combat tray.
   * Influence only applies while an interaction is open. The unit becomes
   * spent for the rest of the round once activated.
   */
  const activateUnit = useCallback(
    (unitIndex: number, action: import('@/engine/types').CardAction) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (state.combat.isActive) return // combat units go through the combat tray

      const inst = state.player.units[unitIndex]
      if (!inst || !engine.unitManager.isUnitActivatable(inst)) return

      // Attack/Block (and ranged/siege) are only meaningful in combat.
      if (
        action.type === 'attack' || action.type === 'block' ||
        action.type === 'ranged_attack' || action.type === 'siege_attack'
      ) return
      // Influence is wasted outside an interaction — don't spend the unit.
      if (action.type === 'influence' && !state.interaction?.isActive) return

      const value = typeof action.value === 'number' ? action.value : 0

      pushState(state)

      let newTurn = {
        ...state.player.turn,
        unitsActivatedThisTurn: [...state.player.turn.unitsActivatedThisTurn, String(inst.unit.id)],
      }
      if (action.type === 'move') {
        newTurn = { ...newTurn, movePointsAvailable: newTurn.movePointsAvailable + value }
      } else if (action.type === 'heal') {
        newTurn = { ...newTurn, healingAvailable: (newTurn.healingAvailable ?? 0) + value }
      }

      const newUnits = engine.unitManager.activateUnit(state.player.units, unitIndex)
      let newState: GameState = {
        ...state,
        player: { ...state.player, units: newUnits, turn: newTurn },
      }
      if (action.type === 'influence' && newState.interaction?.isActive) {
        newState = {
          ...newState,
          interaction: engine.interactionManager.addInfluence(newState.interaction, value),
        }
      }
      if (action.type === 'move' && state.phase === 'player_turn_start' && newTurn.movePointsAvailable > 0) {
        newState = { ...newState, phase: 'movement' as GamePhase }
      }
      newState = withLog(newState, 'unit_activate', `${inst.unit.name} — ${action.type} ${value}`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * Concentration / Will Focus strong: play another Action card with it and
   * resolve that card's strong effect for free, with +2/+3 added to the
   * Move / Influence / Attack / Block it grants.
   */
  const playComboCard = useCallback(
    (handIndex: number, targetHandIndex: number, comboOpts?: { skipCost?: boolean }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (handIndex === targetHandIndex) return

      const card = state.player.deck.hand[handIndex]
      const target = state.player.deck.hand[targetHandIndex]
      if (!card || !target || card.type === 'wound' || target.type === 'wound') return
      const COMBO_BONUS: Record<string, number> = { Concentration: 2, 'Will Focus': 3, 'Maximal Effect': 0 }
      if (card.type !== 'basic_action' && card.type !== 'advanced_action') return
      if (!(card.name in COMBO_BONUS)) return
      if (target.type !== 'basic_action' && target.type !== 'advanced_action') return

      const bonus = COMBO_BONUS[card.name]

      // Pay the combo card's own strong cost (its color; +black at night, UNIT-14 #5)
      let newMana = state.player.mana
      if (!comboOpts?.skipCost) {
        const comboColor = (Array.isArray(card.color) ? card.color[0] : card.color) as import('@/engine/types').ManaColor
        const colorPaid = engine.manaPool.spendManaOfColor(newMana, comboColor, state.dayNight)
        if (!colorPaid) return
        newMana = colorPaid
        if (state.dayNight === 'night') {
          const blackPaid = engine.manaPool.spendBlackMana(newMana)
          if (!blackPaid) return
          newMana = blackPaid
        }
      }

      pushState(state)

      // Both cards leave the hand (higher index first keeps positions stable)
      let newDeck = state.player.deck
      const [first, second] =
        handIndex > targetHandIndex ? [handIndex, targetHandIndex] : [targetHandIndex, handIndex]
      newDeck = engine.deckManager.playCard(newDeck, first)
      newDeck = engine.deckManager.playCard(newDeck, second)

      // Resolve the target's strong effect for free with the combo bonus
      const strongEffect = (target as import('@/engine/types').BasicActionCard | import('@/engine/types').AdvancedActionCard).strongEffect
      const selected = selectEffectActions(strongEffect, undefined)
      const resolution = engine.cardEffectResolver.resolveEffect(selected, state.dayNight)
      if (resolution.movePointsDelta > 0) resolution.movePointsDelta += bonus
      else if (resolution.influenceValue > 0) resolution.influenceValue += bonus
      else if (resolution.attackValue > 0) resolution.attackValue += bonus
      else if (resolution.blockValue > 0) resolution.blockValue += bonus

      let resolvedTurn: import('@/engine/types').TurnState = {
        ...state.player.turn,
        cardsPlayedThisTurn: [
          ...state.player.turn.cardsPlayedThisTurn,
          String(card.id),
          String(target.id),
        ],
      }
      resolvedTurn = engine.cardEffectResolver.applyToTurnState(resolvedTurn, resolution)
      if (resolution.terrainModifiers.length > 0) {
        resolvedTurn = {
          ...resolvedTurn,
          terrainModifiers: [...(resolvedTurn.terrainModifiers ?? []), ...resolution.terrainModifiers],
        }
      }

      for (const color of resolution.crystalsGained) {
        newMana = engine.manaPool.addCrystal(newMana, color)
      }
      for (const color of resolution.manaTokensGained) {
        if (color === 'black' && state.dayNight !== 'night') continue
        if (color === 'gold' && state.dayNight !== 'day') continue
        newMana = engine.manaPool.addManaToken(newMana, color as import('@/engine/types').ManaColor | 'gold' | 'black', 'effect')
      }

      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck, turn: resolvedTurn, mana: newMana },
      }
      if (resolution.influenceValue > 0 && newState.interaction?.isActive) {
        newState = {
          ...newState,
          interaction: engine.interactionManager.addInfluence(newState.interaction, resolution.influenceValue),
        }
      }
      if (resolution.cardsToDraw > 0) {
        newState = {
          ...newState,
          player: { ...newState.player, deck: engine.deckManager.drawCards(newState.player.deck, resolution.cardsToDraw) },
        }
      }
      if (resolution.reputationDelta !== 0) {
        newState = {
          ...newState,
          player: {
            ...newState.player,
            reputation: engine.reputationManager.changeReputation(newState.player.reputation, resolution.reputationDelta),
          },
        }
      }
      if (state.phase === 'player_turn_start' && resolvedTurn.movePointsAvailable > 0) {
        newState = { ...newState, phase: 'movement' as GamePhase }
      }
      newState = withLog(newState, 'card_play', `Played ${card.name} + ${target.name} (Strong combo, +${bonus})`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const drawCards = useCallback(
    (count: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const newDeck = engine.deckManager.drawCards(state.player.deck, count)
      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck },
      }
      newState = withLog(newState, 'card_draw', `Drew ${count} card(s)`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  MANA
  // ════════════════════════════════════════════
  const takeManaFromSource = useCallback(
    (dieId: string) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const newMana = engine.manaPool.takeDieFromSource(state.player.mana, dieId, state.dayNight)
      let newState: GameState = {
        ...state,
        player: { ...state.player, mana: newMana },
      }
      newState = withLog(newState, 'mana_use', `Took mana die ${dieId} from source`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * Mana Draw played during combat (rulebook: mana-generating special effects
   * may be played in any combat phase). Applies ONLY the mana effect to the
   * pool — the card itself is consumed by the combat card system at combat end,
   * so the hand is left untouched here (no index desync with combat plays).
   *  - basic: gain one extra Source die usable this turn
   *  - strong: take a Source die, set it to a chosen colour, gain 2 mana tokens
   */
  const applyManaDrawInCombat = useCallback(
    (mode: 'basic' | 'strong', color?: import('@/engine/types').ExtendedManaColor) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.combat.isActive) return

      let newMana = state.player.mana
      if (mode === 'basic') {
        newMana = { ...newMana, extraSourceDice: (newMana.extraSourceDice ?? 0) + 1 }
      } else {
        if (!color || color === 'gold') return
        if (color === 'black' && state.dayNight !== 'night') return
        const dieIdx = newMana.dice.findIndex((d) => d.isInSource)
        if (dieIdx === -1) return // strong needs a die left in the Source
        newMana = {
          ...newMana,
          dice: newMana.dice.map((d, i) =>
            i === dieIdx ? { ...d, color, isInSource: false } : d,
          ),
          playerMana: [
            ...newMana.playerMana,
            { color, source: 'effect' as const },
            { color, source: 'effect' as const },
          ],
        }
      }
      let newState: GameState = { ...state, player: { ...state.player, mana: newMana } }
      newState = withLog(newState, 'mana_use', `Mana Draw (combat, ${mode})`)
      updateState(newState)
    },
    [updateState, withLog],
  )

  const useCrystal = useCallback(
    (color: ManaColor) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const newMana = engine.manaPool.useCrystalAsMana(state.player.mana, color)
      let newState: GameState = {
        ...state,
        player: { ...state.player, mana: newMana },
      }
      newState = withLog(newState, 'mana_use', `Used ${color} crystal as mana`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * Undo an active mana token (works in combat/interaction overlays where the
   * combat-tray undo only reverts card plays). Crystal-sourced tokens return to
   * the crystal inventory; die-sourced tokens return to the Source.
   * Effect/glade tokens cannot be undone.
   */
  const returnManaToken = useCallback(
    (index: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const token = state.player.mana.playerMana[index]
      if (!token || (token.source !== 'crystal' && token.source !== 'die')) return

      pushState(state)
      let newMana = engine.manaPool.removeManaToken(state.player.mana, index)

      if (token.source === 'crystal' && token.color !== 'gold' && token.color !== 'black') {
        const color = token.color as ManaColor
        newMana = {
          ...newMana,
          crystals: { ...newMana.crystals, [color]: newMana.crystals[color] + 1 },
        }
      } else if (token.source === 'die') {
        const dice = [...newMana.dice]
        const di = dice.findIndex((d) => !d.isInSource && d.color === token.color)
        if (di >= 0) {
          dice[di] = { ...dice[di], isInSource: true }
          newMana = { ...newMana, dice, sourceDieTakenThisTurn: false }
        }
      }

      let newState: GameState = { ...state, player: { ...state.player, mana: newMana } }
      newState = withLog(newState, 'mana_use', `Returned ${token.color} mana (${token.source})`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  COMBAT
  // ════════════════════════════════════════════
  const initiateCombat = useCallback(
    (enemies: EnemyToken[], isFortified: boolean, cityColor?: CityColor, hexCoord?: HexCoord) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const combat = engine.combatResolver.initiateCombat(enemies, isFortified, cityColor, hexCoord)
      let newState: GameState = {
        ...state,
        combat,
        phase: 'combat_ranged_siege' as GamePhase,
      }
      newState = withLog(newState, 'combat_start', `Combat initiated against ${enemies.length} enemy(ies)`, {
        isFortified,
        cityColor,
      })
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const endCombat = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    pushState(state)

    const resolvedCombat = engine.combatResolver.endCombat(state.combat)

    // Apply reputation change
    const newReputation = engine.reputationManager.changeReputation(
      state.player.reputation,
      resolvedCombat.reputationChange,
    )

    // Fame + level-up queueing (UNIT-10): stats apply immediately,
    // reward choices (skill/AA) are queued as pendingLevelUps for the UI.
    let newState = applyFameGain(engine, state, resolvedCombat.fameEarned)
    const leveledUp =
      (newState.pendingLevelUps?.length ?? 0) > (state.pendingLevelUps?.length ?? 0)

    // FIX 4: Apply combat damage from damageAssignments
    let newDeck = newState.player.deck
    let newUnits = [...newState.player.units]
    // Paralyze (rulebook, Special combat abilities): a Unit assigned damage by a
    // Paralyzing enemy that would be Wounded is destroyed instead; a Hero so
    // assigned must discard all non-Wound cards. Track these as we apply damage.
    const destroyedUnitIndices = new Set<number>()
    let heroParalyzed = false
    for (const assignment of state.combat.damageAssignments) {
      const sourceEnemy = state.combat.enemies.find(e => e.instanceId === assignment.enemyInstanceId)
      const isParalyzing = sourceEnemy?.appliedAbilities.includes('paralyze') ?? false
      for (const target of assignment.assignments) {
        if (target.targetType === 'hero' && target.woundsInflicted > 0) {
          newDeck = engine.deckManager.addWound(newDeck, target.woundsInflicted)
          if (isParalyzing) heroParalyzed = true
        } else if (target.targetType === 'unit' && target.unitInstanceIndex != null && target.woundsInflicted > 0) {
          const unitIdx = target.unitInstanceIndex
          if (unitIdx >= 0 && unitIdx < newUnits.length) {
            const targetUnit = newUnits[unitIdx]
            // Banner of Fortitude: once a round, flip to ignore the wound
            // and its additional effects entirely (also negates paralysis).
            if (
              targetUnit.bannerCard?.name === 'Banner of Fortitude' &&
              !targetUnit.bannerFlipped
            ) {
              newUnits = [
                ...newUnits.slice(0, unitIdx),
                { ...targetUnit, bannerFlipped: true },
                ...newUnits.slice(unitIdx + 1),
              ]
              newState = withLog(newState, 'combat_end', `Banner of Fortitude: ${targetUnit.unit.name} ignored a wound`)
              continue
            }
            // Paralyze: a Unit that would take a Wound is destroyed (removed from
            // the game), not merely wounded.
            if (isParalyzing) {
              destroyedUnitIndices.add(unitIdx)
              newState = withLog(newState, 'unit_disband', `${targetUnit.unit.name} destroyed by paralysis`)
              continue
            }
            // A Unit can hold at most one Wound (two cards under Poison) — the
            // damage-assign UI guarantees one assignment per Unit, but cap here
            // defensively so a Unit can never accumulate extra Wounds.
            newUnits = [
              ...newUnits.slice(0, unitIdx),
              {
                ...targetUnit,
                status: 'wounded' as const,
                woundCount: Math.min(targetUnit.woundCount + target.woundsInflicted, 2),
              },
              ...newUnits.slice(unitIdx + 1),
            ]
          }
        }
      }
    }

    // Remove units destroyed by paralysis (filter by original index in one pass).
    if (destroyedUnitIndices.size > 0) {
      newUnits = newUnits.filter((_, i) => !destroyedUnitIndices.has(i))
    }

    // Bug #5: Knock Out check — if wounds in hand >= handLimit, discard all non-wound cards
    const woundsInHand = newDeck.hand.filter(c => c.type === 'wound').length
    const knockedOut = woundsInHand >= newState.player.handLimit
    if (knockedOut || heroParalyzed) {
      const nonWoundCards = newDeck.hand.filter(c => c.type !== 'wound')
      const woundCards = newDeck.hand.filter(c => c.type === 'wound')
      newDeck = {
        ...newDeck,
        hand: woundCards,
        discardPile: [...newDeck.discardPile, ...nonWoundCards],
      }
      if (heroParalyzed && !knockedOut) {
        newState = withLog(newState, 'combat_end', 'Paralyzed — all non-Wound cards discarded')
      }
    }

    newState = {
      ...newState,
      combat: resolvedCombat,
      player: {
        ...newState.player,
        reputation: newReputation,
        deck: newDeck,
        units: newUnits,
      },
    }

    // Clear defeated enemies from the combat hex, conquer the site,
    // claim ownership (keep/mageTower/city), add shield token (city),
    // and queue site rewards (UNIT-07-G)
    const allDefeated = resolvedCombat.enemies.length > 0 && resolvedCombat.enemies.every(e => e.isDefeated)
    const combatHexCoord = state.combat.combatHexCoord
    if (allDefeated && combatHexCoord) {
      const combatHexKey = hexKey(combatHexCoord)
      const hexCell = newState.map.hexGrid.get(combatHexKey)
      if (hexCell) {
        const siteType = hexCell.site
        const isFortSite = siteType === 'keep' || siteType === 'mageTower' || siteType === 'city'
        const newHexGrid = new Map(newState.map.hexGrid)
        newHexGrid.set(combatHexKey, {
          ...hexCell,
          enemyTokens: [],
          siteData: hexCell.siteData
            ? {
                ...hexCell.siteData,
                isConquered: true,
                owner: isFortSite ? newState.player.name : hexCell.siteData.owner,
                shieldTokens: siteType === 'city'
                  ? hexCell.siteData.shieldTokens + 1
                  : hexCell.siteData.shieldTokens,
              }
            : hexCell.siteData,
        })
        const newConqueredSites = [...newState.player.conqueredSites]
        if (hexCell.site && hexCell.siteData && !hexCell.siteData.isConquered) {
          newConqueredSites.push({
            siteType: hexCell.site,
            tileId: hexCell.tileId,
            hexCoord: combatHexCoord,
            shieldTokens: siteType === 'city' ? 1 : 0,
          })
        }
        newState = {
          ...newState,
          map: { ...newState.map, hexGrid: newHexGrid },
          player: { ...newState.player, conqueredSites: newConqueredSites },
        }

        // UNIT-07-G: queue rewards for adventure sites
        const { rewards: siteRewards, artifactsConsumed } = buildSiteRewards(
          engine, siteType, newState.offers.artifactDeck,
        )
        if (siteRewards.length > 0) {
          newState = {
            ...newState,
            offers: {
              ...newState.offers,
              artifactDeck: newState.offers.artifactDeck.slice(artifactsConsumed),
            },
            pendingRewards: [...(newState.pendingRewards ?? []), ...siteRewards],
          }
          newState = withLog(newState, 'combat_end', `Site reward earned at ${siteType}`)
        }

        if (isFortSite) {
          newState = withLog(newState, 'site_conquer', 'logmsg.siteConquered', { site: siteType === 'city' ? `${hexCell.siteData?.cityColor ?? ''} city` : siteType })
        }

        // UNIT-12-B: all cities conquered → player gets exactly one more turn
        if (siteType === 'city') {
          const citiesConquered = newState.player.conqueredSites.filter(s => s.siteType === 'city').length
          if (citiesConquered >= 2 && !newState.finalTurnPending) {
            newState = { ...newState, finalTurnPending: true }
            newState = withLog(newState, 'game_end', 'All cities conquered — one final turn remains!')
          }
        }
      }
    } else if (combatHexCoord) {
      // Partial defeat (rulebook — Spawning Grounds / any multi-enemy site:
      // "Partial defeat leaves remaining enemy tokens in place"). Remove the
      // enemies that were defeated and keep the survivors on the hex so they
      // must be fought again on a later turn. No site reward is granted until
      // every enemy is defeated.
      const combatHexKey = hexKey(combatHexCoord)
      const hexCell = newState.map.hexGrid.get(combatHexKey)
      if (hexCell && hexCell.enemyTokens.length > 0) {
        const survivors = resolvedCombat.enemies
          .filter((e) => !e.isDefeated)
          .map((e) => e.token)
        if (survivors.length !== hexCell.enemyTokens.length) {
          const newHexGrid = new Map(newState.map.hexGrid)
          newHexGrid.set(combatHexKey, { ...hexCell, enemyTokens: survivors })
          newState = { ...newState, map: { ...newState.map, hexGrid: newHexGrid } }
        }
      }
    }

    if (knockedOut) {
      newState = withLog(newState, 'combat_end', 'Knock Out! All non-wound cards discarded')
    }

    newState = withLog(newState, 'combat_end', `Combat ended — earned ${resolvedCombat.fameEarned} fame`, {
      fameEarned: resolvedCombat.fameEarned,
      reputationChange: resolvedCombat.reputationChange,
      leveledUp,
    })

    // Advance phase
    const nextPhase = engine.turnManager.advancePhase('combat_end', { leveledUp })
    newState = { ...newState, phase: nextPhase }

    updateState(newState)
  }, [updateState, withLog, pushState])

  // ════════════════════════════════════════════
  //  LEVEL-UP REWARD RESOLUTION (UNIT-09/10)
  // ════════════════════════════════════════════
  /**
   * Resolve the head of the pendingLevelUps queue.
   * stat_boost      → acknowledge only (stats were applied when fame was gained).
   * skill + AA      → Choice A: take 1 of the 2 revealed skills + ANY card from the AA offer.
   *                   Choice B: take 1 from Common Skills + the BOTTOM card of the AA offer.
   *                   If the skill deck is exhausted, only the AA card is granted (EC-09-A-2).
   */
  const resolveLevelUp = useCallback(
    (params?: { choice?: 'A' | 'B'; skillIndex?: number; aaCardId?: number }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const queue = state.pendingLevelUps ?? []
      const pending = queue[0]
      if (!pending) return

      let newState: GameState = { ...state, pendingLevelUps: queue.slice(1) }

      if (pending.rewardType === 'advanced_action_and_skill') {
        const choice = params?.choice ?? 'A'
        const skillDeck = newState.player.skillDeck ?? []

        // ── Skill acquisition (skipped when the deck is empty, EC-09-A-2) ──
        if (skillDeck.length > 0) {
          try {
            const result = engine.skillManager.processSkillAcquisition(
              skillDeck,
              newState.player.commonSkillsAvailable,
              choice,
              params?.skillIndex ?? 0,
            )
            newState = {
              ...newState,
              player: {
                ...newState.player,
                skills: [...newState.player.skills, result.acquiredSkill],
                commonSkillsAvailable: result.newCommonSkills,
                skillDeck: result.remainingPlayerDeck,
              },
            }
            newState = withLog(newState, 'skill_gain', 'logmsg.skillLearned', { name: result.acquiredSkill.name })

            // Bonds of Loyalty: permanent extra Command token (unit limit +1)
            const commandBonus = result.acquiredSkill.actions.find(
              (a) => a.type === 'passive_command_bonus',
            )
            if (commandBonus && typeof commandBonus.extraCommand === 'number') {
              newState = {
                ...newState,
                player: {
                  ...newState.player,
                  unitLimit: newState.player.unitLimit + commandBonus.extraCommand,
                },
              }
              newState = withLog(newState, 'skill_gain', 'logmsg.bondsCommand', { count: commandBonus.extraCommand })
            }

            // EC-09-A-3: reveal one dummy skill into the Common Skills pool
            const dummySkillDeck = newState.dummyPlayer.skillDeck ?? []
            if (dummySkillDeck.length > 0) {
              const [revealed, ...restDummy] = dummySkillDeck
              newState = {
                ...newState,
                player: {
                  ...newState.player,
                  commonSkillsAvailable: [...newState.player.commonSkillsAvailable, revealed],
                },
                dummyPlayer: { ...newState.dummyPlayer, skillDeck: restDummy },
              }
              newState = withLog(newState, 'skill_gain', 'logmsg.dummySkillRevealed', { name: revealed.name })
            }
          } catch (error) {
            console.error('Skill acquisition failed:', error)
          }
        }

        // ── Advanced Action acquisition ──
        const aaOffer = newState.offers.advancedActions
        if (aaOffer.length > 0) {
          // Choice B may only take the bottom card of the offer (EC-09-A-4)
          const card = choice === 'B'
            ? aaOffer[aaOffer.length - 1]
            : aaOffer.find((c) => c.id === params?.aaCardId) ?? aaOffer[0]

          const newOffer = aaOffer.filter((c) => c.id !== card.id)
          const aaDeck = [...newState.offers.advancedActionDeck]
          if (aaDeck.length > 0) newOffer.unshift(aaDeck.shift()!)

          // EC-10-A-4: new AA goes on TOP of the deed deck (drawn later, not usable now)
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: {
                ...newState.player.deck,
                drawPile: [card, ...newState.player.deck.drawPile],
              },
            },
            offers: { ...newState.offers, advancedActions: newOffer, advancedActionDeck: aaDeck },
          }
          newState = withLog(newState, 'card_acquire', 'logmsg.aaOnDeck', { name: card.name })
        }
      }

      newState = withLog(newState, 'level_up', 'logmsg.levelReward', { level: pending.level })

      // Leave the level_up phase once every queued level-up has been resolved
      if ((newState.pendingLevelUps?.length ?? 0) === 0 && newState.phase === 'level_up') {
        newState = { ...newState, phase: engine.turnManager.advancePhase('level_up', {}) }
      }

      // A level-up reward (Skill / Advanced Action) is a permanent choice — once
      // taken it must not be undoable. Clear the undo stack to lock it in.
      clearUndoStack()
      updateState(newState)
    },
    [updateState, withLog, clearUndoStack],
  )

  // ════════════════════════════════════════════
  //  COMBAT / SITE REWARD CLAIMING (UNIT-07-G)
  // ════════════════════════════════════════════
  const claimReward = useCallback(
    (params?: {
      artifactKeepIds?: number[]
      spellCardId?: number
      crystalColor?: ManaColor
      chooseArtifact?: boolean
    }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const queue = state.pendingRewards ?? []
      const head = queue[0]
      if (!head) return

      let newState: GameState = { ...state, pendingRewards: queue.slice(1) }

      switch (head.type) {
        case 'artifact_choice': {
          // EC-07-G-1: keep pickCount, the rest goes to the bottom of the artifact deck
          const keepIds = params?.artifactKeepIds ?? head.options.slice(0, head.pickCount).map(c => c.id)
          const kept = head.options.filter(c => keepIds.includes(c.id)).slice(0, head.pickCount)
          const returned = head.options.filter(c => !kept.some(k => k.id === c.id))
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: { ...newState.player.deck, drawPile: [...kept, ...newState.player.deck.drawPile] },
            },
            offers: {
              ...newState.offers,
              artifactDeck: [...newState.offers.artifactDeck, ...returned],
            },
          }
          newState = withLog(newState, 'card_acquire', 'logmsg.artifactsGained', { name: kept.map(c => c.name).join(', ') })
          break
        }
        case 'spell_choice': {
          // EC-07-G-2: pick from the spell offer → top of deed deck, refill the offer
          const offer = newState.offers.spells
          if (offer.length === 0) break
          const card = offer.find(c => c.id === params?.spellCardId) ?? offer[0]
          const newOffer = offer.filter(c => c.id !== card.id)
          const spellDeck = [...newState.offers.spellDeck]
          if (spellDeck.length > 0) newOffer.unshift(spellDeck.shift()!)
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: { ...newState.player.deck, drawPile: [card, ...newState.player.deck.drawPile] },
            },
            offers: { ...newState.offers, spells: newOffer, spellDeck },
          }
          newState = withLog(newState, 'card_acquire', 'logmsg.spellGained', { name: card.name })
          break
        }
        case 'artifact_or_spell': {
          // Ancient Ruins: player chooses which reward to receive
          if (params?.chooseArtifact) {
            const options = newState.offers.artifactDeck.slice(0, 2)
            newState = {
              ...newState,
              offers: { ...newState.offers, artifactDeck: newState.offers.artifactDeck.slice(options.length) },
              pendingRewards: options.length > 0
                ? [{ type: 'artifact_choice', options, pickCount: 1 }, ...(newState.pendingRewards ?? [])]
                : newState.pendingRewards,
            }
          } else {
            newState = {
              ...newState,
              pendingRewards: [{ type: 'spell_choice' }, ...(newState.pendingRewards ?? [])],
            }
          }
          break
        }
        case 'crystal_roll': {
          // EC-07-G-4: basic color → crystal; gold → player picks color; black → +1 Fame
          if (head.rolledColor === 'black') {
            newState = applyFameGain(engine, newState, 1)
            newState = withLog(newState, 'fame_gain', 'logmsg.crystalRollBlack')
          } else {
            const color = head.rolledColor === 'gold'
              ? (params?.crystalColor ?? 'red')
              : head.rolledColor
            newState = {
              ...newState,
              player: {
                ...newState.player,
                mana: engine.manaPool.addCrystal(newState.player.mana, color),
              },
            }
            newState = withLog(newState, 'crystal_gain', 'logmsg.crystalGained', { color })
          }
          break
        }
        case 'unit_choice': {
          // EC-07-G-3: recruit any unit from the offer for free
          break
        }
      }

      updateState(newState)
    },
    [updateState, withLog],
  )

  // ════════════════════════════════════════════
  //  HEALING (EC-02-D-3, EC-03-B-7)
  // ════════════════════════════════════════════
  const healWound = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return
    if (state.combat.isActive) return // healing is unusable during combat
    const healing = state.player.turn.healingAvailable ?? 0
    if (healing <= 0) return

    const woundIdx = state.player.deck.hand.findIndex((c) => c.type === 'wound')
    if (woundIdx === -1) return

    pushState(state)

    // Healed wounds return to the wound pile (removed from the game state entirely)
    let deck: import('@/engine/types').DeckState = {
      ...state.player.deck,
      hand: state.player.deck.hand.filter((_, i) => i !== woundIdx),
    }
    // Cure (basic) / Golden Grail (strong): draw a card per Wound healed this turn.
    const drawPer = state.player.turn.drawPerWoundHeal ?? 0
    if (drawPer > 0) deck = engine.deckManager.drawCards(deck, drawPer)
    let newState: GameState = {
      ...state,
      player: {
        ...state.player,
        deck,
        turn: { ...state.player.turn, healingAvailable: healing - 1 },
      },
    }
    newState = withLog(newState, 'wound_heal', 'logmsg.healedHandWound')
    updateState(newState)
  }, [updateState, withLog, pushState])

  // ════════════════════════════════════════════
  //  SKILL ACTIVATION — out of combat (UNIT-09-B)
  // ════════════════════════════════════════════
  /**
   * Activate one action of an acquired skill outside combat.
   * Combat actions (attack/block/siege) are used via the combat card tray.
   * Supported here: move, influence (during interaction), healing,
   * gain_crystal, gain_mana_token, free_unit_activation (ready a unit).
   */
  const activateSkill = useCallback(
    (skillIndex: number, options?: {
      actionIndex?: number
      color?: ManaColor | 'black'
      unitIndex?: number
      cardIndex?: number
      tokenIndex?: number
      sidewaysEffect?: 'move' | 'influence'
    }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (state.combat.isActive) return // combat usage goes through the combat tray

      const skill = state.player.skills[skillIndex]
      if (!skill) return
      if (!engine.skillManager.canActivateSkill(skill)) return

      const action = skill.actions[options?.actionIndex ?? 0]
      if (!action) return

      // Day/Night-conditioned actions must match the current cycle
      if (action.condition === 'day' && state.dayNight !== 'day') return
      if (action.condition === 'night' && state.dayNight !== 'night') return

      const value = typeof action.value === 'number' ? action.value : 0
      let newState: GameState = { ...state }
      let applied = false
      let logMessage = `Used skill: ${skill.name}`

      switch (action.type) {
        case 'move':
          newState = {
            ...newState,
            player: {
              ...newState.player,
              turn: {
                ...newState.player.turn,
                movePointsAvailable: newState.player.turn.movePointsAvailable + value,
              },
            },
          }
          if (newState.phase === 'player_turn_start') {
            newState = { ...newState, phase: 'movement' as GamePhase }
          }
          logMessage += ` (+${value} Move)`
          applied = true
          break

        case 'influence':
          // Influence only matters inside an active interaction
          if (!newState.interaction?.isActive) return
          newState = {
            ...newState,
            interaction: engine.interactionManager.addInfluence(newState.interaction, value),
          }
          logMessage += ` (+${value} Influence)`
          applied = true
          break

        case 'healing':
        case 'heal_wounds':
          newState = {
            ...newState,
            player: {
              ...newState.player,
              turn: {
                ...newState.player.turn,
                healingAvailable: (newState.player.turn.healingAvailable ?? 0) + value,
              },
            },
          }
          logMessage += ` (+${value} Healing)`
          applied = true
          break

        case 'gain_crystal': {
          const color = (action.color as ManaColor | undefined) ?? options?.color
          if (!color || color === 'black') return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              mana: engine.manaPool.addCrystal(newState.player.mana, color as ManaColor),
            },
          }
          logMessage += ` (+1 ${color} crystal)`
          applied = true
          break
        }

        case 'gain_mana_token': {
          // Color may be a choice like "red_or_black" — UI passes the pick
          const colorSpec = (action.color as string | undefined) ?? ''
          const choices = colorSpec.split('_or_').filter(Boolean)
          const picked = options?.color ?? (choices.length === 1 ? (choices[0] as ManaColor | 'black') : undefined)
          if (!picked || (choices.length > 0 && !choices.includes(picked))) return
          // Black tokens only have meaning at night (EC-01-D)
          if (picked === 'black' && state.dayNight !== 'night') return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              mana: engine.manaPool.addManaToken(newState.player.mana, picked, 'effect'),
            },
          }
          logMessage += ` (+1 ${picked} mana)`
          applied = true
          break
        }

        case 'free_unit_activation': {
          // EC-08-A-5: "Ready a Unit" — a spent unit becomes ready again
          const unitIdx = options?.unitIndex ?? -1
          const unit = newState.player.units[unitIdx]
          if (!unit || unit.status !== 'spent') return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              units: newState.player.units.map((u, i) =>
                i === unitIdx ? { ...u, status: 'ready' as const } : u,
              ),
            },
          }
          logMessage += ` (readied ${unit.unit.name})`
          applied = true
          break
        }

        case 'move_per_ready_unit': {
          // Forward March: Move 1 per ready unwounded unit, capped at maxValue
          const per = value || 1
          const cap = typeof action.maxValue === 'number' ? action.maxValue : 3
          const readyUnits = newState.player.units.filter(
            (u) => u.status === 'ready' && u.woundCount === 0,
          ).length
          const gained = Math.min(readyUnits * per, cap)
          if (gained <= 0) return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              turn: {
                ...newState.player.turn,
                movePointsAvailable: newState.player.turn.movePointsAvailable + gained,
              },
            },
          }
          if (newState.phase === 'player_turn_start') {
            newState = { ...newState, phase: 'movement' as GamePhase }
          }
          logMessage += ` (+${gained} Move from ${readyUnits} ready unit(s))`
          applied = true
          break
        }

        case 'heal_unit_wound': {
          // Inspiration: heal 1 wound from a chosen unit (no healing-point cost)
          const unitIdx = options?.unitIndex ?? -1
          const target = newState.player.units[unitIdx]
          if (!target || target.woundCount === 0) return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              units: newState.player.units.map((u, i) =>
                i === unitIdx
                  ? {
                      ...u,
                      woundCount: u.woundCount - 1,
                      status: u.woundCount - 1 === 0 ? ('ready' as const) : u.status,
                    }
                  : u,
              ),
            },
          }
          logMessage += ` (healed 1 wound from ${target.unit.name})`
          applied = true
          break
        }

        case 'wound_as_card': {
          // Power of Pain: play one wound sideways for +bonusValue (default 2).
          // Outside combat the useful choices are Move and Influence;
          // attack/block versions are offered in the combat card tray.
          const bonus = typeof action.bonusValue === 'number' ? action.bonusValue : 2
          const choice = options?.sidewaysEffect
          if (!choice) return
          const woundIdx = newState.player.deck.hand.findIndex((c) => c.type === 'wound')
          if (woundIdx === -1) return
          if (choice === 'influence' && !newState.interaction?.isActive) return

          // The wound is played to the play area → ends in the discard pile
          // at end of turn (matches the skill text)
          const newDeck = engine.deckManager.playCard(newState.player.deck, woundIdx)
          newState = { ...newState, player: { ...newState.player, deck: newDeck } }

          if (choice === 'move') {
            newState = {
              ...newState,
              player: {
                ...newState.player,
                turn: {
                  ...newState.player.turn,
                  movePointsAvailable: newState.player.turn.movePointsAvailable + bonus,
                },
              },
            }
            if (newState.phase === 'player_turn_start') {
              newState = { ...newState, phase: 'movement' as GamePhase }
            }
          } else {
            newState = {
              ...newState,
              interaction: engine.interactionManager.addInfluence(newState.interaction!, bonus),
            }
          }
          logMessage += ` (wound played sideways for +${bonus} ${choice})`
          applied = true
          break
        }

        case 'mana_conversion': {
          // Polarization: treat one mana token as its opposite color
          // (red↔blue, green↔white, gold↔black)
          const OPPOSITE: Record<string, ManaColor | 'gold' | 'black'> = {
            red: 'blue', blue: 'red', green: 'white', white: 'green', gold: 'black', black: 'gold',
          }
          const tokenIdx = options?.tokenIndex ?? -1
          const token = newState.player.mana.playerMana[tokenIdx]
          if (!token) return
          const converted = OPPOSITE[token.color]
          if (!converted) return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              mana: {
                ...newState.player.mana,
                playerMana: newState.player.mana.playerMana.map((t, i) =>
                  i === tokenIdx ? { ...t, color: converted } : t,
                ),
              },
            },
          }
          logMessage += ` (${token.color} → ${converted})`
          applied = true
          break
        }

        case 'discard_wound_for_mana': {
          // Invocation: discard a wound → red or black mana token
          const colorSpec = (action.color as string | undefined) ?? 'red_or_black'
          const choices = colorSpec.split('_or_')
          const picked = options?.color
          if (!picked || !choices.includes(picked)) return
          if (picked === 'black' && state.dayNight !== 'night') return
          const woundIdx = newState.player.deck.hand.findIndex((c) => c.type === 'wound')
          if (woundIdx === -1) return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: engine.deckManager.discardFromHandForced(newState.player.deck, woundIdx),
              mana: engine.manaPool.addManaToken(newState.player.mana, picked, 'effect'),
            },
          }
          logMessage += ` (discarded wound for ${picked} mana)`
          applied = true
          break
        }

        case 'discard_card_for_mana': {
          // Invocation: discard a non-wound card → white or green mana token
          const colorSpec = (action.color as string | undefined) ?? 'white_or_green'
          const choices = colorSpec.split('_or_')
          const picked = options?.color
          if (!picked || !choices.includes(picked)) return
          const cardIdx = options?.cardIndex ?? -1
          const card = newState.player.deck.hand[cardIdx]
          if (!card || card.type === 'wound') return
          newState = {
            ...newState,
            player: {
              ...newState.player,
              deck: engine.deckManager.discardFromHand(newState.player.deck, cardIdx),
              mana: engine.manaPool.addManaToken(newState.player.mana, picked, 'effect'),
            },
          }
          logMessage += ` (discarded ${card.name} for ${picked} mana)`
          applied = true
          break
        }

        default:
          // Unsupported action type
          return
      }

      if (!applied) return

      pushState(state)
      newState = {
        ...newState,
        player: {
          ...newState.player,
          skills: engine.skillManager.activateSkill(newState.player.skills, skillIndex, { isNewTurn: false }),
        },
      }
      newState = withLog(newState, 'skill_use', logMessage)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * EC-02-C-3: play a Banner artifact by attaching it to a unit.
   * The card leaves the hand and sits on the unit (not the play area);
   * the unit gains the banner's passive bonuses, and powered (mana-cost)
   * abilities become unusable while the banner is attached (EC-08-B-1).
   */
  const attachBanner = useCallback(
    (handIndex: number, unitIndex: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      const card = state.player.deck.hand[handIndex]
      if (!card || card.type !== 'artifact' || card.subtype !== 'banner') return
      const unit = state.player.units[unitIndex]
      if (!unit || unit.bannerCard) return // one banner per unit

      pushState(state)

      const newHand = state.player.deck.hand.filter((_, i) => i !== handIndex)
      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          deck: { ...state.player.deck, hand: newHand },
          units: state.player.units.map((u, i) =>
            i === unitIndex ? { ...u, bannerCard: card, bannerId: String(card.id) } : u,
          ),
          turn: {
            ...state.player.turn,
            cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn, String(card.id)],
          },
        },
      }
      newState = withLog(newState, 'card_play', `Attached ${card.name} to ${unit.unit.name}`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * EC-08-A-3/4: healing a unit costs (unit level × wound count) healing
   * points — poison wounds double the bill. Heals the unit completely.
   */
  const healUnit = useCallback(
    (unitIndex: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (state.combat.isActive) return // healing is unusable during combat

      const unit = state.player.units[unitIndex]
      if (!unit || unit.woundCount === 0) return

      const healing = state.player.turn.healingAvailable ?? 0
      const cost = unit.unit.level * unit.woundCount
      if (healing < cost) return

      pushState(state)

      const newUnits = engine.unitManager.healUnit(state.player.units, unitIndex)
      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          units: newUnits,
          turn: { ...state.player.turn, healingAvailable: healing - cost },
        },
      }
      newState = withLog(newState, 'wound_heal', 'logmsg.unitHealed', { name: unit.unit.name, cost })
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  ROUND / GAME LIFECYCLE
  // ════════════════════════════════════════════
  const processEndOfRound = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    clearUndoStack()

    const result = engine.turnManager.processEndOfRound({
      currentRound: state.round,
      totalRounds: state.totalRounds,
      roundPattern: state.roundPattern,
    })

    if (result.isGameOver) {
      let newState: GameState = {
        ...state,
        isGameOver: true,
        phase: 'game_over' as GamePhase,
      }
      newState = withLog(newState, 'game_end', 'Game is over!')
      updateState(newState)
      return
    }

    // Re-roll mana source
    const newMana = engine.manaPool.rerollSource(state.player.mana)

    // Return Sparing Power stored cards to deck before reshuffling
    let preDeck = state.player.deck
    const currentTactic = state.player.currentTactic
    if (currentTactic?.id === 12 && currentTactic.storedCards && currentTactic.storedCards.length > 0) {
      preDeck = {
        ...preDeck,
        discardPile: [...preDeck.discardPile, ...currentTactic.storedCards],
      }
    }

    // Reshuffle player discard into draw pile and draw new hand
    let newDeck = engine.deckManager.reshuffleDiscard(preDeck)
    newDeck = engine.deckManager.drawToHandLimit(newDeck, state.player.handLimit)

    // Ready all units at round start (UNIT-08-A); flipped banners turn face up
    const newUnits = engine.unitManager
      .readyAllUnits(state.player.units)
      .map((u) => (u.bannerFlipped ? { ...u, bannerFlipped: false } : u))

    // Reset round-scoped skills at round start (UNIT-09-B)
    const newSkills = engine.skillManager.resetSkillsForRound(state.player.skills)

    // Refresh offers per rule 17.4
    const currentOffers = state.offers
    let newOffers: OfferState = { ...currentOffers }

    // AA: remove bottom card, shift down, draw new from deck on top
    let removedAACard = null
    if (currentOffers.advancedActions.length > 0) {
      const aaOffer = [...currentOffers.advancedActions]
      removedAACard = aaOffer.pop()!
      const aaDeck = [...currentOffers.advancedActionDeck]
      if (aaDeck.length > 0) {
        aaOffer.unshift(aaDeck.shift()!)
      }
      newOffers = { ...newOffers, advancedActions: aaOffer, advancedActionDeck: aaDeck }
    }

    // Spell: remove bottom card → put at bottom of deck, draw new from top
    let removedSpellColor: ManaColor | null = null
    if (currentOffers.spells.length > 0) {
      const spellOffer = [...currentOffers.spells]
      const removedSpell = spellOffer.pop()!
      const spellColor = removedSpell.color
      removedSpellColor = Array.isArray(spellColor) ? spellColor[0] : spellColor
      const spellDeck = [...currentOffers.spellDeck, removedSpell]
      if (spellDeck.length > 0) {
        spellOffer.unshift(spellDeck.shift()!)
      }
      newOffers = { ...newOffers, spells: spellOffer, spellDeck }
    }

    // Unit offer: FULL replacement each round (EC-04-A step 3) — old units go to
    // the bottom of their decks, AA cards back to the AA deck, then deal fresh.
    {
      const regDeck = [...newOffers.regularUnitDeck]
      const eliteDeck = [...newOffers.eliteUnitDeck]
      const aaDeck = [...newOffers.advancedActionDeck]
      for (const item of currentOffers.units) {
        if (item.type === 'advanced_action') {
          aaDeck.push(item as import('@/engine/types').AdvancedActionCard)
        } else if ('tier' in item && item.tier === 'elite') {
          eliteDeck.push(item)
        } else if ('tier' in item) {
          regDeck.push(item)
        }
      }

      // EC-04-A-3: before any Core tile is revealed only Regular units appear;
      // afterwards Regular/Elite alternate.
      const coreRevealed = state.map.tiles.some((t) => t.type === 'core' && t.isRevealed)
      const slots = engine.config.unitOfferSlots ?? 4
      const freshUnits: OfferState['units'] = []
      for (let i = 0; i < slots; i++) {
        if (coreRevealed && i % 2 === 1 && eliteDeck.length > 0) {
          freshUnits.push(eliteDeck.shift()!)
        } else if (regDeck.length > 0) {
          freshUnits.push(regDeck.shift()!)
        } else if (eliteDeck.length > 0) {
          freshUnits.push(eliteDeck.shift()!)
        }
      }

      // EC-04-A-5: add one AA card to the unit offer per revealed monastery
      let monasteries = 0
      for (const hex of state.map.hexGrid.values()) {
        if (hex.isRevealed && hex.site === 'monastery') monasteries++
      }
      for (let i = 0; i < monasteries && aaDeck.length > 0; i++) {
        freshUnits.push(aaDeck.shift()!)
      }

      newOffers = {
        ...newOffers,
        units: freshUnits,
        regularUnitDeck: regDeck,
        eliteUnitDeck: eliteDeck,
        advancedActionDeck: aaDeck,
      }
    }

    const newDummy = engine.dummyPlayer.processRoundStartForDummy(
      state.dummyPlayer,
      removedAACard,
      removedSpellColor,
    )

    const nextDayNight = result.nextDayNight

    // Tactics refresh every Round (rulebook, Tactics phase): used tactic cards
    // are returned, so all six cards of the new Round's time (Day/Night) are
    // available again. Without this the pool depletes after ~3 rounds and the
    // Tactics phase has no cards to offer, leaving the game stuck at round_start.
    const tacticsRaw = getTactics()
    const refreshedTactics = [
      ...tacticsRaw.dayTactics.map(toTacticCard),
      ...tacticsRaw.nightTactics.map(toTacticCard),
    ]

    let newState: GameState = {
      ...state,
      round: result.nextRound,
      dayNight: nextDayNight,
      phase: 'round_start' as GamePhase,
      availableTactics: refreshedTactics,
      player: {
        ...state.player,
        deck: newDeck,
        mana: newMana,
        units: newUnits,
        skills: newSkills,
        currentTactic: null,
        turn: {
          ...state.player.turn,
          endOfRoundDeclared: false,
          extraTurnGranted: false,
        },
      },
      dummyPlayer: newDummy,
      offers: newOffers,
    }
    newState = withLog(newState, 'round_start', `Round ${result.nextRound} begins — ${nextDayNight}`)
    updateState(newState)
  }, [updateState, withLog, clearUndoStack])

  // FIX 3: Guard against re-fire when finalScore already set
  const calculateFinalScore = useCallback((): FinalScore | null => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return null

    // Guard: prevent duplicate calculation
    if (state.finalScore != null) return state.finalScore

    const score = engine.scoringCalculator.calculateSoloConquestScore({
      playerName: state.player.heroName,
      fame: state.player.fame,
      citiesConquered: state.player.conqueredSites.filter(s => s.siteType === 'city').length,
      totalCities: 2, // Solo Conquest has 2 cities
      allCitiesConquered: state.player.conqueredSites.filter(s => s.siteType === 'city').length >= 2,
      roundsRemaining: state.totalRounds - state.round,
      dummyRemainingCards: engine.dummyPlayer.getDummyRemainingCards(state.dummyPlayer),
      didNotDeclareEndOfRound: !state.player.turn.endOfRoundDeclared,
    })

    let newState: GameState = {
      ...state,
      finalScore: score,
      isGameOver: true,
      phase: 'game_over' as GamePhase,
    }
    newState = withLog(newState, 'game_end', `Final score: ${score.totalScore}`, {
      score,
    })
    updateState(newState)

    return score
  }, [updateState, withLog])

  const selectTactic = useCallback(
    (tacticId: number, tacticOptions?: {
      rethinkDiscardIndices?: number[]
      manaStealDieId?: string
      preparationCardIndex?: number
    }) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const eligibleTactics = state.availableTactics.filter(
        (t) => t.type === state.dayNight,
      )

      // UNIT-04-B: Dummy picks first randomly, player picks from remaining.
      // If dummy randomly picks the same tactic the player wants, re-pick dummy
      // from the remaining pool to avoid conflict (player's UI choice takes priority).
      let dummyTactic: import('@/engine/types').TacticCard | null = null
      let playerPool = eligibleTactics

      if (eligibleTactics.length > 0) {
        const firstDummy = engine.turnManager.selectTacticForDummy(eligibleTactics)
        if (firstDummy.selected.id === tacticId) {
          const otherEligible = eligibleTactics.filter(t => t.id !== tacticId)
          if (otherEligible.length > 0) {
            const rePick = engine.turnManager.selectTacticForDummy(otherEligible)
            dummyTactic = rePick.selected
            playerPool = eligibleTactics.filter(t => t.id !== rePick.selected.id)
          }
          // else: only 1 tactic — dummy gets none, player pool = full eligibleTactics
        } else {
          dummyTactic = firstDummy.selected
          playerPool = firstDummy.remaining
        }
      }

      const playerResult = engine.turnManager.selectTacticForPlayer(playerPool, tacticId)

      const usedIds = new Set([playerResult.selected.id])
      if (dummyTactic) usedIds.add(dummyTactic.id)
      const remainingTactics = state.availableTactics.filter(
        (t) => !usedIds.has(t.id),
      )

      let selectedTactic = playerResult.selected
      let currentDeck = state.player.deck
      let currentMana = state.player.mana

      const tacticResult = engine.tacticEffectManager.applyOnSelectEffect(
        selectedTactic,
        currentDeck,
        currentMana,
        tacticOptions,
      )

      if (tacticResult.deck) currentDeck = tacticResult.deck
      if (tacticResult.mana) currentMana = tacticResult.mana
      if (tacticResult.tactic) selectedTactic = tacticResult.tactic

      const newUsedTactics = dummyTactic
        ? [...state.usedTactics, dummyTactic, selectedTactic]
        : [...state.usedTactics, selectedTactic]

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          currentTactic: selectedTactic,
          deck: currentDeck,
          mana: currentMana,
        },
        dummyPlayer: { ...state.dummyPlayer, tacticCard: dummyTactic },
        availableTactics: remainingTactics,
        usedTactics: newUsedTactics,
      }
      newState = withLog(newState, 'tactic_select', `Selected tactic: ${selectedTactic.name}`, {
        playerTactic: selectedTactic.name,
        dummyTactic: dummyTactic?.name ?? 'none',
      })

      if (tacticResult.log) {
        newState = withLog(newState, 'tactic_select', tacticResult.log)
      }

      const nextPhase = engine.turnManager.advancePhase('tactic_selection', {})
      newState = { ...newState, phase: nextPhase }

      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  INTERACTION
  // ════════════════════════════════════════════
  const INTERACTION_SITE_TYPES: SiteType[] = ['village', 'monastery', 'keep', 'mageTower', 'city']

  const startInteraction = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine) return

    const playerPos = state.player.position
    const hex = state.map.hexGrid.get(hexKey(playerPos))
    if (!hex?.siteData) return

    const siteType = hex.siteData.type
    if (!INTERACTION_SITE_TYPES.includes(siteType)) return

    const isConquered = hex.siteData.isConquered
    const isOwner = hex.siteData.owner === state.player.name

    if (siteType === 'keep' && !isOwner) return
    if (siteType === 'mageTower' && !isConquered) return
    if (siteType === 'city' && !isConquered) return

    pushState(state)

    try {
      const interactionState = engine.interactionManager.startInteraction(
        state.player.reputation,
        siteType as InteractionSiteType,
        playerPos,
        hex.siteData.cityColor,
        hex.siteData.shieldTokens,
      )

      let newState: GameState = {
        ...state,
        phase: 'interaction' as GamePhase,
        interaction: interactionState,
      }
      newState = withLog(newState, 'interaction', `Started interaction at ${siteType}`)
      updateState(newState)
    } catch (error) {
      console.error('Failed to start interaction:', error)
    }
  }, [updateState, withLog, pushState])

  const addInteractionInfluence = useCallback(
    (amount: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return

      pushState(state)

      const newInteraction = engine.interactionManager.addInfluence(state.interaction, amount)
      let newState: GameState = {
        ...state,
        interaction: newInteraction,
      }
      newState = withLog(newState, 'interaction', `Added ${amount} influence (total: ${newInteraction.influencePool})`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const purchaseHealing = useCallback(
    (count: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return

      const healingCost = engine.interactionManager.getHealingCost(state.interaction.siteType)
      if (healingCost < 0) return

      const totalCost = healingCost * count

      pushState(state)

      try {
        let interaction = engine.interactionManager.spendInfluence(
          state.interaction, totalCost, 'healing',
        )

        let newDeck = { ...state.player.deck }
        let healed = 0
        for (let i = 0; i < count; i++) {
          const woundIndex = newDeck.hand.findIndex(c => c.type === 'wound')
          if (woundIndex === -1) break
          newDeck = {
            ...newDeck,
            hand: newDeck.hand.filter((_, idx) => idx !== woundIndex),
          }
          healed++
        }

        if (healed === 0) return

        interaction = { ...interaction, purchasesMade: interaction.purchasesMade.map((p, i) =>
          i === interaction.purchasesMade.length - 1 ? { ...p, itemName: `${healed} wound(s)` } : p
        )}

        let newState: GameState = {
          ...state,
          player: { ...state.player, deck: newDeck },
          interaction,
        }
        newState = withLog(newState, 'wound_heal', 'logmsg.woundsHealedInfluence', { count: healed, cost: totalCost })
        updateState(newState)
      } catch (error) {
        console.error('Failed to purchase healing:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  const purchaseUnit = useCallback(
    (unit: AnyUnit) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return

      pushState(state)

      // Bonds of Loyalty: the unit recruited to the bonus Command token
      // (i.e. filling the last slot) costs 5 less Influence
      const hasBonds = state.player.skills.some((sk) =>
        sk.actions.some((a) => a.type === 'passive_command_bonus'),
      )
      const fillingBonusSlot = hasBonds && state.player.units.length === state.player.unitLimit - 1
      const cost = fillingBonusSlot ? Math.max(0, unit.cost - 5) : unit.cost

      try {
        const interaction = engine.interactionManager.spendInfluence(
          state.interaction, cost, 'unit', unit.id, unit.name,
        )

        const newUnits = engine.unitManager.recruitUnit(
          state.player.units, unit, state.player.unitLimit,
        )
        const newOfferUnits = state.offers.units.filter(u => u.id !== unit.id)

        let newState: GameState = {
          ...state,
          player: { ...state.player, units: newUnits },
          offers: { ...state.offers, units: newOfferUnits },
          interaction,
        }
        newState = withLog(newState, 'unit_recruit', 'logmsg.unitRecruitedCost', { name: unit.name, cost: unit.cost })
        updateState(newState)
      } catch (error) {
        console.error('Failed to purchase unit:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  const purchaseAdvancedAction = useCallback(
    (cardId: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return

      const card = state.offers.advancedActions.find(c => c.id === cardId)
      if (!card) return

      pushState(state)

      try {
        const interaction = engine.interactionManager.spendInfluence(
          state.interaction, 6, 'advanced_action', card.id, card.name,
        )

        const newOfferCards = state.offers.advancedActions.filter(c => c.id !== cardId)
        const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

        let newState: GameState = {
          ...state,
          player: { ...state.player, deck: newDeck },
          offers: { ...state.offers, advancedActions: newOfferCards },
          interaction,
        }
        newState = withLog(newState, 'card_acquire', 'logmsg.aaLearned', { name: card.name })
        updateState(newState)
      } catch (error) {
        console.error('Failed to purchase advanced action:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  /**
   * EC-06-B-2: Monastery AA training picks from the UNIT offer (where one AA
   * per revealed monastery is placed at round start), not the AA offer.
   * EC-06-B-5: the slot is NOT refilled until next round.
   */
  const purchaseMonasteryAA = useCallback(
    (cardId: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return
      if (state.interaction.siteType !== 'monastery') return

      const card = state.offers.units.find(
        (u): u is import('@/engine/types').AdvancedActionCard =>
          u.type === 'advanced_action' && u.id === cardId,
      )
      if (!card) return

      pushState(state)

      try {
        const interaction = engine.interactionManager.spendInfluence(
          state.interaction, 6, 'advanced_action', card.id, card.name,
        )

        const newUnits = state.offers.units.filter(
          (u) => !(u.type === 'advanced_action' && u.id === cardId),
        )
        const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

        let newState: GameState = {
          ...state,
          player: { ...state.player, deck: newDeck },
          offers: { ...state.offers, units: newUnits },
          interaction,
        }
        newState = withLog(newState, 'card_acquire', 'logmsg.aaLearnedMonastery', { name: card.name })
        updateState(newState)
      } catch (error) {
        console.error('Failed to purchase monastery advanced action:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  const purchaseSpell = useCallback(
    (cardId: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine || !state.interaction?.isActive) return

      const card = state.offers.spells.find(c => c.id === cardId)
      if (!card) return

      const spellColor = Array.isArray(card.color) ? card.color[0] : card.color

      const newMana = engine.manaPool.spendManaOfColor(
        state.player.mana, spellColor, state.dayNight,
      )
      if (!newMana) {
        console.error(`No ${spellColor} mana available to learn spell ${card.name}`)
        return
      }

      pushState(state)

      try {
        const interaction = engine.interactionManager.spendInfluence(
          state.interaction, 7, 'spell', card.id, card.name,
        )

        const newOfferCards = state.offers.spells.filter(c => c.id !== cardId)
        const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

        let newState: GameState = {
          ...state,
          player: { ...state.player, deck: newDeck, mana: newMana },
          offers: { ...state.offers, spells: newOfferCards },
          interaction,
        }
        newState = withLog(newState, 'card_acquire', 'logmsg.spellLearned', { name: card.name, color: spellColor })
        updateState(newState)
      } catch (error) {
        console.error('Failed to purchase spell:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  const purchaseArtifact = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine || !state.interaction?.isActive) return

    const artifactDeck = state.offers.artifactDeck
    if (artifactDeck.length === 0) return

    pushState(state)

    try {
      const interaction = engine.interactionManager.spendInfluence(
        state.interaction, 12, 'artifact', artifactDeck[0].id, artifactDeck[0].name,
      )

      const card = artifactDeck[0]
      const newArtifactDeck = artifactDeck.slice(1)
      const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck },
        offers: { ...state.offers, artifactDeck: newArtifactDeck },
        interaction,
      }
      newState = withLog(newState, 'card_acquire', 'logmsg.artifactBought', { name: card.name })
      updateState(newState)
    } catch (error) {
      console.error('Failed to purchase artifact:', error)
    }
  }, [updateState, withLog, pushState])

  /**
   * White City: pay 2 Influence to add the top Elite unit to the offer for
   * this interaction (UNIT-06-B White City rule).
   */
  const payForEliteOffer = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine || !state.interaction?.isActive) return
    if (state.interaction.siteType !== 'city' || state.interaction.cityColor !== 'white') return
    if (state.interaction.influencePool < 2) return
    if (state.offers.eliteUnitDeck.length === 0) return

    pushState(state)

    try {
      const interaction = engine.interactionManager.spendInfluence(
        state.interaction, 2, 'unit', undefined, 'Elite offer',
      )
      const elite = state.offers.eliteUnitDeck[0]
      let newState: GameState = {
        ...state,
        offers: {
          ...state.offers,
          units: [...state.offers.units, elite],
          eliteUnitDeck: state.offers.eliteUnitDeck.slice(1),
        },
        interaction,
      }
      newState = withLog(newState, 'interaction', `White City: revealed elite unit ${elite.name} for 2 influence`)
      updateState(newState)
    } catch (error) {
      console.error('Failed to reveal elite unit:', error)
    }
  }, [updateState, withLog, pushState])

  const plunderVillage = useCallback(() => {
    const state = sharedState
    const engine = sharedEngine
    if (!state || !engine || !state.interaction?.isActive) return
    if (state.interaction.siteType !== 'village') return
    // Rulebook: a village may be plundered only once per turn.
    if (state.player.turn.hasPlunderedThisTurn) return

    const newReputation = engine.reputationManager.changeReputation(state.player.reputation, -1)
    const newDeck = engine.deckManager.drawCards(state.player.deck, 2)

    let newState: GameState = {
      ...state,
      player: {
        ...state.player,
        reputation: newReputation,
        deck: newDeck,
        turn: { ...state.player.turn, hasPlunderedThisTurn: true },
      },
    }
    newState = withLog(newState, 'interaction', 'Plundered village: drew 2 cards and lost 1 reputation')
    updateState(newState)
    // Plunder draws 2 cards — hidden information is revealed, so it is a commit
    // point: neither the plunder nor any earlier action can be undone (you
    // cannot "unsee" the drawn cards). Mirrors tile exploration.
    clearUndoStack()
  }, [updateState, withLog, clearUndoStack])

  const endInteraction = useCallback(() => {
    const state = sharedState
    if (!state || !state.interaction?.isActive) return

    pushState(state)

    let newState: GameState = {
      ...state,
      phase: 'end_of_turn' as GamePhase,
      interaction: null,
    }
    newState = withLog(newState, 'interaction', 'Ended interaction')
    updateState(newState)
  }, [updateState, withLog, pushState])

  /**
   * Banner of Courage (basic): once a round, outside combat, flip the banner
   * to ready the unit it is attached to. Flips back at round start.
   */
  const useBannerAbility = useCallback(
    (unitIndex: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      if (state.combat.isActive) return
      const unit = state.player.units[unitIndex]
      if (!unit?.bannerCard || unit.bannerFlipped) return
      if (unit.bannerCard.name !== 'Banner of Courage') return
      if (unit.status !== 'spent') return

      pushState(state)

      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          units: state.player.units.map((u, i) =>
            i === unitIndex ? { ...u, status: 'ready' as const, bannerFlipped: true } : u,
          ),
        },
      }
      newState = withLog(newState, 'unit_activate', `Banner of Courage: readied ${unit.unit.name}`)
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  /**
   * EC-06-C-1/2: disband a unit (to make room at the Command limit).
   * EC-06-C-4: an attached banner goes to the discard pile.
   */
  const disbandUnit = useCallback(
    (unitIndex: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return
      const unit = state.player.units[unitIndex]
      if (!unit) return

      pushState(state)

      let newDeck = state.player.deck
      if (unit.bannerCard) {
        newDeck = { ...newDeck, discardPile: [...newDeck.discardPile, unit.bannerCard] }
      }
      let newState: GameState = {
        ...state,
        player: {
          ...state.player,
          deck: newDeck,
          units: engine.unitManager.disbandUnit(state.player.units, unitIndex),
        },
      }
      newState = withLog(
        newState,
        'unit_disband',
        `Disbanded ${unit.unit.name}${unit.bannerCard ? ` (${unit.bannerCard.name} returned to discard)` : ''}`,
      )
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  RECRUITMENT & ACQUISITION
  // ════════════════════════════════════════════
  const recruitUnit = useCallback(
    (unit: AnyUnit) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      try {
        const newUnits = engine.unitManager.recruitUnit(
          state.player.units,
          unit,
          state.player.unitLimit,
        )
        const newOfferUnits = state.offers.units.filter((u) => u.id !== unit.id)

        let newState: GameState = {
          ...state,
          player: { ...state.player, units: newUnits },
          offers: { ...state.offers, units: newOfferUnits },
        }
        newState = withLog(newState, 'unit_recruit', 'logmsg.unitRecruited', { name: unit.name })
        updateState(newState)
      } catch (error) {
        console.error('Failed to recruit unit:', error)
      }
    },
    [updateState, withLog, pushState],
  )

  const acquireAdvancedAction = useCallback(
    (cardId: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const card = state.offers.advancedActions.find((c) => c.id === cardId)
      if (!card) {
        console.error(`Advanced action card ${cardId} not found in offers`)
        return
      }

      const newOfferCards = state.offers.advancedActions.filter((c) => c.id !== cardId)
      const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck },
        offers: { ...state.offers, advancedActions: newOfferCards },
      }
      newState = withLog(newState, 'card_acquire', 'logmsg.aaAcquired', { name: card.name })
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  const acquireSpell = useCallback(
    (cardId: number) => {
      const state = sharedState
      const engine = sharedEngine
      if (!state || !engine) return

      pushState(state)

      const card = state.offers.spells.find((c) => c.id === cardId)
      if (!card) {
        console.error(`Spell card ${cardId} not found in offers`)
        return
      }

      const newOfferCards = state.offers.spells.filter((c) => c.id !== cardId)
      const newDeck = engine.deckManager.addCardToTopOfDeck(state.player.deck, card)

      let newState: GameState = {
        ...state,
        player: { ...state.player, deck: newDeck },
        offers: { ...state.offers, spells: newOfferCards },
      }
      newState = withLog(newState, 'card_acquire', 'logmsg.spellAcquired', { name: card.name })
      updateState(newState)
    },
    [updateState, withLog, pushState],
  )

  // ════════════════════════════════════════════
  //  UNDO
  // ════════════════════════════════════════════
  const undoLastAction = useCallback((): boolean => {
    const previous = undo()
    if (!previous) return false
    updateState(previous)
    return true
  }, [undo, updateState])

  // ════════════════════════════════════════════
  //  RETURN VALUE
  // ════════════════════════════════════════════
  return {
    gameState: engineState,
    isInitialized: engineState !== null,

    initializeGame,
    restoreGame,
    advancePhase,
    processEndOfRound,
    calculateFinalScore,

    startTurn,
    endTurn,
    declareRest,
    declareEndOfRound,

    getReachableHexes,
    movePlayer,
    canExploreTile,
    getExplorePlacements,
    exploreTile,

    playCard,
    playCardWithDiscard,
    playOffering,
    playComboCard,
    discardCard,
    drawCards,

    playSidewaysCard,
    activateUnit,
    takeManaFromSource,
    applyManaDrawInCombat,
    useCrystal,
    returnManaToken,

    initiateCombat,
    endCombat,
    resolveLevelUp,
    claimReward,
    healWound,
    healUnit,
    activateSkill,
    attachBanner,
    useBannerAbility,
    disbandUnit,

    selectTactic,
    activateTacticEffect,

    recruitUnit,
    acquireAdvancedAction,
    acquireSpell,

    startInteraction,
    addInteractionInfluence,
    purchaseHealing,
    purchaseUnit,
    purchaseAdvancedAction,
    purchaseMonasteryAA,
    purchaseSpell,
    purchaseArtifact,
    payForEliteOffer,
    plunderVillage,
    endInteraction,

    undoLastAction,
    canUndo,

    updateState,
    initializeTutorial,
  }
}
