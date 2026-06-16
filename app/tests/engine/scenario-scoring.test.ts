import { describe, it, expect, beforeEach } from 'vitest'
import { ScenarioSetup } from '@/engine/ScenarioSetup'
import type { ScenarioConfig } from '@/engine/ScenarioSetup'
import { ScoringCalculator } from '@/engine/ScoringCalculator'
import type { ScoringContext, SoloConquestScoringContext } from '@/engine/ScoringCalculator'
import { SeededRandom } from '@/utils/random'
import type {
  BasicActionCard,
  AdvancedActionCard,
  SpellCard,
  RegularUnit,
  EliteUnit,
  ArtifactCard,
  EnemyToken,
  TacticCard,
  AnyCard,
  FinalScore,
} from '@/engine/types'

function makeBasicCard(
  id: number,
  name: string,
  overrides: Partial<BasicActionCard> = {},
): BasicActionCard {
  return {
    id,
    name,
    type: 'basic_action',
    color: 'red',
    basicEffect: { text: 'test', actions: [] },
    strongEffect: { text: 'test strong', actions: [] },
    copies: 1,
    heroSpecific: null,
    replaces: null,
    set: 'base',
    ...overrides,
  }
}

function makeAdvancedAction(id: number, name: string): AdvancedActionCard {
  return {
    id,
    name,
    type: 'advanced_action',
    color: 'red',
    basicEffect: { text: 'test', actions: [] },
    strongEffect: { text: 'test strong', actions: [] },
    set: 'base',
  }
}

function makeSpell(id: number, name: string, competitive = false): SpellCard {
  return {
    id,
    name,
    type: 'spell',
    color: 'blue',
    basicSpell: { text: 'test', actions: [], name: `${name} Basic` },
    strongSpell: { text: 'test strong', actions: [], name: `${name} Strong` },
    competitive,
    set: 'base',
  }
}

function makeRegularUnit(id: number, name: string): RegularUnit {
  return {
    id,
    name,
    type: 'soldier',
    tier: 'regular',
    level: 1,
    cost: 3,
    armor: 3,
    recruitSites: ['village'],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base',
  }
}

function makeEliteUnit(id: number, name: string): EliteUnit {
  return {
    id,
    name,
    type: 'warrior',
    tier: 'elite',
    level: 3,
    cost: 7,
    armor: 5,
    recruitSites: ['city'],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base',
  }
}

function makeArtifact(id: number, name: string): ArtifactCard {
  return {
    id,
    name,
    type: 'artifact',
    basicEffect: { text: 'test', actions: [] },
    strongEffect: { text: 'test strong', actions: [] },
    set: 'base',
  }
}

function makeEnemy(id: number, name: string, color: EnemyToken['color']): EnemyToken {
  return {
    id,
    name,
    color,
    category: 'monster',
    armor: 3,
    attack: 3,
    attackType: 'normal',
    abilities: [],
    fameReward: 2,
    copies: 1,
    set: 'base',
  }
}

function makeTactic(id: number, number: number, type: 'day' | 'night'): TacticCard {
  return {
    id,
    name: `Tactic ${number}`,
    type,
    number,
    effect: 'Some effect',
    isUsed: false,
  }
}

function buildArytheaDeckInput(): BasicActionCard[] {
  return [
    makeBasicCard(1, 'Rage', { color: 'red', copies: 2 }),
    makeBasicCard(2, 'Determination', { color: 'blue', copies: 1 }),
    makeBasicCard(3, 'Swiftness', { color: 'white', copies: 2 }),
    makeBasicCard(4, 'March', { color: 'green', copies: 2 }),
    makeBasicCard(5, 'Stamina', { color: 'blue', copies: 2 }),
    makeBasicCard(6, 'Tranquility', { color: 'green', copies: 1 }),
    makeBasicCard(7, 'Promise', { color: 'white', copies: 1 }),
    makeBasicCard(8, 'Threaten', { color: 'red', copies: 1 }),
    makeBasicCard(9, 'Crystallize', { color: 'blue', copies: 1 }),
    makeBasicCard(10, 'Mana Draw', { color: 'white', copies: 1 }),
    makeBasicCard(11, 'Concentration', { color: 'green', copies: 1 }),
    makeBasicCard(12, 'Improvisation', { color: 'red', copies: 1 }),
    makeBasicCard(100, 'Battle Versatility', {
      color: 'red',
      copies: 1,
      heroSpecific: 'Arythea',
      replaces: 'Rage',
    }),
  ]
}

