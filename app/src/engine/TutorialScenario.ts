// ═══════════════════════════════════════════
// Tutorial Scenario Builder
// ═══════════════════════════════════════════

import type { GameState, MapState, EnemyPoolState } from './GameState'
import {
  INITIAL_COMBAT_STATE,
  INITIAL_TURN_STATE,
  INITIAL_CRYSTALS,
  hexKey,
  INITIAL_DECK_STATE,
} from './GameState'
import type {
  BasicActionCard,
  EnemyToken,
  HexCell,
  ManaDie,
  PlayerState,
  DummyPlayerState,
  OfferState,
  AnyCard,
  ManaPoolState,
  DeckState,
} from './types'
import { getBasicActions, getEnemies, getAdvancedActions, getSpells, getRegularUnits, getEliteUnits } from '@/data/loader'

/**
 * Creates a predetermined GameState for an interactive tutorial.
 * This state is fully deterministic and ready to play.
 */
export function createTutorialState(): GameState {
  // ── Load Real Game Data ──
  const { commonCards } = getBasicActions()
  const allEnemies = getEnemies()

  // ── Find Tutorial Cards by Name ──
  const march = commonCards.find((c) => c.name === 'March')
  const rage = commonCards.find((c) => c.name === 'Rage')
  const swiftness = commonCards.find((c) => c.name === 'Swiftness')

  // Fallback: use first 3 cards if exact names not found
  const tutorialCards: BasicActionCard[] = [
    march || commonCards[0],
    rage || commonCards[1],
    swiftness || commonCards[2],
  ]

  // ── Find Weak Green Enemy ──
  const weakGreenEnemy = allEnemies.find(
    (e) => e.color === 'green' && e.armor <= 4 && e.attack <= 4
  )

  const enemy: EnemyToken = weakGreenEnemy || {
    id: 9999,
    name: 'Training Dummy',
    color: 'green',
    category: 'marauding',
    armor: 3,
    attack: 3,
    attackType: 'normal',
    abilities: [],
    fameReward: 2,
    copies: 1,
    set: 'base',
  }

  // ── Build Small Hex Map (8 hexes) ──
  const hexGrid = new Map<string, HexCell>()

  // Center: portal (player start)
  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: {
      type: 'portal',
      isConquered: false,
      enemyTokenIds: [],
      shieldTokens: 0,
    },
    enemyTokens: [],
    tileId: 'tutorial_start',
    isRevealed: true,
  })

  // (1, 0) - hills (safe)
  hexGrid.set(hexKey({ q: 1, r: 0 }), {
    coord: { q: 1, r: 0 },
    terrain: 'hills',
    enemyTokens: [],
    tileId: 'tutorial_start',
    isRevealed: true,
  })


  hexGrid.set(hexKey({ q: 0, r: -1 }), {
    coord: { q: 0, r: -1 },
    terrain: 'plains',
    enemyTokens: [enemy],
    tileId: 'tutorial_start',
    isRevealed: true,
  })

  // (-1, 0) - plains
  hexGrid.set(hexKey({ q: -1, r: 0 }), {
    coord: { q: -1, r: 0 },
    terrain: 'plains',
    enemyTokens: [],
    tileId: 'tutorial_start',
    isRevealed: true,
  })

  // (-1, 1) - hills
  hexGrid.set(hexKey({ q: -1, r: 1 }), {
    coord: { q: -1, r: 1 },
    terrain: 'hills',
    enemyTokens: [],
    tileId: 'tutorial_start',
    isRevealed: true,
  })

  // (0, 1) - plains with village
  hexGrid.set(hexKey({ q: 0, r: 1 }), {
    coord: { q: 0, r: 1 },
    terrain: 'plains',
    site: 'village',
    siteData: {
      type: 'village',
      isConquered: false,
      enemyTokenIds: [],
      shieldTokens: 0,
    },
    enemyTokens: [],
    tileId: 'tutorial_start',
    isRevealed: true,
  })

  // ── Build Map State ──
  const mapState: MapState = {
    tiles: [
      {
        id: 'tutorial_start',
        type: 'starting',
        hasCity: false,
        hexes: Array.from(hexGrid.values()),
        position: { q: 0, r: 0 },
        isRevealed: true,
      },
    ],
    tileDeck: [],
    hexGrid,
  }

  // ── Build Mana Dice (3 dice in source) ──
  const manaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'green', isInSource: true },
  ]

  const manaPool: ManaPoolState = {
    dice: manaDice,
    playerMana: [],
    crystals: { ...INITIAL_CRYSTALS },
    sourceDieTakenThisTurn: false,
  }

  // ── Build Player Deck ──
  const playerHand: AnyCard[] = tutorialCards.map((card) => ({
    ...card,
    // Ensure unique instances if needed
  }))

  const playerDeck: DeckState = {
    ...INITIAL_DECK_STATE,
    hand: playerHand,
    drawPile: [],
    playArea: [],
    discardPile: [],
  }

  // ── Build Player State ──
  const player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: playerDeck,
    fame: 0,
    reputation: 0,
    level: 1,
    armor: 2,
    handLimit: 5,
    unitLimit: 1,
    units: [],
    mana: manaPool,
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: {
      ...INITIAL_TURN_STATE,
      turnNumber: 1,
      movePointsAvailable: 0, // Will be set when movement card is played
    },
    conqueredSites: [],
    levelTokens: [
      { level: 1, armor: 2, handLimit: 5 },
    ],
  }

  // ── Build Dummy Player State ──
  const dummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  // ── Build Offer State ──
  const offers: OfferState = {
    advancedActions: [],
    spells: [],
    units: [],
    advancedActionDeck: [],
    spellDeck: [],
    regularUnitDeck: [],
    eliteUnitDeck: [],
    artifactDeck: [],
  }

  // ── Build Enemy Pools (empty - enemies already on map) ──
  const enemyPools: EnemyPoolState = {
    green: [],
    grey: [],
    violet: [],
    brown: [],
    red: [],
    white: [],
    discarded: {
      green: [],
      grey: [],
      violet: [],
      brown: [],
      red: [],
      white: [],
    },
  }

  // ── Build Complete Game State ──
  const gameState: GameState = {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 1,
    dayNight: 'day',
    roundPattern: ['day', 'night'],

    player,
    dummyPlayer,

    map: mapState,
    offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,

    availableTactics: [],
    usedTactics: [],
    enemyPools,

    seed: 12345, // Fixed seed for deterministic behavior
    turnCount: 1,
    isGameOver: false,
    finalScore: null,

    log: [
      {
        timestamp: Date.now(),
        round: 1,
        turn: 1,
        type: 'game_start',
        message: 'Tutorial scenario started',
      },
    ],
  }

  return gameState
}

