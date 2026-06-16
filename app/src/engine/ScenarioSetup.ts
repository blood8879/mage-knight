import type {
  DayNight,
  BasicActionCard,
  AdvancedActionCard,
  SpellCard,
  RegularUnit,
  EliteUnit,
  ArtifactCard,
  EnemyToken,
  TacticCard,
  AnyCard,
  HexCoord,
  PlayerState,
  DummyPlayerState,
  OfferState,
  CrystalInventory,
  EnemyColor,
} from './types'
import type { EnemyPoolState } from './GameState'
import { INITIAL_TURN_STATE, INITIAL_DECK_STATE, INITIAL_MANA_POOL, INITIAL_CRYSTALS } from './GameState'
import type { SeededRandom } from '@/utils/random'

export interface ScenarioConfig {
  name: string
  totalRounds: number
  roundPattern: DayNight[]
  mapConfig: {
    startingSide: 'A' | 'B'
    countrysideTileCount: number
    coreTileCount: number
    coreCityCount: number
  }
  playerCount: number
  useDummyPlayer: boolean
  diceCount: number
  unitOfferSlots: number
  spellOfferSlots: number
  aaOfferSlots: number
  specialRules: string[]
  useEliteUnits: boolean
  removedSpellIds: number[]
}

const ENEMY_COLORS: EnemyColor[] = ['green', 'grey', 'violet', 'brown', 'red', 'white']

const COMPETITIVE_SPELL_IDS = [17, 18, 19, 20]