describe('ScenarioSetup', () => {
  let setup: ScenarioSetup
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    setup = new ScenarioSetup(random)
  })

  describe('setupFirstReconnaissance', () => {
    it('returns correct config for Solo Conquest', () => {
      const config = setup.setupFirstReconnaissance()

      expect(config.name).toBe('Solo Conquest')
      expect(config.totalRounds).toBe(6)
      expect(config.roundPattern).toEqual(['day', 'night', 'day', 'night', 'day', 'night'])
      expect(config.mapConfig.startingSide).toBe('A')
      expect(config.mapConfig.countrysideTileCount).toBe(7)
      expect(config.mapConfig.coreTileCount).toBe(4)
      expect(config.mapConfig.coreCityCount).toBe(2)
      expect(config.playerCount).toBe(2)
      expect(config.useDummyPlayer).toBe(true)
    })

    it('has correct dice and offer slot counts (player_count + 2)', () => {
      const config = setup.setupFirstReconnaissance()

      expect(config.diceCount).toBe(4)
      expect(config.unitOfferSlots).toBe(4)
      expect(config.spellOfferSlots).toBe(3)
      expect(config.aaOfferSlots).toBe(3)
    })

    it('includes the Solo Conquest special rules', () => {
      const config = setup.setupFirstReconnaissance()

      expect(config.specialRules).toContain('no_pvp')
      expect(config.specialRules).not.toContain('tile_fame')
      expect(config.specialRules).not.toContain('no_city_conquest')
    })

    it('disables elite units and removes competitive spells', () => {
      const config = setup.setupFirstReconnaissance()

      expect(config.useEliteUnits).toBe(false)
      expect(config.removedSpellIds).toEqual([17, 18, 19, 20])
    })
  })

  describe('setupPlayerDeck', () => {
    it('builds a 16-card deck for Arythea with Battle Versatility replacing one Rage', () => {
      const cards = buildArytheaDeckInput()
      const deck = setup.setupPlayerDeck('Arythea', cards)

      expect(deck).toHaveLength(16)

      const rageCount = deck.filter((c) => c.type !== 'wound' && c.name === 'Rage').length
      const bvCount = deck.filter((c) => c.type !== 'wound' && c.name === 'Battle Versatility').length
      expect(rageCount).toBe(1)
      expect(bvCount).toBe(1)
    })

    it('returns proper copies of multi-copy cards', () => {
      const cards = buildArytheaDeckInput()
      const deck = setup.setupPlayerDeck('Arythea', cards)

      const swiftnessCount = deck.filter((c) => c.type !== 'wound' && c.name === 'Swiftness').length
      const marchCount = deck.filter((c) => c.type !== 'wound' && c.name === 'March').length
      const staminaCount = deck.filter((c) => c.type !== 'wound' && c.name === 'Stamina').length
      expect(swiftnessCount).toBe(2)
      expect(marchCount).toBe(2)
      expect(staminaCount).toBe(2)
    })
  })

  describe('setupOffers', () => {
    it('deals correct number of slots for AA, spells, and units', () => {
      const config = setup.setupFirstReconnaissance()
      const aas = Array.from({ length: 10 }, (_, i) => makeAdvancedAction(i, `AA_${i}`))
      const spells = Array.from({ length: 10 }, (_, i) => makeSpell(i, `Spell_${i}`))
      const units = Array.from({ length: 10 }, (_, i) => makeRegularUnit(i, `Unit_${i}`))
      const elites = Array.from({ length: 5 }, (_, i) => makeEliteUnit(i, `Elite_${i}`))
      const artifacts = Array.from({ length: 5 }, (_, i) => makeArtifact(i, `Art_${i}`))

      const offers = setup.setupOffers(config, aas, spells, units, elites, artifacts)

      expect(offers.advancedActions).toHaveLength(3)
      expect(offers.spells).toHaveLength(3)
      expect(offers.units).toHaveLength(4)
      expect(offers.advancedActionDeck).toHaveLength(7)
      expect(offers.spellDeck).toHaveLength(7)
      expect(offers.regularUnitDeck).toHaveLength(6)
    })

    it('removes competitive spells (ids 17-20) from the spell pool', () => {
      const config = setup.setupFirstReconnaissance()
      const aas = Array.from({ length: 5 }, (_, i) => makeAdvancedAction(i, `AA_${i}`))
      const spells = [
        makeSpell(1, 'Normal1'),
        makeSpell(2, 'Normal2'),
        makeSpell(3, 'Normal3'),
        makeSpell(4, 'Normal4'),
        makeSpell(17, 'Competitive1', true),
        makeSpell(18, 'Competitive2', true),
        makeSpell(19, 'Competitive3', true),
        makeSpell(20, 'Competitive4', true),
      ]
      const units = Array.from({ length: 5 }, (_, i) => makeRegularUnit(i, `Unit_${i}`))
      const elites: EliteUnit[] = []
      const artifacts: ArtifactCard[] = []

      const offers = setup.setupOffers(config, aas, spells, units, elites, artifacts)

      const allSpellIds = [...offers.spells, ...offers.spellDeck].map((s) => s.id)
      expect(allSpellIds).not.toContain(17)
      expect(allSpellIds).not.toContain(18)
      expect(allSpellIds).not.toContain(19)
      expect(allSpellIds).not.toContain(20)
    })

    it('excludes elite units when useEliteUnits is false', () => {
      const config = setup.setupFirstReconnaissance()
      const aas = Array.from({ length: 5 }, (_, i) => makeAdvancedAction(i, `AA_${i}`))
      const spells = Array.from({ length: 5 }, (_, i) => makeSpell(i, `Spell_${i}`))
      const units = Array.from({ length: 5 }, (_, i) => makeRegularUnit(i, `Unit_${i}`))
      const elites = Array.from({ length: 5 }, (_, i) => makeEliteUnit(i, `Elite_${i}`))
      const artifacts: ArtifactCard[] = []

      const offers = setup.setupOffers(config, aas, spells, units, elites, artifacts)

      expect(offers.eliteUnitDeck).toHaveLength(0)
    })
  })

  describe('setupEnemyPools', () => {
    it('separates enemies by color and shuffles each pool', () => {
      const enemies: EnemyToken[] = [
        makeEnemy(1, 'Orc1', 'green'),
        makeEnemy(2, 'Orc2', 'green'),
        makeEnemy(3, 'Wolf', 'grey'),
        makeEnemy(4, 'Dragon', 'red'),
        makeEnemy(5, 'Spirit', 'violet'),
        makeEnemy(6, 'Golem', 'brown'),
        makeEnemy(7, 'Ice Dragon', 'white'),
      ]

      const pools = setup.setupEnemyPools(enemies)

      expect(pools.green).toHaveLength(2)
      expect(pools.grey).toHaveLength(1)
      expect(pools.red).toHaveLength(1)
      expect(pools.violet).toHaveLength(1)
      expect(pools.brown).toHaveLength(1)
      expect(pools.white).toHaveLength(1)
    })

    it('initializes empty discard piles for all colors', () => {
      const enemies: EnemyToken[] = [makeEnemy(1, 'Orc', 'green')]
      const pools = setup.setupEnemyPools(enemies)

      expect(pools.discarded.green).toHaveLength(0)
      expect(pools.discarded.grey).toHaveLength(0)
      expect(pools.discarded.violet).toHaveLength(0)
      expect(pools.discarded.brown).toHaveLength(0)
      expect(pools.discarded.red).toHaveLength(0)
      expect(pools.discarded.white).toHaveLength(0)
    })
  })

  describe('setupTactics', () => {
    it('returns day and night tactics sorted by number', () => {
      const dayTactics = [makeTactic(3, 3, 'day'), makeTactic(1, 1, 'day'), makeTactic(2, 2, 'day')]
      const nightTactics = [makeTactic(6, 3, 'night'), makeTactic(4, 1, 'night')]

      const result = setup.setupTactics(dayTactics, nightTactics)

      expect(result.day.map((t) => t.number)).toEqual([1, 2, 3])
      expect(result.night.map((t) => t.number)).toEqual([1, 3])
    })

    it('does not mutate input arrays', () => {
      const dayTactics = [makeTactic(2, 2, 'day'), makeTactic(1, 1, 'day')]
      const originalDay = [...dayTactics]

      setup.setupTactics(dayTactics, [])

      expect(dayTactics.map((t) => t.id)).toEqual(originalDay.map((t) => t.id))
    })
  })

  describe('getInitialPlayerState', () => {
    it('creates player state with correct Arythea starting stats', () => {
      const cards = buildArytheaDeckInput()
      const deck = setup.setupPlayerDeck('Arythea', cards)
      const state = setup.getInitialPlayerState('Arythea', deck, { q: 0, r: 0 })

      expect(state.heroName).toBe('Arythea')
      expect(state.armor).toBe(2)
      expect(state.handLimit).toBe(5)
      expect(state.unitLimit).toBe(1)
      expect(state.fame).toBe(0)
      expect(state.reputation).toBe(0)
      expect(state.level).toBe(1)
    })

    it('has shuffled draw pile and empty other zones', () => {
      const cards = buildArytheaDeckInput()
      const deck = setup.setupPlayerDeck('Arythea', cards)
      const state = setup.getInitialPlayerState('Arythea', deck, { q: 0, r: 0 })

      expect(state.deck.drawPile).toHaveLength(16)
      expect(state.deck.hand).toHaveLength(0)
      expect(state.deck.playArea).toHaveLength(0)
      expect(state.deck.discardPile).toHaveLength(0)
    })

    it('has empty units, skills, and conquered sites', () => {
      const deck: AnyCard[] = [makeBasicCard(1, 'Test')]
      const state = setup.getInitialPlayerState('Arythea', deck, { q: 0, r: 0 })

      expect(state.units).toHaveLength(0)
      expect(state.skills).toHaveLength(0)
      expect(state.conqueredSites).toHaveLength(0)
      expect(state.currentTactic).toBeNull()
    })

    it('sets position correctly', () => {
      const deck: AnyCard[] = [makeBasicCard(1, 'Test')]
      const state = setup.getInitialPlayerState('Arythea', deck, { q: 3, r: -2 })

      expect(state.position).toEqual({ q: 3, r: -2 })
    })
  })

  describe('getInitialDummyState', () => {
    it('creates dummy state with shuffled deck', () => {
      const cards: AnyCard[] = Array.from({ length: 10 }, (_, i) => makeBasicCard(i, `Card_${i}`))
      const state = setup.getInitialDummyState('Goldyx', cards)

      expect(state.heroName).toBe('Goldyx')
      expect(state.deedDeck).toHaveLength(10)
      expect(state.discardPile).toHaveLength(0)
      expect(state.tacticCard).toBeNull()
      expect(state.hasEndedRound).toBe(false)
      expect(state.cardsFlippedThisRound).toBe(0)
    })

    it('assigns correct starting crystals for Goldyx', () => {
      const cards: AnyCard[] = [makeBasicCard(1, 'Test')]
      const state = setup.getInitialDummyState('Goldyx', cards)

      expect(state.crystals.green).toBe(2)
      expect(state.crystals.blue).toBe(1)
      expect(state.crystals.red).toBe(0)
      expect(state.crystals.white).toBe(0)
    })

    it('assigns correct starting crystals for Arythea', () => {
      const cards: AnyCard[] = [makeBasicCard(1, 'Test')]
      const state = setup.getInitialDummyState('Arythea', cards)

      expect(state.crystals.red).toBe(1)
      expect(state.crystals.blue).toBe(1)
      expect(state.crystals.green).toBe(0)
      expect(state.crystals.white).toBe(0)
    })
  })

  describe('immutability', () => {
    it('setupPlayerDeck does not mutate input array', () => {
      const cards = buildArytheaDeckInput()
      const originalLength = cards.length

      setup.setupPlayerDeck('Arythea', cards)

      expect(cards).toHaveLength(originalLength)
    })

    it('setupEnemyPools does not mutate input array', () => {
      const enemies = [makeEnemy(1, 'Orc', 'green'), makeEnemy(2, 'Wolf', 'grey')]
      const originalLength = enemies.length

      setup.setupEnemyPools(enemies)

      expect(enemies).toHaveLength(originalLength)
    })

    it('getInitialPlayerState does not mutate input deck', () => {
      const deck: AnyCard[] = Array.from({ length: 5 }, (_, i) => makeBasicCard(i, `Card_${i}`))
      const originalIds = deck.map((c) => c.id)

      setup.getInitialPlayerState('Arythea', deck, { q: 0, r: 0 })

      expect(deck.map((c) => c.id)).toEqual(originalIds)
    })
  })
})

