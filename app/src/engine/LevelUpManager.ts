import type { HeroSkill } from './types'
import { FAME_LEVEL_THRESHOLDS } from './GameState'

export interface LevelUpReward {
  type: 'stat_boost' | 'advanced_action_and_skill'
  newArmor: number
  newHandLimit: number
  newUnitLimit: number
}

const LEVEL_PROGRESSION: Array<{
  level: number
  armor: number
  handLimit: number
  unitLimit: number
  reward: 'none' | 'stat_boost' | 'advanced_action_and_skill'
}> = [
  { level: 1, armor: 2, handLimit: 5, unitLimit: 1, reward: 'none' },
  { level: 2, armor: 2, handLimit: 5, unitLimit: 2, reward: 'advanced_action_and_skill' },
  { level: 3, armor: 3, handLimit: 5, unitLimit: 2, reward: 'stat_boost' },
  { level: 4, armor: 3, handLimit: 5, unitLimit: 3, reward: 'advanced_action_and_skill' },
  { level: 5, armor: 3, handLimit: 6, unitLimit: 3, reward: 'stat_boost' },
  { level: 6, armor: 3, handLimit: 6, unitLimit: 4, reward: 'advanced_action_and_skill' },
  { level: 7, armor: 4, handLimit: 6, unitLimit: 4, reward: 'stat_boost' },
  { level: 8, armor: 4, handLimit: 6, unitLimit: 5, reward: 'advanced_action_and_skill' },
  { level: 9, armor: 4, handLimit: 7, unitLimit: 5, reward: 'stat_boost' },
  { level: 10, armor: 4, handLimit: 7, unitLimit: 5, reward: 'advanced_action_and_skill' },
]

export class LevelUpManager {
  addFame(
    currentFame: number,
    amount: number,
  ): { newFame: number; levelsGained: number; newLevel: number } {
    const oldLevel = this.getCurrentLevel(currentFame)
    const newFame = currentFame + amount
    const newLevel = this.getCurrentLevel(newFame)
    return {
      newFame,
      levelsGained: newLevel - oldLevel,
      newLevel,
    }
  }

  getCurrentLevel(fame: number): number {
    let level = 1
    for (let i = FAME_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (fame >= FAME_LEVEL_THRESHOLDS[i]) {
        level = i + 1
        break
      }
    }
    return level
  }

  getFameToNextLevel(fame: number): number {
    const level = this.getCurrentLevel(fame)
    if (level >= FAME_LEVEL_THRESHOLDS.length) return 0
    return FAME_LEVEL_THRESHOLDS[level] - fame
  }

  getProgressToNextLevel(fame: number): number {
    const level = this.getCurrentLevel(fame)
    if (level >= FAME_LEVEL_THRESHOLDS.length) return 1.0
    const currentThreshold = FAME_LEVEL_THRESHOLDS[level - 1]
    const nextThreshold = FAME_LEVEL_THRESHOLDS[level]
    const range = nextThreshold - currentThreshold
    if (range === 0) return 1.0
    return (fame - currentThreshold) / range
  }

  getLevelUpReward(level: number): LevelUpReward {
    const entry = LEVEL_PROGRESSION.find((e) => e.level === level)
    if (!entry) {
      return { type: 'stat_boost', newArmor: 2, newHandLimit: 5, newUnitLimit: 1 }
    }
    const rewardType = entry.reward === 'none' ? 'stat_boost' : entry.reward
    return {
      type: rewardType,
      newArmor: entry.armor,
      newHandLimit: entry.handLimit,
      newUnitLimit: entry.unitLimit,
    }
  }

  getSkillChoice(skillDeck: HeroSkill[], count: number): HeroSkill[] {
    return skillDeck.slice(0, count)
  }

  processLevelUp(playerLevel: number, newLevel: number): LevelUpReward[] {
    const rewards: LevelUpReward[] = []
    for (let level = playerLevel + 1; level <= newLevel; level++) {
      rewards.push(this.getLevelUpReward(level))
    }
    return rewards
  }
}