export class ScenarioSetup {
  private random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }

  setupFirstReconnaissance(): ScenarioConfig {
    // Solo Conquest (rulebook, Scenario List): the standard solo game — six
    // rounds (3 days, 3 nights), conquer the cities. (Kept the method name for
    // call-site stability.)
    return {
      name: 'Solo Conquest',
      totalRounds: 6,
      roundPattern: ['day', 'night', 'day', 'night', 'day', 'night'],
      mapConfig: {
        startingSide: 'A',
        countrysideTileCount: 7,
        coreTileCount: 4, // 2 city + 2 non-city
        coreCityCount: 2,
      },
      playerCount: 2,
      useDummyPlayer: true,
      diceCount: 4,
      unitOfferSlots: 4,
      spellOfferSlots: 3,
      aaOfferSlots: 3,
      // Solo Conquest removes the four competitive Spells (17-20). It does NOT
      // grant Fame on tile reveal (that is a First Reconnaissance rule).
      specialRules: [
        'no_pvp',
      ],
      useEliteUnits: false,
      removedSpellIds: [...COMPETITIVE_SPELL_IDS],
    }
  }

  setupPlayerDeck(heroName: string, basicActionCards: BasicActionCard[]): AnyCard[] {
    // Works for any hero: keep common cards, swap in this hero's unique card
    // (heroSpecific with a `replaces` target), and drop other heroes' cards.
    const deck: AnyCard[] = []

    for (const card of basicActionCards) {
      if (card.heroSpecific !== null && card.heroSpecific !== heroName) {
        continue
      }

      if (card.replaces !== null) {
        deck.push({ ...card })
        continue
      }

      const isReplaced = basicActionCards.some(
        (other) => other.replaces === card.name && other.heroSpecific === heroName,
      )
      if (isReplaced) {
        const remaining = card.copies - 1
        for (let i = 0; i < remaining; i++) {
          deck.push({ ...card })
        }
      } else {
        for (let i = 0; i < card.copies; i++) {
          deck.push({ ...card })
        }
      }
    }

    return deck
  }

  setupOffers(
    config: ScenarioConfig,
    allAA: AdvancedActionCard[],
    allSpells: SpellCard[],
    allRegularUnits: RegularUnit[],
    allEliteUnits: EliteUnit[],
    allArtifacts: ArtifactCard[],
  ): OfferState {
    const shuffledAA = this.random.shuffle([...allAA])
    const filteredSpells = allSpells.filter(
      (s) => !config.removedSpellIds.includes(s.id),
    )
    const shuffledSpells = this.random.shuffle([...filteredSpells])
    const shuffledRegularUnits = this.random.shuffle([...allRegularUnits])
    const shuffledEliteUnits = config.useEliteUnits
      ? this.random.shuffle([...allEliteUnits])
      : []
    const shuffledArtifacts = this.random.shuffle([...allArtifacts])

    const aaOffer = shuffledAA.slice(0, config.aaOfferSlots)
    const aaRemaining = shuffledAA.slice(config.aaOfferSlots)

    const spellOffer = shuffledSpells.slice(0, config.spellOfferSlots)
    const spellRemaining = shuffledSpells.slice(config.spellOfferSlots)

    const unitOffer = shuffledRegularUnits.slice(0, config.unitOfferSlots)
    const unitRemaining = shuffledRegularUnits.slice(config.unitOfferSlots)

    return {
      advancedActions: aaOffer,
      spells: spellOffer,
      units: unitOffer,
      advancedActionDeck: aaRemaining,
      spellDeck: spellRemaining,
      regularUnitDeck: unitRemaining,
      eliteUnitDeck: shuffledEliteUnits,
      artifactDeck: shuffledArtifacts,
    }
  }

  setupEnemyPools(allEnemies: EnemyToken[]): EnemyPoolState {
    const pools: EnemyPoolState = {
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

    for (const enemy of allEnemies) {
      if (ENEMY_COLORS.includes(enemy.color)) {
        pools[enemy.color].push({ ...enemy })
      }
    }

    for (const color of ENEMY_COLORS) {
      pools[color] = this.random.shuffle(pools[color])
    }

    return pools
  }

  setupTactics(
    dayTactics: TacticCard[],
    nightTactics: TacticCard[],
  ): { day: TacticCard[]; night: TacticCard[] } {
    const sortedDay = [...dayTactics].sort((a, b) => a.number - b.number)
    const sortedNight = [...nightTactics].sort((a, b) => a.number - b.number)
    return { day: sortedDay, night: sortedNight }
  }

  getInitialPlayerState(
    heroName: string,
    deck: AnyCard[],
    position: HexCoord,
  ): PlayerState {
    const shuffledDeck = this.random.shuffle([...deck])

    return {
      name: heroName,
      heroName,
      deck: {
        ...INITIAL_DECK_STATE,
        drawPile: shuffledDeck,
      },
      fame: 0,
      reputation: 0,
      level: 1,
      armor: 2,
      handLimit: 5,
      unitLimit: 1,
      units: [],
      mana: {
        ...INITIAL_MANA_POOL,
        crystals: { ...INITIAL_CRYSTALS },
      },
      skills: [],
      commonSkillsAvailable: [],
      currentTactic: null,
      position: { ...position },
      turn: { ...INITIAL_TURN_STATE },
      conqueredSites: [],
      levelTokens: [],
    }
  }

  getInitialDummyState(
    heroName: string,
    basicActionCards: AnyCard[],
  ): DummyPlayerState {
    const shuffledDeck = this.random.shuffle([...basicActionCards])

    const crystals: CrystalInventory = { ...INITIAL_CRYSTALS }
    if (heroName === 'Goldyx') {
      crystals.green = 2
      crystals.blue = 1
    } else if (heroName === 'Arythea') {
      crystals.red = 1
      crystals.blue = 1
    } else if (heroName === 'Tovak') {
      crystals.blue = 1
      crystals.white = 1
    } else if (heroName === 'Norowas') {
      crystals.white = 1
      crystals.green = 1
    }

    return {
      heroName,
      deedDeck: shuffledDeck,
      discardPile: [],
      crystals,
      tacticCard: null,
      hasEndedRound: false,
      cardsFlippedThisRound: 0,
    }
  }
}