// ═══════════════════════════════════════════
// Chapter-Specific Scenario Builders
// ═══════════════════════════════════════════

/**
 * Chapter 1: Introduction — reuses the base tutorial scenario.
 */
function createChapter1State(): GameState {
  return createTutorialState()
}

/**
 * Chapter 2: Terrain & Exploration
 * Teaches movement costs across terrain types and tile exploration.
 * 11-hex map, 4 cards, 1 red crystal, 4 mana dice incl gold, unrevealed tile in deck.
 */
function createChapter2State(): GameState {
  const { commonCards } = getBasicActions()

  const march = commonCards.find((c) => c.name === 'March') || commonCards[0]
  const swiftness = commonCards.find((c) => c.name === 'Swiftness') || commonCards[1]
  const stamina = commonCards.find((c) => c.name === 'Stamina') || commonCards[2]
  const determination = commonCards.find((c) => c.name === 'Determination') || commonCards[3]

  // ── Build 11-Hex Map with Varied Terrain ──
  const hexGrid = new Map<string, HexCell>()

  // Portal hex (starting position)
  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: { type: 'portal', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch2_start',
    isRevealed: true,
  })

  // Starting tile surrounding hexes (6 hexes with varied terrain)
  const ch2StartHexes: Array<[number, number, HexCell['terrain']]> = [
    [1, 0, 'forest'], [0, -1, 'hills'], [1, -1, 'desert'],
    [-1, 0, 'swamp'], [-1, 1, 'plains'], [0, 1, 'forest'],
  ]
  for (const [q, r, terrain] of ch2StartHexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch2_start', isRevealed: true,
    })
  }

  // Exploration tile (4 hexes, revealed for teaching terrain variety)
  const ch2ExploreHexes: Array<[number, number, HexCell['terrain']]> = [
    [2, 0, 'hills'], [2, -1, 'plains'], [1, 1, 'desert'], [-1, -1, 'swamp'],
  ]
  for (const [q, r, terrain] of ch2ExploreHexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch2_explore', isRevealed: true,
    })
  }

  const ch2Map: MapState = {
    tiles: [
      {
        id: 'ch2_start', type: 'starting', hasCity: false,
        hexes: Array.from(hexGrid.values()).filter((h) => h.tileId === 'ch2_start'),
        position: { q: 0, r: 0 }, isRevealed: true,
      },
      {
        id: 'ch2_explore', type: 'countryside', hasCity: false,
        hexes: Array.from(hexGrid.values()).filter((h) => h.tileId === 'ch2_explore'),
        position: { q: 2, r: 0 }, isRevealed: true,
      },
    ],
    tileDeck: ['countryside_3'],
    hexGrid,
  }

  const ch2ManaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'green', isInSource: true },
    { id: 'die_3', color: 'gold', isInSource: true },
  ]

  const ch2Player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: { ...INITIAL_DECK_STATE, hand: [march, swiftness, stamina, determination] },
    fame: 0,
    reputation: 0,
    level: 1,
    armor: 2,
    handLimit: 5,
    unitLimit: 1,
    units: [],
    mana: {
      dice: ch2ManaDice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS, red: 1 },
      sourceDieTakenThisTurn: false,
    },
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: { ...INITIAL_TURN_STATE, turnNumber: 1 },
    conqueredSites: [],
    levelTokens: [{ level: 1, armor: 2, handLimit: 5 }],
  }

  const ch2DummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  const ch2Offers: OfferState = {
    advancedActions: [],
    spells: [],
    units: [],
    advancedActionDeck: [],
    spellDeck: [],
    regularUnitDeck: [],
    eliteUnitDeck: [],
    artifactDeck: [],
  }

  const ch2EnemyPools: EnemyPoolState = {
    green: [], grey: [], violet: [], brown: [], red: [], white: [],
    discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
  }

  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 1,
    dayNight: 'day',
    roundPattern: ['day', 'night'],
    player: ch2Player,
    dummyPlayer: ch2DummyPlayer,
    map: ch2Map,
    offers: ch2Offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: ch2EnemyPools,
    seed: 22222,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    log: [{
      timestamp: Date.now(),
      round: 1,
      turn: 1,
      type: 'game_start',
      message: 'Chapter 2: Terrain & Exploration started',
    }],
  }
}

