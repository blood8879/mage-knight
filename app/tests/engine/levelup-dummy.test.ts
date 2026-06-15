import { describe, it, expect, beforeEach } from 'vitest'
import { LevelUpManager } from '@/engine/LevelUpManager'
import type { LevelUpReward } from '@/engine/LevelUpManager'
import { DummyPlayer } from '@/engine/DummyPlayer'
import { SeededRandom } from '@/utils/random'
import type {
  AnyCard,
  BasicActionCard,
  DummyPlayerState,
  HeroSkill,
  ManaColor,
  TacticCard,
} from '@/engine/types'

function makeCard(id: number, name: string, color: ManaColor = 'red'): BasicActionCard {
  return {
    id,
    name,
    type: 'basic_action',
    color,
    basicEffect: { text: 'test', actions: [] },
    strongEffect: { text: 'test strong', actions: [] },
    copies: 1,
    heroSpecific: null,
    replaces: null,
    set: 'base',
  }
}

function makeCards(count: number, color: ManaColor = 'red'): BasicActionCard[] {
  return Array.from({ length: count }, (_, i) => makeCard(i, `Card_${i}`, color))
}

function makeTactic(id: number, num: number): TacticCard {
  return {
    id,
    name: `Tactic_${id}`,
    type: 'day',
    number: num,
    effect: 'test',
    isUsed: false,
  }
}

function makeSkill(id: number, name: string): HeroSkill {
  return {
    id,
    name,
    type: 'once_per_turn',
    effect: 'test effect',
    actions: [],
    isFlipped: false,
    isUsedThisTurn: false,
  }
}

