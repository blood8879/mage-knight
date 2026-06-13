import type { HeroSkill } from './types'

export class SkillManager {
  /**
   * Activate a skill at the given index, respecting usage limits.
   * Returns updated skills array (immutable).
   */
  activateSkill(
    skills: HeroSkill[],
    skillIndex: number,
    _context: { isNewTurn: boolean },
  ): HeroSkill[] {
    if (skillIndex < 0 || skillIndex >= skills.length) return skills

    const skill = skills[skillIndex]
    if (!this.canActivateSkill(skill)) return skills

    return skills.map((s, i) => {
      if (i !== skillIndex) return s
      switch (s.type) {
        case 'once_per_round':
        case 'interactive_once_per_round':
          return { ...s, isFlipped: true }
        case 'once_per_turn':
          return { ...s, isUsedThisTurn: true }
        case 'passive':
          // passive skills don't track usage
          return s
        default:
          return s
      }
    })
  }

  /**
   * Returns true if the skill can currently be activated.
   */
  canActivateSkill(skill: HeroSkill): boolean {
    switch (skill.type) {
      case 'once_per_round':
      case 'interactive_once_per_round':
        return !skill.isFlipped
      case 'once_per_turn':
        return !skill.isUsedThisTurn
      case 'passive':
        return true
      default:
        return false
    }
  }

  /**
   * Reset once_per_round and interactive_once_per_round skills at round start.
   * Returns updated skills array (immutable).
   */
  resetSkillsForRound(skills: HeroSkill[]): HeroSkill[] {
    return skills.map((s) => {
      if (s.type === 'once_per_round' || s.type === 'interactive_once_per_round') {
        return { ...s, isFlipped: false }
      }
      return s
    })
  }

  /**
   * Reset once_per_turn skills at turn start.
   * Returns updated skills array (immutable).
   */
  resetSkillsForTurn(skills: HeroSkill[]): HeroSkill[] {
    return skills.map((s) => {
      if (s.type === 'once_per_turn') {
        return { ...s, isUsedThisTurn: false }
      }
      return s
    })
  }

  /**
   * Process skill acquisition during level-up.
   *
   * Choice A: Take 1 from the 2 revealed player deck skills → other goes to Common Skills.
   *           AA card may be placed ANYWHERE in the offer.
   *
   * Choice B: Take 1 from Common Skills → both revealed player deck skills go to Common Skills.
   *           AA card goes to BOTTOM of offer.
   *           Precondition: commonSkills must be non-empty (EC-09-A-1).
   *
   * EC-09-A-2: If playerSkillDeck is empty, skip — returns no acquisition (null).
   */
  processSkillAcquisition(
    playerSkillDeck: HeroSkill[],
    commonSkills: HeroSkill[],
    choice: 'A' | 'B',
    selectedSkillIndex: number,
  ): {
    acquiredSkill: HeroSkill
    newCommonSkills: HeroSkill[]
    remainingPlayerDeck: HeroSkill[]
    aaCardPosition: 'any' | 'bottom'
  } {
    // EC-09-A-2: skill deck empty
    if (playerSkillDeck.length === 0) {
      throw new Error('EC-09-A-2: Player skill deck is empty — skill acquisition cannot proceed')
    }

    if (choice === 'A') {
      // Reveal up to 2 skills from top of player deck
      const revealed = playerSkillDeck.slice(0, 2)
      const remaining = playerSkillDeck.slice(2)

      if (selectedSkillIndex < 0 || selectedSkillIndex >= revealed.length) {
        throw new Error(`Invalid selectedSkillIndex ${selectedSkillIndex} for revealed skills of length ${revealed.length}`)
      }

      const acquiredSkill = revealed[selectedSkillIndex]
      // The other revealed skill goes to common skills
      const otherSkills = revealed.filter((_, i) => i !== selectedSkillIndex)
      const newCommonSkills = [...commonSkills, ...otherSkills]

      return {
        acquiredSkill,
        newCommonSkills,
        remainingPlayerDeck: remaining,
        aaCardPosition: 'any',
      }
    } else {
      // Choice B
      // EC-09-A-1: common skills must be non-empty
      if (commonSkills.length === 0) {
        throw new Error('EC-09-A-1: Choice B unavailable — Common Skills pile is empty')
      }

      if (selectedSkillIndex < 0 || selectedSkillIndex >= commonSkills.length) {
        throw new Error(`Invalid selectedSkillIndex ${selectedSkillIndex} for commonSkills of length ${commonSkills.length}`)
      }

      const acquiredSkill = commonSkills[selectedSkillIndex]
      // Both revealed player deck skills go to common
      const revealed = playerSkillDeck.slice(0, 2)
      const remaining = playerSkillDeck.slice(2)
      const newCommonSkills = [
        ...commonSkills.filter((_, i) => i !== selectedSkillIndex),
        ...revealed,
      ]

      return {
        acquiredSkill,
        newCommonSkills,
        remainingPlayerDeck: remaining,
        aaCardPosition: 'bottom',
      }
    }
  }
}