/**
 * Chapter 3: Mana & Card Mastery
 * Teaches mana usage, strong effects, spell casting, and crystal management.
 * 7-hex map, 5 cards (incl spell + wound), 2 crystals, 5 mana dice, spells in offers.
 */
function createChapter3State(): GameState {
  const { commonCards } = getBasicActions()
  const allSpells = getSpells()

  const march = commonCards.find((c) => c.name === 'March') || commonCards[0]
  const rage = commonCards.find((c) => c.name === 'Rage') || commonCards[1]
  const concentration = commonCards.find((c) => c.name === 'Concentration') || commonCards[2]
  const fireball = allSpells.find((s) => s.name === 'Fireball / Firestorm') || allSpells[0]

  // ── Build 7-Hex Map ──
  const hexGrid = new Map<string, HexCell>()

  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: { type: 'portal', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch3_start',
    isRevealed: true,
  })

  const ch3Hexes: Array<[number, number, HexCell['terrain']]> = [
    [1, 0, 'plains'], [0, -1, 'forest'], [1, -1, 'hills'],
    [-1, 0, 'plains'], [-1, 1, 'hills'], [0, 1, 'forest'],
  ]
  for (const [q, r, terrain] of ch3Hexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch3_start', isRevealed: true,
    })
  }

  const ch3Map: MapState = {
    tiles: [{
      id: 'ch3_start', type: 'starting', hasCity: false,
      hexes: Array.from(hexGrid.values()),
      position: { q: 0, r: 0 }, isRevealed: true,
    }],
    tileDeck: [],
    hexGrid,
  }

  // ── 5 Mana Dice (all 4 colors + gold) ──
  const ch3ManaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'green', isInSource: true },
    { id: 'die_3', color: 'white', isInSource: true },
    { id: 'die_4', color: 'gold', isInSource: true },
  ]

  // ── Spells in Offers ──
  const spellOffer = allSpells.slice(1, 4)
  const spellDeck = allSpells.slice(4)

  // ── 5 cards: March, Rage, Concentration, Fireball spell, wound ──
  const ch3Hand: AnyCard[] = [
    march,
    rage,
    concentration,
    fireball,
    { type: 'wound' as const, id: 'wound_ch3_1' },
  ]

  const ch3Player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: { ...INITIAL_DECK_STATE, hand: ch3Hand },
    fame: 0,
    reputation: 0,
    level: 1,
    armor: 2,
    handLimit: 5,
    unitLimit: 1,
    units: [],
    mana: {
      dice: ch3ManaDice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS, red: 1, blue: 1 },
      sourceDieTakenThisTurn: false,
    },
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: { ...INITIAL_TURN_STATE, turnNumber: 1 },
    conqueredSites: [],
    levelTokens: [{ level: 1, armor: 2, handLimit: 5 }],
  }

  const ch3DummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  const ch3Offers: OfferState = {
    advancedActions: [],
    spells: spellOffer,
    units: [],
    advancedActionDeck: [],
    spellDeck,
    regularUnitDeck: [],
    eliteUnitDeck: [],
    artifactDeck: [],
  }

  const ch3EnemyPools: EnemyPoolState = {
    green: [], grey: [], violet: [], brown: [], red: [], white: [],
    discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
  }

  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 1,
    dayNight: 'day',
    roundPattern: ['day', 'night'],
    player: ch3Player,
    dummyPlayer: ch3DummyPlayer,
    map: ch3Map,
    offers: ch3Offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: ch3EnemyPools,
    seed: 33333,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    log: [{
      timestamp: Date.now(),
      round: 1,
      turn: 1,
      type: 'game_start',
      message: 'Chapter 3: Mana & Card Mastery started',
    }],
  }
}