describe('LevelUpManager', () => {
  let lum: LevelUpManager

  beforeEach(() => {
    lum = new LevelUpManager()
  })

  describe('addFame', () => {
    it('adds fame without crossing level threshold', () => {
      const result = lum.addFame(0, 2)

      expect(result.newFame).toBe(2)
      expect(result.levelsGained).toBe(0)
      expect(result.newLevel).toBe(1)
    })

    it('adds fame crossing a single level threshold', () => {
      const result = lum.addFame(0, 3)

      expect(result.newFame).toBe(3)
      expect(result.levelsGained).toBe(1)
      expect(result.newLevel).toBe(2)
    })

    it('adds fame crossing multiple level thresholds', () => {
      const result = lum.addFame(0, 16)

      expect(result.newFame).toBe(16)
      expect(result.levelsGained).toBe(3)
      expect(result.newLevel).toBe(4)
    })

    it('handles adding to existing fame', () => {
      const result = lum.addFame(7, 2)

      expect(result.newFame).toBe(9)
      expect(result.levelsGained).toBe(1)
      expect(result.newLevel).toBe(3)
    })
  })

  describe('getCurrentLevel', () => {
    it('returns level 1 for 0 fame', () => {
      expect(lum.getCurrentLevel(0)).toBe(1)
    })

    it('returns level 2 for fame at threshold', () => {
      expect(lum.getCurrentLevel(3)).toBe(2)
    })

    it('returns level 2 for fame between thresholds', () => {
      expect(lum.getCurrentLevel(5)).toBe(2)
    })

    it('returns level 10 for fame at max threshold', () => {
      expect(lum.getCurrentLevel(99)).toBe(10)
    })

    it('returns level 10 for fame above max threshold', () => {
      expect(lum.getCurrentLevel(150)).toBe(10)
    })
  })

  describe('getFameToNextLevel', () => {
    it('returns fame needed to reach level 2 from 0', () => {
      expect(lum.getFameToNextLevel(0)).toBe(3)
    })

    it('returns fame needed when partially through a level', () => {
      expect(lum.getFameToNextLevel(5)).toBe(3)
    })

    it('returns 0 at max level', () => {
      expect(lum.getFameToNextLevel(99)).toBe(0)
    })

    it('returns 0 above max fame', () => {
      expect(lum.getFameToNextLevel(150)).toBe(0)
    })
  })

  describe('getProgressToNextLevel', () => {
    it('returns 0 at level start', () => {
      expect(lum.getProgressToNextLevel(0)).toBeCloseTo(0.0)
    })

    it('returns fractional progress mid-level', () => {
      const progress = lum.getProgressToNextLevel(1)
      expect(progress).toBeCloseTo(1 / 3)
    })

    it('returns 1.0 at max level', () => {
      expect(lum.getProgressToNextLevel(99)).toBeCloseTo(1.0)
    })
  })

  describe('getLevelUpReward', () => {
    it('returns stat_boost for odd levels (3, 5, 7, 9)', () => {
      const reward = lum.getLevelUpReward(3)

      expect(reward.type).toBe('stat_boost')
      expect(reward.newArmor).toBe(3)
      expect(reward.newHandLimit).toBe(5)
      expect(reward.newUnitLimit).toBe(2)
    })

    it('returns advanced_action_and_skill for even levels (2, 4, 6, 8, 10)', () => {
      const reward = lum.getLevelUpReward(2)

      expect(reward.type).toBe('advanced_action_and_skill')
      expect(reward.newArmor).toBe(2)
      expect(reward.newHandLimit).toBe(5)
      expect(reward.newUnitLimit).toBe(2)
    })

    it('returns correct stats for level 5', () => {
      const reward = lum.getLevelUpReward(5)

      expect(reward.type).toBe('stat_boost')
      expect(reward.newArmor).toBe(3)
      expect(reward.newHandLimit).toBe(6)
      expect(reward.newUnitLimit).toBe(3)
    })

    it('returns correct stats for level 10', () => {
      const reward = lum.getLevelUpReward(10)

      expect(reward.type).toBe('advanced_action_and_skill')
      expect(reward.newArmor).toBe(4)
      expect(reward.newHandLimit).toBe(7)
      expect(reward.newUnitLimit).toBe(5)
    })
  })

  describe('getSkillChoice', () => {
    it('draws the specified number of skills from the deck', () => {
      const skills = [makeSkill(1, 'Skill_A'), makeSkill(2, 'Skill_B'), makeSkill(3, 'Skill_C')]
      const drawn = lum.getSkillChoice(skills, 2)

      expect(drawn).toHaveLength(2)
      expect(drawn[0].name).toBe('Skill_A')
      expect(drawn[1].name).toBe('Skill_B')
    })

    it('returns fewer skills if deck has less than count', () => {
      const skills = [makeSkill(1, 'Solo')]
      const drawn = lum.getSkillChoice(skills, 2)

      expect(drawn).toHaveLength(1)
    })

    it('does not mutate the original skill deck', () => {
      const skills = [makeSkill(1, 'A'), makeSkill(2, 'B'), makeSkill(3, 'C')]
      const originalLength = skills.length
      lum.getSkillChoice(skills, 2)

      expect(skills).toHaveLength(originalLength)
    })
  })

  describe('processLevelUp', () => {
    it('returns rewards for each level gained', () => {
      const rewards = lum.processLevelUp(1, 3)

      expect(rewards).toHaveLength(2)
      expect(rewards[0].type).toBe('advanced_action_and_skill')
      expect(rewards[1].type).toBe('stat_boost')
    })

    it('returns empty array when no levels gained', () => {
      const rewards = lum.processLevelUp(3, 3)

      expect(rewards).toHaveLength(0)
    })

    it('returns single reward for one level up', () => {
      const rewards = lum.processLevelUp(4, 5)

      expect(rewards).toHaveLength(1)
      expect(rewards[0].type).toBe('stat_boost')
    })
  })
})

