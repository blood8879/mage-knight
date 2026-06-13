import { describe, it, expect, beforeEach } from 'vitest'
import { ManaPool } from '@/engine/ManaPool'
import { SeededRandom } from '@/utils/random'
import type { ManaPoolState, ManaColor, ExtendedManaColor } from '@/engine/types'
import { INITIAL_CRYSTALS, MAX_CRYSTAL_PER_COLOR } from '@/engine/GameState'

const BASIC_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']

describe('ManaPool', () => {
  let pool: ManaPool
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    pool = new ManaPool(random)
  })

  describe('initializeSource', () => {
    it('creates the correct number of dice', () => {
      const state = pool.initializeSource(5)
      expect(state.dice).toHaveLength(5)
    })

    it('all dice start in source', () => {
      const state = pool.initializeSource(4)
      expect(state.dice.every((d) => d.isInSource)).toBe(true)
    })

    it('dice have unique ids', () => {
      const state = pool.initializeSource(6)
      const ids = state.dice.map((d) => d.id)
      expect(new Set(ids).size).toBe(6)
    })

    it('dice have valid colors', () => {
      const state = pool.initializeSource(10)
      const validColors: ExtendedManaColor[] = ['red', 'blue', 'green', 'white', 'gold', 'black']
      for (const die of state.dice) {
        expect(validColors).toContain(die.color)
      }
    })

    it('enforces basic color majority', () => {
      for (let seed = 0; seed < 20; seed++) {
        const testPool = new ManaPool(new SeededRandom(seed))
        const state = testPool.initializeSource(6)
        const basicCount = state.dice.filter((d) =>
          BASIC_COLORS.includes(d.color as ManaColor),
        ).length
        expect(basicCount).toBeGreaterThanOrEqual(Math.ceil(6 / 2))
      }
    })

    it('starts with empty player mana and default crystals', () => {
      const state = pool.initializeSource(4)
      expect(state.playerMana).toEqual([])
      expect(state.crystals).toEqual(INITIAL_CRYSTALS)
      expect(state.sourceDieTakenThisTurn).toBe(false)
    })
  })

  describe('rollDie', () => {
    it('returns one of the 6 valid mana colors', () => {
      const validColors: ExtendedManaColor[] = ['red', 'blue', 'green', 'white', 'gold', 'black']
      for (let i = 0; i < 50; i++) {
        const color = pool.rollDie()
        expect(validColors).toContain(color)
      }
    })
  })

  describe('rerollSource', () => {
    it('rerolls all dice back to source', () => {
      let state = pool.initializeSource(4)
      state = pool.takeDieFromSource(state, 'die_0', 'day')
      state = pool.rerollSource(state)
      expect(state.dice.every((d) => d.isInSource)).toBe(true)
    })

    it('enforces basic color majority on reroll', () => {
      for (let seed = 0; seed < 20; seed++) {
        const testPool = new ManaPool(new SeededRandom(seed))
        let state = testPool.initializeSource(6)
        state = testPool.rerollSource(state)
        const basicCount = state.dice.filter((d) =>
          BASIC_COLORS.includes(d.color as ManaColor),
        ).length
        expect(basicCount).toBeGreaterThanOrEqual(Math.ceil(6 / 2))
      }
    })

    it('resets sourceDieTakenThisTurn', () => {
      let state = pool.initializeSource(4)
      state = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(state.sourceDieTakenThisTurn).toBe(true)
      state = pool.rerollSource(state)
      expect(state.sourceDieTakenThisTurn).toBe(false)
    })
  })

  describe('takeDieFromSource', () => {
    it('marks die as not in source and adds mana token', () => {
      const state = pool.initializeSource(4)
      const dieColor = state.dice[0].color
      const result = pool.takeDieFromSource(state, 'die_0', 'day')

      expect(result.dice[0].isInSource).toBe(false)
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0].color).toBe(dieColor)
      expect(result.playerMana[0].source).toBe('die')
    })

    it('sets sourceDieTakenThisTurn to true', () => {
      const state = pool.initializeSource(4)
      const result = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(result.sourceDieTakenThisTurn).toBe(true)
    })

    it('returns unchanged state for invalid die id', () => {
      const state = pool.initializeSource(4)
      const result = pool.takeDieFromSource(state, 'die_999', 'day')
      expect(result).toEqual(state)
    })

    it('returns unchanged state for die already taken', () => {
      const state = pool.initializeSource(4)
      const taken = pool.takeDieFromSource(state, 'die_0', 'day')
      const result = pool.takeDieFromSource(taken, 'die_0', 'day')
      expect(result.playerMana).toHaveLength(1)
    })
  })

  describe('returnDieToSource', () => {
    it('returns a taken die to source with new color', () => {
      let state = pool.initializeSource(4)
      state = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(state.dice[0].isInSource).toBe(false)

      const result = pool.returnDieToSource(state, 'die_0')
      expect(result.dice[0].isInSource).toBe(true)
    })

    it('returns unchanged state if die is already in source', () => {
      const state = pool.initializeSource(4)
      const result = pool.returnDieToSource(state, 'die_0')
      expect(result).toEqual(state)
    })
  })

  describe('returnAllDice', () => {
    it('returns all taken dice to source', () => {
      let state = pool.initializeSource(4)
      state = pool.takeDieFromSource(state, 'die_0', 'day')
      state = pool.takeDieFromSource(state, 'die_1', 'day')

      const result = pool.returnAllDice(state)
      expect(result.dice.every((d) => d.isInSource)).toBe(true)
    })
  })

  describe('addManaToken', () => {
    it('adds a mana token to player mana', () => {
      const state = pool.initializeSource(4)
      const result = pool.addManaToken(state, 'red', 'effect')
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0]).toEqual({ color: 'red', source: 'effect' })
    })

    it('adds gold and black tokens', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'gold', 'effect')
      state = pool.addManaToken(state, 'black', 'glade')
      expect(state.playerMana).toHaveLength(2)
      expect(state.playerMana[0].color).toBe('gold')
      expect(state.playerMana[1].color).toBe('black')
    })
  })

  describe('removeManaToken', () => {
    it('removes a specific mana token by index', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')
      state = pool.addManaToken(state, 'blue', 'effect')

      const result = pool.removeManaToken(state, 0)
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0].color).toBe('blue')
    })

    it('returns unchanged state for invalid index', () => {
      const state = pool.initializeSource(4)
      const result = pool.removeManaToken(state, 5)
      expect(result).toEqual(state)
    })
  })

  describe('clearPlayerMana', () => {
    it('removes all mana tokens', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')
      state = pool.addManaToken(state, 'blue', 'effect')
      state = pool.addManaToken(state, 'green', 'crystal')

      const result = pool.clearPlayerMana(state)
      expect(result.playerMana).toEqual([])
    })
  })

  describe('crystal management', () => {
    it('adds a crystal', () => {
      const state = pool.initializeSource(4)
      const result = pool.addCrystal(state, 'red')
      expect(result.crystals.red).toBe(1)
    })

    it('does not exceed max crystals per color', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      expect(state.crystals.red).toBe(MAX_CRYSTAL_PER_COLOR)

      const result = pool.addCrystal(state, 'red')
      expect(result.crystals.red).toBe(MAX_CRYSTAL_PER_COLOR)
      expect(result.playerMana.length).toBe(1)
    })

    it('removes a crystal', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'blue')
      state = pool.addCrystal(state, 'blue')

      const result = pool.removeCrystal(state, 'blue')
      expect(result.crystals.blue).toBe(1)
    })

    it('does not remove crystal below zero', () => {
      const state = pool.initializeSource(4)
      const result = pool.removeCrystal(state, 'blue')
      expect(result.crystals.blue).toBe(0)
      expect(result).toBe(state)
    })

    it('canAddCrystal returns true when below max', () => {
      const state = pool.initializeSource(4)
      expect(pool.canAddCrystal(state, 'green')).toBe(true)
    })

    it('canAddCrystal returns false at max', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'green')
      state = pool.addCrystal(state, 'green')
      state = pool.addCrystal(state, 'green')
      expect(pool.canAddCrystal(state, 'green')).toBe(false)
    })

    it('useCrystalAsMana converts crystal to mana token', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'white')
      state = pool.addCrystal(state, 'white')

      const result = pool.useCrystalAsMana(state, 'white')
      expect(result.crystals.white).toBe(1)
      expect(result.playerMana).toHaveLength(1)
      expect(result.playerMana[0]).toEqual({ color: 'white', source: 'crystal' })
    })

    it('useCrystalAsMana returns unchanged when no crystals', () => {
      const state = pool.initializeSource(4)
      const result = pool.useCrystalAsMana(state, 'red')
      expect(result).toBe(state)
    })

    it('getTotalCrystals sums all colors', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'blue')
      state = pool.addCrystal(state, 'blue')
      state = pool.addCrystal(state, 'green')

      expect(pool.getTotalCrystals(state)).toBe(4)
    })
  })

  describe('day/night mana rules', () => {
    it('gold is usable during day', () => {
      expect(pool.isGoldUsable('day')).toBe(true)
    })

    it('gold is not usable at night', () => {
      expect(pool.isGoldUsable('night')).toBe(false)
    })

    it('black is usable at night', () => {
      expect(pool.isBlackUsable('night')).toBe(true)
    })

    it('black is not usable during day', () => {
      expect(pool.isBlackUsable('day')).toBe(false)
    })
  })

  describe('canUseManaColor', () => {
    it('returns true when player has matching token', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')
      expect(pool.canUseManaColor(state, 'red', 'day')).toBe(true)
    })

    it('gold counts as any basic color during day', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'gold', 'die')
      expect(pool.canUseManaColor(state, 'red', 'day')).toBe(true)
      expect(pool.canUseManaColor(state, 'blue', 'day')).toBe(true)
    })

    it('gold does NOT count as basic at night', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'gold', 'die')
      expect(pool.canUseManaColor(state, 'red', 'night')).toBe(false)
    })

    it('returns true when player has crystal of that color', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'blue')
      expect(pool.canUseManaColor(state, 'blue', 'day')).toBe(true)
    })

    it('returns false when no matching mana or crystal', () => {
      const state = pool.initializeSource(4)
      expect(pool.canUseManaColor(state, 'red', 'day')).toBe(false)
    })
  })

  describe('getAvailableManaColors', () => {
    it('returns basic colors from tokens', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')
      state = pool.addManaToken(state, 'blue', 'die')

      const colors = pool.getAvailableManaColors(state, 'day')
      expect(colors).toContain('red')
      expect(colors).toContain('blue')
    })

    it('includes gold during day', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'gold', 'die')

      const dayColors = pool.getAvailableManaColors(state, 'day')
      expect(dayColors).toContain('gold')

      const nightColors = pool.getAvailableManaColors(state, 'night')
      expect(nightColors).not.toContain('gold')
    })

    it('includes black at night', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'black', 'effect')

      const nightColors = pool.getAvailableManaColors(state, 'night')
      expect(nightColors).toContain('black')

      const dayColors = pool.getAvailableManaColors(state, 'day')
      expect(dayColors).not.toContain('black')
    })

    it('includes colors from crystals', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'green')

      const colors = pool.getAvailableManaColors(state, 'day')
      expect(colors).toContain('green')
    })

    it('returns unique colors', () => {
      let state = pool.initializeSource(4)
      state = pool.addManaToken(state, 'red', 'effect')
      state = pool.addManaToken(state, 'red', 'die')
      state = pool.addCrystal(state, 'red')

      const colors = pool.getAvailableManaColors(state, 'day')
      const redCount = colors.filter((c) => c === 'red').length
      expect(redCount).toBe(1)
    })
  })

  describe('resetTurnState', () => {
    it('returns all dice, clears mana, resets flag', () => {
      let state = pool.initializeSource(4)
      state = pool.takeDieFromSource(state, 'die_0', 'day')
      state = pool.addManaToken(state, 'blue', 'effect')

      const result = pool.resetTurnState(state)
      expect(result.dice.every((d) => d.isInSource)).toBe(true)
      expect(result.playerMana).toEqual([])
      expect(result.sourceDieTakenThisTurn).toBe(false)
    })

    it('preserves crystals', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'blue')
      state = pool.addManaToken(state, 'green', 'effect')

      const result = pool.resetTurnState(state)
      expect(result.crystals.red).toBe(1)
      expect(result.crystals.blue).toBe(1)
    })
  })

  describe('immutability', () => {
    it('initializeSource does not share references with INITIAL_MANA_POOL', () => {
      const state1 = pool.initializeSource(4)
      const state2 = pool.initializeSource(4)
      expect(state1).not.toBe(state2)
      expect(state1.dice).not.toBe(state2.dice)
      expect(state1.crystals).not.toBe(state2.crystals)
    })

    it('takeDieFromSource returns a new state object', () => {
      const state = pool.initializeSource(4)
      const result = pool.takeDieFromSource(state, 'die_0', 'day')
      expect(result).not.toBe(state)
      expect(result.dice).not.toBe(state.dice)
      expect(result.playerMana).not.toBe(state.playerMana)
    })

    it('addCrystal returns a new state object', () => {
      const state = pool.initializeSource(4)
      const result = pool.addCrystal(state, 'red')
      expect(result).not.toBe(state)
      expect(result.crystals).not.toBe(state.crystals)
      expect(state.crystals.red).toBe(0)
    })

    it('original state is not mutated after multiple operations', () => {
      const original = pool.initializeSource(4)
      const originalDice = [...original.dice]
      const originalMana = [...original.playerMana]

      pool.takeDieFromSource(original, 'die_0', 'day')
      pool.addManaToken(original, 'red', 'effect')
      pool.addCrystal(original, 'blue')

      expect(original.dice).toEqual(originalDice)
      expect(original.playerMana).toEqual(originalMana)
      expect(original.crystals.blue).toBe(0)
    })
  })
})