/**
 * Chapter 4: Interaction & Units
 * Teaches village/monastery/mageTower interactions and unit recruitment.
 * 9-hex map with sites, 4 cards + wound, units & AA in offers, 4 mana dice.
 */
function createChapter4State(): GameState {
  const { commonCards } = getBasicActions()
  const allAdvancedActions = getAdvancedActions()
  const allRegularUnits = getRegularUnits()

  const march = commonCards.find((c) => c.name === 'March') || commonCards[0]
  const promise = commonCards.find((c) => c.name === 'Promise') || commonCards[1]
  const swiftness = commonCards.find((c) => c.name === 'Swiftness') || commonCards[2]
  const tranquility = commonCards.find((c) => c.name === 'Tranquility') || commonCards[3]

  // ── Build 9-Hex Map with Interaction Sites ──
  const hexGrid = new Map<string, HexCell>()

  // Portal hex
  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: { type: 'portal', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch4_start',
    isRevealed: true,
  })

  // Village
  hexGrid.set(hexKey({ q: 1, r: 0 }), {
    coord: { q: 1, r: 0 },
    terrain: 'plains',
    site: 'village',
    siteData: { type: 'village', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch4_start',
    isRevealed: true,
  })

  // Monastery
  hexGrid.set(hexKey({ q: 0, r: -1 }), {
    coord: { q: 0, r: -1 },
    terrain: 'hills',
    site: 'monastery',
    siteData: { type: 'monastery', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch4_start',
    isRevealed: true,
  })

  // Mage Tower
  hexGrid.set(hexKey({ q: 1, r: -1 }), {
    coord: { q: 1, r: -1 },
    terrain: 'forest',
    site: 'mageTower',
    siteData: { type: 'mageTower', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch4_start',
    isRevealed: true,
  })

  // Remaining hexes (no sites)
  const ch4PlainHexes: Array<[number, number, HexCell['terrain']]> = [
    [-1, 0, 'plains'], [-1, 1, 'hills'], [0, 1, 'forest'],
    [2, 0, 'plains'], [2, -1, 'hills'],
  ]
  for (const [q, r, terrain] of ch4PlainHexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch4_start', isRevealed: true,
    })
  }

  const ch4Map: MapState = {
    tiles: [{
      id: 'ch4_start', type: 'starting', hasCity: false,
      hexes: Array.from(hexGrid.values()),
      position: { q: 0, r: 0 }, isRevealed: true,
    }],
    tileDeck: [],
    hexGrid,
  }

  // ── Units & Advanced Actions in Offers ──
  const unitOffer = allRegularUnits.slice(0, 3)
  const aaOffer = allAdvancedActions.slice(0, 3)
  const aaDeck = allAdvancedActions.slice(3)

  const ch4ManaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'white', isInSource: true },
    { id: 'die_3', color: 'green', isInSource: true },
  ]

  // ── 4 cards + 1 wound in hand ──
  const ch4Hand: AnyCard[] = [
    march,
    promise,
    swiftness,
    tranquility,
    { type: 'wound' as const, id: 'wound_ch4_1' },
  ]

  const ch4Player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: { ...INITIAL_DECK_STATE, hand: ch4Hand },
    fame: 0,
    reputation: 0,
    level: 1,
    armor: 2,
    handLimit: 5,
    unitLimit: 1,
    units: [],
    mana: {
      dice: ch4ManaDice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS },
      sourceDieTakenThisTurn: false,
    },
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: { ...INITIAL_TURN_STATE, turnNumber: 1 },
    conqueredSites: [],
    levelTokens: [{ level: 1, armor: 2, handLimit: 5 }],
  }

  const ch4DummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  const ch4Offers: OfferState = {
    advancedActions: aaOffer,
    spells: [],
    units: unitOffer,
    advancedActionDeck: aaDeck,
    spellDeck: [],
    regularUnitDeck: allRegularUnits.slice(3),
    eliteUnitDeck: [],
    artifactDeck: [],
  }

  const ch4EnemyPools: EnemyPoolState = {
    green: [], grey: [], violet: [], brown: [], red: [], white: [],
    discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
  }

  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 1,
    dayNight: 'day',
    roundPattern: ['day', 'night'],
    player: ch4Player,
    dummyPlayer: ch4DummyPlayer,
    map: ch4Map,
    offers: ch4Offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: ch4EnemyPools,
    seed: 44444,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    log: [{
      timestamp: Date.now(),
      round: 1,
      turn: 1,
      type: 'game_start',
      message: 'Chapter 4: Interaction & Units started',
    }],
  }
}

