import { describe, it, expect, beforeEach } from 'vitest'
import { ManaPool } from '@/engine/ManaPool'
import { SeededRandom } from '@/utils/random'
import { MAX_CRYSTAL_PER_COLOR } from '@/engine/GameState'
import type { ManaPoolState, ManaColor } from '@/engine/types'

describe('Walkthrough: Mana System (Phase 3)', () => {
  let pool: ManaPool
  let random: SeededRandom

  beforeEach(() => {
    random = new SeededRandom(42)
    pool = new ManaPool(random)
  })

  describe('source initialization', () => {
    it('initializes source with correct number of dice (4 for First Recon)', () => {
      const state = pool.initializeSource(4)
      expect(state.dice).toHaveLength(4)
      expect(state.dice.every(d => d.isInSource)).toBe(true)
    })

    it('at least half the dice must show basic colors', () => {
      const state = pool.initializeSource(4)
      const basicColors = ['red', 'blue', 'green', 'white']
      const basicCount = state.dice.filter(d => basicColors.includes(d.color)).length
      expect(basicCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('taking dice from source', () => {
    it('player can take one die from source per turn', () => {
      const state = pool.initializeSource(4)
      const dieId = state.dice[0].id
      const after = pool.takeDieFromSource(state, dieId)
      expect(after.sourceDieTakenThisTurn).toBe(true)
      expect(after.playerMana).toHaveLength(1)
      expect(after.playerMana[0].source).toBe('die')
    })
  })

  describe('gold and black mana', () => {
    it('gold mana is usable during day only', () => {
      expect(pool.isGoldUsable('day')).toBe(true)
      expect(pool.isGoldUsable('night')).toBe(false)
    })

    it('black mana is usable during night only', () => {
      expect(pool.isBlackUsable('night')).toBe(true)
      expect(pool.isBlackUsable('day')).toBe(false)
    })
  })

  describe('crystals', () => {
    it('crystal limit is 3 per color', () => {
      expect(MAX_CRYSTAL_PER_COLOR).toBe(3)
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      state = pool.addCrystal(state, 'red')
      expect(state.crystals.red).toBe(3)
      state = pool.addCrystal(state, 'red')
      expect(state.crystals.red).toBe(3)
    })

    it('crystal can be spent as mana of its color', () => {
      let state = pool.initializeSource(4)
      state = pool.addCrystal(state, 'blue')
      expect(state.crystals.blue).toBe(1)
      state = pool.useCrystalAsMana(state, 'blue')
      expect(state.crystals.blue).toBe(0)
      expect(state.playerMana).toHaveLength(1)
      expect(state.playerMana[0].color).toBe('blue')
      expect(state.playerMana[0].source).toBe('crystal')
    })
  })
})
