import { describe, it, expect } from 'vitest'
import { LevelUpManager } from '@/engine/LevelUpManager'
import { FAME_LEVEL_THRESHOLDS } from '@/engine/GameState'

describe('Walkthrough: Level Up (Phase 10)', () => {
  const mgr = new LevelUpManager()

  describe('fame thresholds', () => {
    it('level thresholds are [0, 3, 8, 15, 24, 35, 48, 63, 80, 99]', () => {
      expect(FAME_LEVEL_THRESHOLDS).toEqual([0, 3, 8, 15, 24, 35, 48, 63, 80, 99])
    })

    it('gaining fame from 0 to 3 triggers level 2', () => {
      const result = mgr.addFame(0, 3)
      expect(result.newLevel).toBe(2)
      expect(result.levelsGained).toBe(1)
    })

    it('gaining fame from 7 to 8 triggers level 3', () => {
      const result = mgr.addFame(7, 1)
      expect(result.newFame).toBe(8)
      expect(result.newLevel).toBe(3)
      expect(result.levelsGained).toBe(1)
    })
  })

  describe('level up rewards', () => {
    it('level 2 gives advanced action + skill, unit limit becomes 2', () => {
      const reward = mgr.getLevelUpReward(2)
      expect(reward.type).toBe('advanced_action_and_skill')
      expect(reward.newUnitLimit).toBe(2)
    })

    it('level 3 gives stat boost, armor becomes 3', () => {
      const reward = mgr.getLevelUpReward(3)
      expect(reward.type).toBe('stat_boost')
      expect(reward.newArmor).toBe(3)
    })
  })
})