/**
 * Chapter 5: Advanced Combat
 * Teaches fighting stronger enemies with abilities (resistance, brutal, etc).
 * 7-hex map with keep, 5 cards incl Rage, 2 enemies, fame 5, 1 unit, 5 mana dice.
 */
function createChapter5State(): GameState {
  const { commonCards } = getBasicActions()
  const allEnemies = getEnemies()
  const allRegularUnits = getRegularUnits()
  const allAdvancedActions = getAdvancedActions()

  const rage = commonCards.find((c) => c.name === 'Rage') || commonCards[0]
  const march = commonCards.find((c) => c.name === 'March') || commonCards[1]
  const determination = commonCards.find((c) => c.name === 'Determination') || commonCards[2]
  const swiftness = commonCards.find((c) => c.name === 'Swiftness') || commonCards[3]
  const improvisation = commonCards.find((c) => c.name === 'Improvisation') || commonCards[4]

  // Grey enemy with abilities (Golems: physical_resistance, armor 5, attack 2)
  const greyEnemy: EnemyToken = allEnemies.find(
    (e) => e.color === 'grey' && e.name === 'Golems'
  ) || allEnemies.find((e) => e.color === 'grey') || {
    id: 22, name: 'Golems', color: 'grey', category: 'keep',
    armor: 5, attack: 2, attackType: 'normal',
    abilities: ['physical_resistance'], fameReward: 4, copies: 2, set: 'base',
  }

  // Violet enemy (Fire Golem: physical_resistance, fire_resistance, brutal)
  const violetEnemy: EnemyToken = allEnemies.find(
    (e) => e.color === 'violet' && e.name === 'Fire Golem'
  ) || allEnemies.find((e) => e.color === 'violet') || {
    id: 31, name: 'Fire Golem', color: 'violet', category: 'violet',
    armor: 4, attack: 3, attackType: 'fire',
    abilities: ['physical_resistance', 'fire_resistance', 'brutal'],
    fameReward: 5, copies: 2, set: 'base',
  }

  // Unit for player (Peasants)
  const peasants = allRegularUnits.find((u) => u.name === 'Peasants') || allRegularUnits[0]

  // ── Build 7-Hex Map with Keep ──
  const hexGrid = new Map<string, HexCell>()

  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: { type: 'portal', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch5_start',
    isRevealed: true,
  })

  // Keep with enemies
  hexGrid.set(hexKey({ q: 1, r: 0 }), {
    coord: { q: 1, r: 0 },
    terrain: 'hills',
    site: 'keep',
    siteData: {
      type: 'keep',
      isConquered: false,
      enemyTokenIds: [`enemy_${greyEnemy.id}`, `enemy_${violetEnemy.id}`],
      shieldTokens: 0,
    },
    enemyTokens: [greyEnemy, violetEnemy],
    tileId: 'ch5_start',
    isRevealed: true,
  })

  const ch5Hexes: Array<[number, number, HexCell['terrain']]> = [
    [0, -1, 'forest'], [1, -1, 'plains'], [-1, 0, 'hills'],
    [-1, 1, 'plains'], [0, 1, 'forest'],
  ]
  for (const [q, r, terrain] of ch5Hexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch5_start', isRevealed: true,
    })
  }

  const ch5Map: MapState = {
    tiles: [{
      id: 'ch5_start', type: 'starting', hasCity: false,
      hexes: Array.from(hexGrid.values()),
      position: { q: 0, r: 0 }, isRevealed: true,
    }],
    tileDeck: [],
    hexGrid,
  }

  const ch5ManaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'green', isInSource: true },
    { id: 'die_3', color: 'white', isInSource: true },
    { id: 'die_4', color: 'gold', isInSource: true },
  ]

  const ch5Player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: { ...INITIAL_DECK_STATE, hand: [rage, march, determination, swiftness, improvisation] },
    fame: 5,
    reputation: 0,
    level: 1,
    armor: 2,
    handLimit: 5,
    unitLimit: 1,
    units: [{ unit: peasants, status: 'ready', woundCount: 0 }],
    mana: {
      dice: ch5ManaDice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS },
      sourceDieTakenThisTurn: false,
    },
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: { ...INITIAL_TURN_STATE, turnNumber: 1 },
    conqueredSites: [],
    levelTokens: [{ level: 1, armor: 2, handLimit: 5 }],
  }

  const ch5DummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  const ch5Offers: OfferState = {
    advancedActions: allAdvancedActions.slice(0, 3),
    spells: [],
    units: [],
    advancedActionDeck: allAdvancedActions.slice(3),
    spellDeck: [],
    regularUnitDeck: allRegularUnits.slice(1),
    eliteUnitDeck: [],
    artifactDeck: [],
  }

  const ch5EnemyPools: EnemyPoolState = {
    green: [], grey: [], violet: [], brown: [], red: [], white: [],
    discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
  }

  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 1,
    dayNight: 'day',
    roundPattern: ['day', 'night'],
    player: ch5Player,
    dummyPlayer: ch5DummyPlayer,
    map: ch5Map,
    offers: ch5Offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: ch5EnemyPools,
    seed: 55555,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    log: [{
      timestamp: Date.now(),
      round: 1,
      turn: 1,
      type: 'game_start',
      message: 'Chapter 5: Advanced Combat started',
    }],
  }
}