describe('DummyPlayer', () => {
  let dp: DummyPlayer
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    dp = new DummyPlayer(random)
  })

  describe('initializeDummy', () => {
    it('creates a dummy player with shuffled deck', () => {
      const cards = makeCards(16)
      const state = dp.initializeDummy('Goldyx', cards)

      expect(state.heroName).toBe('Goldyx')
      expect(state.deedDeck).toHaveLength(16)
      expect(state.discardPile).toHaveLength(0)
      expect(state.hasEndedRound).toBe(false)
      expect(state.cardsFlippedThisRound).toBe(0)
    })

    it('shuffles the deck (not same order as input)', () => {
      const cards = makeCards(16)
      const state = dp.initializeDummy('Goldyx', cards)

      const inputIds = cards.map((c) => c.id)
      const deckIds = state.deedDeck.map((c) => c.id)
      expect(deckIds).not.toEqual(inputIds)
      expect([...deckIds].sort()).toEqual([...inputIds].sort())
    })

    it('sets Goldyx starting crystals', () => {
      const cards = makeCards(16)
      const state = dp.initializeDummy('Goldyx', cards)

      expect(state.crystals.green).toBe(2)
      expect(state.crystals.blue).toBe(1)
      expect(state.crystals.red).toBe(0)
      expect(state.crystals.white).toBe(0)
    })

    it('sets zero crystals for unknown heroes', () => {
      const cards = makeCards(16)
      const state = dp.initializeDummy('Unknown', cards)

      expect(state.crystals.red).toBe(0)
      expect(state.crystals.blue).toBe(0)
      expect(state.crystals.green).toBe(0)
      expect(state.crystals.white).toBe(0)
    })
  })

  describe('executeDummyTurn', () => {
    it('flips 3 cards from deck to discard', () => {
      const cards = makeCards(10)
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [...cards],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.executeDummyTurn(state)

      expect(result.discardPile).toHaveLength(3)
      expect(result.deedDeck).toHaveLength(7)
      expect(result.cardsFlippedThisRound).toBe(3)
      expect(result.hasEndedRound).toBe(false)
    })

    it('flips additional cards equal to crystals of the topmost color, without spending crystals', () => {
      // After flipping C0/C1/C2, the topmost is C2 (green). Dummy has 2 green
      // crystals → flip exactly 2 more cards (C3, C4). Crystals are NOT spent
      // and only the topmost color is checked (no cascade).
      const cards: BasicActionCard[] = [
        makeCard(0, 'C0', 'red'),
        makeCard(1, 'C1', 'blue'),
        makeCard(2, 'C2', 'green'),
        makeCard(3, 'C3', 'green'),
        makeCard(4, 'C4', 'red'),
      ]
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [...cards],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 2, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.executeDummyTurn(state)

      expect(result.cardsFlippedThisRound).toBe(5)
      expect(result.crystals.green).toBe(2) // crystals persist (speed counter, not a cost)
      expect(result.deedDeck).toHaveLength(0)
    })

    it('only the topmost color counts — no cascade through later cards', () => {
      // Topmost after 3 flips is C2 (red). Dummy has 0 red but 2 green; per the
      // rulebook NO extra cards are flipped (the green crystals are irrelevant).
      const cards: BasicActionCard[] = [
        makeCard(0, 'C0', 'green'),
        makeCard(1, 'C1', 'green'),
        makeCard(2, 'C2', 'red'),
        makeCard(3, 'C3', 'green'),
        makeCard(4, 'C4', 'green'),
      ]
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [...cards],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 2, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.executeDummyTurn(state)

      expect(result.cardsFlippedThisRound).toBe(3)
      expect(result.deedDeck).toHaveLength(2)
    })

    it('does not end the round when the deck empties mid-flip — ends on the next turn', () => {
      // Rulebook: "flip as many as you can. On his next turn, the Dummy player
      // announces End of the Round." Emptying the deck does NOT end it this turn.
      const cards = makeCards(2)
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [...cards],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.executeDummyTurn(state)
      expect(result.hasEndedRound).toBe(false)
      expect(result.deedDeck).toHaveLength(0)
      expect(result.discardPile).toHaveLength(2)

      // Next turn, with the deck empty, the dummy announces End of the Round.
      const next = dp.executeDummyTurn(result)
      expect(next.hasEndedRound).toBe(true)
    })

    it('sets hasEndedRound when deck is already empty', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: makeCards(5),
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.executeDummyTurn(state)

      expect(result.hasEndedRound).toBe(true)
    })
  })

  describe('getLastFlippedCardColor', () => {
    it('returns color of top discard card', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: [makeCard(0, 'A', 'red'), makeCard(1, 'B', 'blue')],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.getLastFlippedCardColor(state)).toBe('blue')
    })

    it('returns null when discard pile is empty', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(5),
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.getLastFlippedCardColor(state)).toBeNull()
    })
  })

  describe('shouldContinueFlipping', () => {
    it('returns true when crystal available and deck not empty', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(5),
        discardPile: [],
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.shouldContinueFlipping(state, 'red')).toBe(true)
    })

    it('returns false when no matching crystal', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(5),
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.shouldContinueFlipping(state, 'red')).toBe(false)
    })

    it('returns false when deck is empty', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: [],
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.shouldContinueFlipping(state, 'red')).toBe(false)
    })
  })

  describe('consumeCrystal', () => {
    it('removes one crystal of the specified color', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: [],
        crystals: { red: 2, blue: 1, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.consumeCrystal(state, 'red')

      expect(result.crystals.red).toBe(1)
      expect(result.crystals.blue).toBe(1)
    })

    it('does not go below zero', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      const result = dp.consumeCrystal(state, 'red')

      expect(result.crystals.red).toBe(0)
    })
  })

  describe('processRoundStartForDummy', () => {
    it('adds AA card to deck and reshuffles', () => {
      const aaCard = makeCard(99, 'NewAA', 'blue')
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(3),
        discardPile: makeCards(5).map((c) => ({ ...c, id: c.id + 100 })),
        crystals: { red: 0, blue: 1, green: 2, white: 0 },
        tacticCard: null,
        hasEndedRound: true,
        cardsFlippedThisRound: 8,
      }

      const result = dp.processRoundStartForDummy(state, aaCard, 'red')

      expect(result.deedDeck).toHaveLength(9)
      expect(result.discardPile).toHaveLength(0)
      expect(result.cardsFlippedThisRound).toBe(0)
      expect(result.hasEndedRound).toBe(false)
    })

    it('adds crystal of removed spell color', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: makeCards(5),
        crystals: { red: 0, blue: 1, green: 2, white: 0 },
        tacticCard: null,
        hasEndedRound: true,
        cardsFlippedThisRound: 5,
      }

      const result = dp.processRoundStartForDummy(state, null, 'white')

      expect(result.crystals.white).toBe(1)
      expect(result.crystals.blue).toBe(1)
    })

    it('handles null AA card and null spell color', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(3),
        discardPile: makeCards(2).map((c) => ({ ...c, id: c.id + 100 })),
        crystals: { red: 0, blue: 1, green: 2, white: 0 },
        tacticCard: null,
        hasEndedRound: true,
        cardsFlippedThisRound: 5,
      }

      const result = dp.processRoundStartForDummy(state, null, null)

      expect(result.deedDeck).toHaveLength(5)
      expect(result.discardPile).toHaveLength(0)
    })
  })

  describe('getDummyRemainingCards', () => {
    it('returns the number of cards in the deck', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(7),
        discardPile: makeCards(3),
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      expect(dp.getDummyRemainingCards(state)).toBe(7)
    })

    it('returns 0 when deck is empty', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: makeCards(10),
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: true,
        cardsFlippedThisRound: 0,
      }

      expect(dp.getDummyRemainingCards(state)).toBe(0)
    })
  })

  describe('selectDummyTactic', () => {
    it('picks a valid tactic randomly from the available list', () => {
      const tactics = [makeTactic(1, 5), makeTactic(2, 2), makeTactic(3, 8)]
      const { selected, remaining } = dp.selectDummyTactic(tactics)

      expect(tactics).toContainEqual(selected)
      expect(remaining).toHaveLength(2)
      expect(remaining.find((t) => t.id === selected.id)).toBeUndefined()
    })

    it('returns single tactic from array of one', () => {
      const tactics = [makeTactic(1, 3)]
      const { selected, remaining } = dp.selectDummyTactic(tactics)

      expect(selected.number).toBe(3)
      expect(remaining).toHaveLength(0)
    })
  })

  describe('immutability', () => {
    it('does not mutate state on executeDummyTurn', () => {
      const cards = makeCards(10)
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [...cards],
        discardPile: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }
      const originalDeckLength = state.deedDeck.length
      const originalDiscardLength = state.discardPile.length

      dp.executeDummyTurn(state)

      expect(state.deedDeck).toHaveLength(originalDeckLength)
      expect(state.discardPile).toHaveLength(originalDiscardLength)
      expect(state.hasEndedRound).toBe(false)
    })

    it('does not mutate state on consumeCrystal', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: [],
        discardPile: [],
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: false,
        cardsFlippedThisRound: 0,
      }

      dp.consumeCrystal(state, 'red')

      expect(state.crystals.red).toBe(2)
    })

    it('does not mutate state on processRoundStartForDummy', () => {
      const state: DummyPlayerState = {
        heroName: 'Goldyx',
        deedDeck: makeCards(3),
        discardPile: makeCards(5).map((c) => ({ ...c, id: c.id + 100 })),
        crystals: { red: 0, blue: 1, green: 0, white: 0 },
        tacticCard: null,
        hasEndedRound: true,
        cardsFlippedThisRound: 5,
      }
      const originalDeckLength = state.deedDeck.length
      const originalDiscardLength = state.discardPile.length

      dp.processRoundStartForDummy(state, makeCard(99, 'AA', 'blue'), 'red')

      expect(state.deedDeck).toHaveLength(originalDeckLength)
      expect(state.discardPile).toHaveLength(originalDiscardLength)
      expect(state.crystals.red).toBe(0)
      expect(state.hasEndedRound).toBe(true)
    })
  })
})
