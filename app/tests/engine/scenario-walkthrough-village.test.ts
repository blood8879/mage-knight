import { describe, it, expect, beforeEach } from 'vitest'
import { ReputationManager } from '@/engine/ReputationManager'
import { REPUTATION_TABLE } from '@/engine/GameState'

describe('Walkthrough: Village Interaction & Reputation (Phase 4)', () => {
  let repMgr: ReputationManager

  beforeEach(() => {
    repMgr = new ReputationManager()
  })

  describe('reputation modifiers', () => {
    it('reputation 0 gives 0 influence modifier', () => {
      expect(repMgr.getInfluenceModifier(0)).toBe(0)
    })

    it('reputation +3 gives +2 influence modifier', () => {
      expect(repMgr.getInfluenceModifier(3)).toBe(2)
    })

    it('reputation -3 gives -3 influence modifier', () => {
      expect(repMgr.getInfluenceModifier(-3)).toBe(-3)
    })

    it('reputation ≤ -5 means cannot interact at all', () => {
      expect(repMgr.canInteract(-5)).toBe(false)
      expect(repMgr.canInteract(-6)).toBe(false)
      expect(repMgr.canInteract(-7)).toBe(false)
    })
  })

  describe('reputation changes', () => {
    it('reputation clamps between -7 and +7', () => {
      expect(repMgr.changeReputation(6, 5)).toBe(7)
      expect(repMgr.changeReputation(-6, -5)).toBe(-7)
    })
  })

  describe('village healing', () => {
    it('healing at village costs 3 influence per wound', () => {
      const result = repMgr.canBuyHealing(9, 'village')
      expect(result.costPerHealing).toBe(3)
      expect(result.maxHealing).toBe(3)
    })

    it('monastery healing costs 2 influence per wound', () => {
      const result = repMgr.canBuyHealing(6, 'monastery')
      expect(result.costPerHealing).toBe(2)
      expect(result.maxHealing).toBe(3)
    })
  })

  describe('advanced action purchase', () => {
    it('buying advanced action from offer costs 6 influence', () => {
      expect(repMgr.canBuyAdvancedAction(6)).toBe(true)
      expect(repMgr.canBuyAdvancedAction(5)).toBe(false)
    })

    it('buying spell costs 7 influence + matching mana', () => {
      expect(repMgr.canBuySpell(7, true)).toBe(true)
      expect(repMgr.canBuySpell(7, false)).toBe(false)
      expect(repMgr.canBuySpell(6, true)).toBe(false)
    })
  })
})