/**
 * Chapter 6: City Assault
 * Teaches city combat with garrison enemies and siege mechanics.
 * 12-hex map with green city, 5 cards, 2-3 garrison enemies (brown/red),
 * 6 mana dice, level 2, fame 10, 2 units, totalRounds: 2.
 */
function createChapter6State(): GameState {
  const { commonCards } = getBasicActions()
  const allEnemies = getEnemies()
  const allRegularUnits = getRegularUnits()
  const allEliteUnits = getEliteUnits()
  const allAdvancedActions = getAdvancedActions()
  const allSpells = getSpells()

  const rage = commonCards.find((c) => c.name === 'Rage') || commonCards[0]
  const march = commonCards.find((c) => c.name === 'March') || commonCards[1]
  const determination = commonCards.find((c) => c.name === 'Determination') || commonCards[2]
  const swiftness = commonCards.find((c) => c.name === 'Swiftness') || commonCards[3]
  const improvisation = commonCards.find((c) => c.name === 'Improvisation') || commonCards[4]

  // City garrison enemies (brown/red)
  const gargoyle: EnemyToken = allEnemies.find(
    (e) => e.color === 'brown' && e.name === 'Gargoyle'
  ) || allEnemies.find((e) => e.color === 'brown') || {
    id: 40, name: 'Gargoyle', color: 'brown', category: 'brown',
    armor: 4, attack: 5, attackType: 'normal',
    abilities: ['physical_resistance'], fameReward: 4, copies: 2, set: 'base',
  }

  const minotaur: EnemyToken = allEnemies.find(
    (e) => e.color === 'brown' && e.name === 'Minotaur'
  ) || {
    id: 42, name: 'Minotaur', color: 'brown', category: 'brown',
    armor: 5, attack: 5, attackType: 'normal',
    abilities: ['brutal'], fameReward: 4, copies: 2, set: 'base',
  }

  const fireDragon: EnemyToken = allEnemies.find(
    (e) => e.color === 'red' && e.name === 'Fire Dragon'
  ) || allEnemies.find((e) => e.color === 'red') || {
    id: 47, name: 'Fire Dragon', color: 'red', category: 'red',
    armor: 7, attack: 9, attackType: 'fire',
    abilities: ['fire_resistance', 'physical_resistance'],
    fameReward: 8, copies: 2, set: 'base',
  }

  // Units for player
  const peasants = allRegularUnits.find((u) => u.name === 'Peasants') || allRegularUnits[0]
  const herbalists = allRegularUnits.find((u) => u.name === 'Herbalists') || allRegularUnits[1]

  // ── Build 12-Hex Map with City ──
  const hexGrid = new Map<string, HexCell>()

  // Tile 1: Starting tile (7 hexes)
  hexGrid.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    terrain: 'plains',
    site: 'portal',
    siteData: { type: 'portal', isConquered: false, enemyTokenIds: [], shieldTokens: 0 },
    enemyTokens: [],
    tileId: 'ch6_start',
    isRevealed: true,
  })

  const ch6StartHexes: Array<[number, number, HexCell['terrain']]> = [
    [1, 0, 'forest'], [0, -1, 'hills'], [1, -1, 'plains'],
    [-1, 0, 'forest'], [-1, 1, 'hills'], [0, 1, 'plains'],
  ]
  for (const [q, r, terrain] of ch6StartHexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch6_start', isRevealed: true,
    })
  }

  // Tile 2: Core tile with city (5 hexes)
  // City hex
  hexGrid.set(hexKey({ q: 0, r: -2 }), {
    coord: { q: 0, r: -2 },
    terrain: 'city',
    site: 'city',
    siteData: {
      type: 'city',
      isConquered: false,
      enemyTokenIds: [
        `enemy_${gargoyle.id}`,
        `enemy_${minotaur.id}`,
        `enemy_${fireDragon.id}`,
      ],
      shieldTokens: 0,
      cityColor: 'green',
    },
    enemyTokens: [gargoyle, minotaur, fireDragon],
    tileId: 'ch6_core',
    isRevealed: true,
  })

  const ch6CoreHexes: Array<[number, number, HexCell['terrain']]> = [
    [1, -2, 'plains'], [-1, -1, 'hills'], [2, -1, 'forest'], [2, 0, 'plains'],
  ]
  for (const [q, r, terrain] of ch6CoreHexes) {
    hexGrid.set(hexKey({ q, r }), {
      coord: { q, r }, terrain, enemyTokens: [], tileId: 'ch6_core', isRevealed: true,
    })
  }

  const ch6Map: MapState = {
    tiles: [
      {
        id: 'ch6_start', type: 'starting', hasCity: false,
        hexes: Array.from(hexGrid.values()).filter((h) => h.tileId === 'ch6_start'),
        position: { q: 0, r: 0 }, isRevealed: true,
      },
      {
        id: 'ch6_core', type: 'core', hasCity: true, cityColor: 'green',
        hexes: Array.from(hexGrid.values()).filter((h) => h.tileId === 'ch6_core'),
        position: { q: 0, r: -2 }, isRevealed: true,
      },
    ],
    tileDeck: [],
    hexGrid,
  }

  // ── 6 Mana Dice ──
  const ch6ManaDice: ManaDie[] = [
    { id: 'die_0', color: 'red', isInSource: true },
    { id: 'die_1', color: 'blue', isInSource: true },
    { id: 'die_2', color: 'green', isInSource: true },
    { id: 'die_3', color: 'white', isInSource: true },
    { id: 'die_4', color: 'gold', isInSource: true },
    { id: 'die_5', color: 'red', isInSource: true },
  ]

  const ch6Player: PlayerState = {
    name: 'Player',
    heroName: 'Tutorial Hero',
    deck: { ...INITIAL_DECK_STATE, hand: [rage, march, determination, swiftness, improvisation] },
    fame: 10,
    reputation: 0,
    level: 2,
    armor: 3,
    handLimit: 5,
    unitLimit: 2,
    units: [
      { unit: peasants, status: 'ready', woundCount: 0 },
      { unit: herbalists, status: 'ready', woundCount: 0 },
    ],
    mana: {
      dice: ch6ManaDice,
      playerMana: [],
      crystals: { ...INITIAL_CRYSTALS },
      sourceDieTakenThisTurn: false,
    },
    skills: [],
    commonSkillsAvailable: [],
    currentTactic: null,
    position: { q: 0, r: 0 },
    turn: { ...INITIAL_TURN_STATE, turnNumber: 1 },
    conqueredSites: [],
    levelTokens: [
      { level: 1, armor: 2, handLimit: 5 },
      { level: 2, armor: 3, handLimit: 5 },
    ],
  }

  const ch6DummyPlayer: DummyPlayerState = {
    heroName: 'Dummy Hero',
    deedDeck: [],
    discardPile: [],
    crystals: { ...INITIAL_CRYSTALS },
    tacticCard: null,
    hasEndedRound: false,
    cardsFlippedThisRound: 0,
  }

  const ch6Offers: OfferState = {
    advancedActions: allAdvancedActions.slice(0, 3),
    spells: allSpells.slice(0, 3),
    units: allRegularUnits.slice(0, 3),
    advancedActionDeck: allAdvancedActions.slice(3),
    spellDeck: allSpells.slice(3),
    regularUnitDeck: allRegularUnits.slice(3),
    eliteUnitDeck: allEliteUnits.slice(0),
    artifactDeck: [],
  }

  const ch6EnemyPools: EnemyPoolState = {
    green: [], grey: [], violet: [], brown: [], red: [], white: [],
    discarded: { green: [], grey: [], violet: [], brown: [], red: [], white: [] },
  }

  return {
    phase: 'player_turn_start',
    round: 1,
    totalRounds: 2,
    dayNight: 'day',
    roundPattern: ['day', 'night'],
    player: ch6Player,
    dummyPlayer: ch6DummyPlayer,
    map: ch6Map,
    offers: ch6Offers,
    combat: { ...INITIAL_COMBAT_STATE },
    interaction: null,
    availableTactics: [],
    usedTactics: [],
    enemyPools: ch6EnemyPools,
    seed: 66666,
    turnCount: 1,
    isGameOver: false,
    finalScore: null,
    log: [{
      timestamp: Date.now(),
      round: 1,
      turn: 1,
      type: 'game_start',
      message: 'Chapter 6: City Assault started',
    }],
  }
}

// ═══════════════════════════════════════════
// Chapter Dispatcher
// ═══════════════════════════════════════════

export function createChapterState(chapter: number): GameState {
  switch (chapter) {
    case 1: return createChapter1State()
    case 2: return createChapter2State()
    case 3: return createChapter3State()
    case 4: return createChapter4State()
    case 5: return createChapter5State()
    case 6: return createChapter6State()
    default: return createChapter1State()
  }
}