describe('ScoringCalculator', () => {
  let calculator: ScoringCalculator

  beforeEach(() => {
    calculator = new ScoringCalculator()
  })

  describe('calculateFinalScore (First Reconnaissance)', () => {
    it('returns base fame as score with no achievements', () => {
      const context: ScoringContext = {
        playerName: 'Arythea',
        fame: 25,
        conqueredSites: [],
        advancedActionsInDeck: 0,
        spellsInDeck: 0,
        unitsOwned: 0,
        greatestKnowledge: false,
        greatestLeader: false,
        greatestConqueror: false,
        dummyRemainingCards: 0,
        totalRounds: 3,
        roundsPlayed: 3,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateFinalScore(context)

      expect(score.playerName).toBe('Arythea')
      expect(score.baseFame).toBe(25)
      expect(score.achievements).toHaveLength(0)
      expect(score.totalScore).toBe(25)
    })

    it('adds +2 for each achievement bonus', () => {
      const context: ScoringContext = {
        playerName: 'Arythea',
        fame: 30,
        conqueredSites: [],
        advancedActionsInDeck: 5,
        spellsInDeck: 3,
        unitsOwned: 2,
        greatestKnowledge: true,
        greatestLeader: true,
        greatestConqueror: true,
        dummyRemainingCards: 0,
        totalRounds: 3,
        roundsPlayed: 3,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateFinalScore(context)

      expect(score.achievements).toHaveLength(3)
      expect(score.totalScore).toBe(30 + 2 + 2 + 2)
    })

    it('adds +2 for Greatest Knowledge only', () => {
      const context: ScoringContext = {
        playerName: 'Arythea',
        fame: 10,
        conqueredSites: [],
        advancedActionsInDeck: 5,
        spellsInDeck: 3,
        unitsOwned: 0,
        greatestKnowledge: true,
        greatestLeader: false,
        greatestConqueror: false,
        dummyRemainingCards: 0,
        totalRounds: 3,
        roundsPlayed: 3,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateFinalScore(context)

      expect(score.achievements).toHaveLength(1)
      expect(score.achievements[0].category).toBe('Greatest Knowledge')
      expect(score.totalScore).toBe(12)
    })
  })

  describe('calculateSoloConquestScore', () => {
    it('calculates base fame plus city points', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 50,
        citiesConquered: 2,
        totalCities: 3,
        allCitiesConquered: false,
        roundsRemaining: 0,
        dummyRemainingCards: 0,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.baseFame).toBe(50)
      expect(score.totalScore).toBe(50 + 20)
    })

    it('awards +15 bonus for conquering all cities', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 50,
        citiesConquered: 3,
        totalCities: 3,
        allCitiesConquered: true,
        roundsRemaining: 0,
        dummyRemainingCards: 0,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.totalScore).toBe(50 + 30 + 15)
    })

    it('awards 30 points per remaining round for early finish', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 60,
        citiesConquered: 3,
        totalCities: 3,
        allCitiesConquered: true,
        roundsRemaining: 2,
        dummyRemainingCards: 0,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.totalScore).toBe(60 + 30 + 15 + 60)
    })

    it('awards 1 point per dummy remaining card', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 40,
        citiesConquered: 0,
        totalCities: 3,
        allCitiesConquered: false,
        roundsRemaining: 0,
        dummyRemainingCards: 5,
        didNotDeclareEndOfRound: false,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.totalScore).toBe(40 + 5)
    })

    it('awards +5 for not declaring end of round in final round', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 40,
        citiesConquered: 0,
        totalCities: 3,
        allCitiesConquered: false,
        roundsRemaining: 0,
        dummyRemainingCards: 0,
        didNotDeclareEndOfRound: true,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.totalScore).toBe(40 + 5)
    })

    it('calculates full combo scoring correctly', () => {
      const context: SoloConquestScoringContext = {
        playerName: 'Arythea',
        fame: 80,
        citiesConquered: 3,
        totalCities: 3,
        allCitiesConquered: true,
        roundsRemaining: 1,
        dummyRemainingCards: 4,
        didNotDeclareEndOfRound: true,
      }

      const score = calculator.calculateSoloConquestScore(context)

      expect(score.totalScore).toBe(80 + 30 + 15 + 30 + 4 + 5)
    })
  })

  describe('getScoreRating', () => {
    it('returns Rookie for score 0-19', () => {
      expect(calculator.getScoreRating(0)).toBe('Rookie')
      expect(calculator.getScoreRating(19)).toBe('Rookie')
    })

    it('returns Apprentice for score 20-39', () => {
      expect(calculator.getScoreRating(20)).toBe('Apprentice')
      expect(calculator.getScoreRating(39)).toBe('Apprentice')
    })

    it('returns Scout for score 40-59', () => {
      expect(calculator.getScoreRating(40)).toBe('Scout')
      expect(calculator.getScoreRating(59)).toBe('Scout')
    })

    it('returns Knight for score 60-79', () => {
      expect(calculator.getScoreRating(60)).toBe('Knight')
      expect(calculator.getScoreRating(79)).toBe('Knight')
    })

    it('returns Veteran for score 80-99', () => {
      expect(calculator.getScoreRating(80)).toBe('Veteran')
      expect(calculator.getScoreRating(99)).toBe('Veteran')
    })

    it('returns Champion for score 100-119', () => {
      expect(calculator.getScoreRating(100)).toBe('Champion')
      expect(calculator.getScoreRating(119)).toBe('Champion')
    })

    it('returns Legend for score 120+', () => {
      expect(calculator.getScoreRating(120)).toBe('Legend')
      expect(calculator.getScoreRating(999)).toBe('Legend')
    })
  })

  describe('compareScores', () => {
    it('returns positive when a > b', () => {
      const a: FinalScore = { playerName: 'A', baseFame: 50, achievements: [], totalScore: 50 }
      const b: FinalScore = { playerName: 'B', baseFame: 30, achievements: [], totalScore: 30 }

      expect(calculator.compareScores(a, b)).toBeGreaterThan(0)
    })

    it('returns negative when a < b', () => {
      const a: FinalScore = { playerName: 'A', baseFame: 20, achievements: [], totalScore: 20 }
      const b: FinalScore = { playerName: 'B', baseFame: 40, achievements: [], totalScore: 40 }

      expect(calculator.compareScores(a, b)).toBeLessThan(0)
    })

    it('returns zero when equal', () => {
      const a: FinalScore = { playerName: 'A', baseFame: 35, achievements: [], totalScore: 35 }
      const b: FinalScore = { playerName: 'B', baseFame: 35, achievements: [], totalScore: 35 }

      expect(calculator.compareScores(a, b)).toBe(0)
    })
  })
})
