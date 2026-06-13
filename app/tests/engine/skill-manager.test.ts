import { describe, it, expect, beforeEach } from 'vitest'
import { SkillManager } from '@/engine/SkillManager'
import type { HeroSkill, SkillUsage } from '@/engine/types'

function makeSkill(id: number, type: SkillUsage, opts: Partial<HeroSkill> = {}): HeroSkill {
  return {
    id,
    name: `Skill_${id}`,
    type,
    effect: 'test effect',
    actions: [],
    isFlipped: false,
    isUsedThisTurn: false,
    ...opts,
  }
}

describe('SkillManager', () => {
  let sm: SkillManager

  beforeEach(() => {
    sm = new SkillManager()
  })

  // ── canActivateSkill ─────────────────────────────────────────────────

  describe('canActivateSkill', () => {
    it('once_per_round: returns true when not flipped', () => {
      const skill = makeSkill(1, 'once_per_round')
      expect(sm.canActivateSkill(skill)).toBe(true)
    })

    it('once_per_round: returns false when already flipped', () => {
      const skill = makeSkill(1, 'once_per_round', { isFlipped: true })
      expect(sm.canActivateSkill(skill)).toBe(false)
    })

    it('interactive_once_per_round: returns true when not flipped', () => {
      const skill = makeSkill(2, 'interactive_once_per_round')
      expect(sm.canActivateSkill(skill)).toBe(true)
    })

    it('interactive_once_per_round: returns false when flipped', () => {
      const skill = makeSkill(2, 'interactive_once_per_round', { isFlipped: true })
      expect(sm.canActivateSkill(skill)).toBe(false)
    })

    it('once_per_turn: returns true when not used this turn', () => {
      const skill = makeSkill(3, 'once_per_turn')
      expect(sm.canActivateSkill(skill)).toBe(true)
    })

    it('once_per_turn: returns false when already used this turn', () => {
      const skill = makeSkill(3, 'once_per_turn', { isUsedThisTurn: true })
      expect(sm.canActivateSkill(skill)).toBe(false)
    })

    it('passive: always returns true', () => {
      const skill = makeSkill(4, 'passive')
      expect(sm.canActivateSkill(skill)).toBe(true)
    })
  })

  // ── activateSkill ────────────────────────────────────────────────────

  describe('activateSkill', () => {
    it('flips once_per_round skill on activation', () => {
      const skills = [makeSkill(1, 'once_per_round')]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(result[0].isFlipped).toBe(true)
    })

    it('flips interactive_once_per_round skill on activation', () => {
      const skills = [makeSkill(1, 'interactive_once_per_round')]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(result[0].isFlipped).toBe(true)
    })

    it('marks once_per_turn skill as used on activation', () => {
      const skills = [makeSkill(1, 'once_per_turn')]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(result[0].isUsedThisTurn).toBe(true)
    })

    it('passive skill remains unchanged on activation', () => {
      const skills = [makeSkill(1, 'passive')]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(result[0].isFlipped).toBe(false)
      expect(result[0].isUsedThisTurn).toBe(false)
    })

    it('does not activate an already-flipped once_per_round skill', () => {
      const skills = [makeSkill(1, 'once_per_round', { isFlipped: true })]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      // returns unchanged
      expect(result).toEqual(skills)
    })

    it('does not activate already-used once_per_turn skill', () => {
      const skills = [makeSkill(1, 'once_per_turn', { isUsedThisTurn: true })]
      const result = sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(result).toEqual(skills)
    })

    it('returns unchanged array for out-of-bounds index', () => {
      const skills = [makeSkill(1, 'once_per_round')]
      expect(sm.activateSkill(skills, 5, { isNewTurn: false })).toEqual(skills)
      expect(sm.activateSkill(skills, -1, { isNewTurn: false })).toEqual(skills)
    })

    it('only modifies the targeted skill, leaving others unchanged', () => {
      const skills = [
        makeSkill(1, 'once_per_round'),
        makeSkill(2, 'once_per_round'),
        makeSkill(3, 'once_per_turn'),
      ]
      const result = sm.activateSkill(skills, 1, { isNewTurn: false })
      expect(result[0].isFlipped).toBe(false)
      expect(result[1].isFlipped).toBe(true)
      expect(result[2].isUsedThisTurn).toBe(false)
    })

    it('does not mutate original skills array', () => {
      const skills = [makeSkill(1, 'once_per_round')]
      sm.activateSkill(skills, 0, { isNewTurn: false })
      expect(skills[0].isFlipped).toBe(false)
    })
  })

  // ── resetSkillsForRound ──────────────────────────────────────────────

  describe('resetSkillsForRound', () => {
    it('resets flipped once_per_round skills', () => {
      const skills = [makeSkill(1, 'once_per_round', { isFlipped: true })]
      const result = sm.resetSkillsForRound(skills)
      expect(result[0].isFlipped).toBe(false)
    })

    it('resets flipped interactive_once_per_round skills', () => {
      const skills = [makeSkill(1, 'interactive_once_per_round', { isFlipped: true })]
      const result = sm.resetSkillsForRound(skills)
      expect(result[0].isFlipped).toBe(false)
    })

    it('does not reset once_per_turn skills', () => {
      const skills = [makeSkill(1, 'once_per_turn', { isUsedThisTurn: true })]
      const result = sm.resetSkillsForRound(skills)
      // once_per_turn isUsedThisTurn should be untouched by round reset
      expect(result[0].isUsedThisTurn).toBe(true)
    })

    it('does not affect passive skills', () => {
      const skills = [makeSkill(1, 'passive')]
      const result = sm.resetSkillsForRound(skills)
      expect(result[0]).toEqual(skills[0])
    })

    it('resets all once_per_round skills in a mixed array', () => {
      const skills = [
        makeSkill(1, 'once_per_round', { isFlipped: true }),
        makeSkill(2, 'once_per_turn', { isUsedThisTurn: true }),
        makeSkill(3, 'interactive_once_per_round', { isFlipped: true }),
        makeSkill(4, 'passive'),
      ]
      const result = sm.resetSkillsForRound(skills)
      expect(result[0].isFlipped).toBe(false)
      expect(result[1].isUsedThisTurn).toBe(true) // unchanged
      expect(result[2].isFlipped).toBe(false)
      expect(result[3].isFlipped).toBe(false) // was already false
    })

    it('does not mutate original skills array', () => {
      const skills = [makeSkill(1, 'once_per_round', { isFlipped: true })]
      sm.resetSkillsForRound(skills)
      expect(skills[0].isFlipped).toBe(true)
    })
  })

  // ── resetSkillsForTurn ───────────────────────────────────────────────

  describe('resetSkillsForTurn', () => {
    it('resets isUsedThisTurn for once_per_turn skills', () => {
      const skills = [makeSkill(1, 'once_per_turn', { isUsedThisTurn: true })]
      const result = sm.resetSkillsForTurn(skills)
      expect(result[0].isUsedThisTurn).toBe(false)
    })

    it('does not reset once_per_round skills', () => {
      const skills = [makeSkill(1, 'once_per_round', { isFlipped: true })]
      const result = sm.resetSkillsForTurn(skills)
      expect(result[0].isFlipped).toBe(true) // unchanged
    })

    it('does not affect passive skills', () => {
      const skills = [makeSkill(1, 'passive')]
      const result = sm.resetSkillsForTurn(skills)
      expect(result[0]).toEqual(skills[0])
    })

    it('only resets once_per_turn in a mixed array', () => {
      const skills = [
        makeSkill(1, 'once_per_turn', { isUsedThisTurn: true }),
        makeSkill(2, 'once_per_round', { isFlipped: true }),
        makeSkill(3, 'passive'),
      ]
      const result = sm.resetSkillsForTurn(skills)
      expect(result[0].isUsedThisTurn).toBe(false)
      expect(result[1].isFlipped).toBe(true) // unchanged
    })

    it('does not mutate original skills array', () => {
      const skills = [makeSkill(1, 'once_per_turn', { isUsedThisTurn: true })]
      sm.resetSkillsForTurn(skills)
      expect(skills[0].isUsedThisTurn).toBe(true)
    })
  })

  // ── processSkillAcquisition ──────────────────────────────────────────

  describe('processSkillAcquisition', () => {
    const skillA = makeSkill(10, 'once_per_round')
    const skillB = makeSkill(11, 'once_per_turn')
    const skillC = makeSkill(12, 'passive')
    const commonSkillX = makeSkill(20, 'once_per_round')
    const commonSkillY = makeSkill(21, 'passive')

    describe('Choice A', () => {
      it('acquires first of two revealed skills; other goes to common', () => {
        const playerDeck = [skillA, skillB, skillC]
        const commonSkills = [commonSkillX]

        const result = sm.processSkillAcquisition(playerDeck, commonSkills, 'A', 0)

        expect(result.acquiredSkill.id).toBe(skillA.id)
        expect(result.newCommonSkills).toHaveLength(2)
        expect(result.newCommonSkills.find((s) => s.id === skillB.id)).toBeDefined()
        expect(result.newCommonSkills.find((s) => s.id === commonSkillX.id)).toBeDefined()
        expect(result.remainingPlayerDeck).toHaveLength(1)
        expect(result.remainingPlayerDeck[0].id).toBe(skillC.id)
        expect(result.aaCardPosition).toBe('any')
      })

      it('acquires second of two revealed skills; first goes to common', () => {
        const playerDeck = [skillA, skillB, skillC]
        const commonSkills: HeroSkill[] = []

        const result = sm.processSkillAcquisition(playerDeck, commonSkills, 'A', 1)

        expect(result.acquiredSkill.id).toBe(skillB.id)
        expect(result.newCommonSkills).toHaveLength(1)
        expect(result.newCommonSkills[0].id).toBe(skillA.id)
        expect(result.aaCardPosition).toBe('any')
      })

      it('works with only one skill in player deck (reveals 1)', () => {
        const playerDeck = [skillA]
        const commonSkills: HeroSkill[] = []

        const result = sm.processSkillAcquisition(playerDeck, commonSkills, 'A', 0)

        expect(result.acquiredSkill.id).toBe(skillA.id)
        expect(result.newCommonSkills).toHaveLength(0) // no other skill to send
        expect(result.remainingPlayerDeck).toHaveLength(0)
      })

      it('throws on invalid selectedSkillIndex for choice A', () => {
        const playerDeck = [skillA, skillB]
        expect(() =>
          sm.processSkillAcquisition(playerDeck, [], 'A', 5),
        ).toThrow()
      })

      it('does not mutate original playerSkillDeck', () => {
        const playerDeck = [skillA, skillB, skillC]
        const originalLength = playerDeck.length
        sm.processSkillAcquisition(playerDeck, [], 'A', 0)
        expect(playerDeck).toHaveLength(originalLength)
      })
    })

    describe('Choice B', () => {
      it('acquires from common skills; both revealed go to common', () => {
        const playerDeck = [skillA, skillB, skillC]
        const commonSkills = [commonSkillX, commonSkillY]

        const result = sm.processSkillAcquisition(playerDeck, commonSkills, 'B', 0)

        expect(result.acquiredSkill.id).toBe(commonSkillX.id)
        // commonSkillY remains + skillA + skillB added
        expect(result.newCommonSkills).toHaveLength(3)
        expect(result.newCommonSkills.find((s) => s.id === commonSkillY.id)).toBeDefined()
        expect(result.newCommonSkills.find((s) => s.id === skillA.id)).toBeDefined()
        expect(result.newCommonSkills.find((s) => s.id === skillB.id)).toBeDefined()
        expect(result.remainingPlayerDeck).toHaveLength(1)
        expect(result.remainingPlayerDeck[0].id).toBe(skillC.id)
        expect(result.aaCardPosition).toBe('bottom')
      })

      it('acquires second common skill on index 1', () => {
        const playerDeck = [skillA, skillB]
        const commonSkills = [commonSkillX, commonSkillY]

        const result = sm.processSkillAcquisition(playerDeck, commonSkills, 'B', 1)

        expect(result.acquiredSkill.id).toBe(commonSkillY.id)
        expect(result.newCommonSkills.find((s) => s.id === commonSkillX.id)).toBeDefined()
        expect(result.newCommonSkills.find((s) => s.id === skillA.id)).toBeDefined()
        expect(result.newCommonSkills.find((s) => s.id === skillB.id)).toBeDefined()
      })

      it('EC-09-A-1: throws when common skills is empty for choice B', () => {
        const playerDeck = [skillA, skillB]
        expect(() =>
          sm.processSkillAcquisition(playerDeck, [], 'B', 0),
        ).toThrow('EC-09-A-1')
      })

      it('throws on invalid selectedSkillIndex for choice B', () => {
        const playerDeck = [skillA, skillB]
        const commonSkills = [commonSkillX]
        expect(() =>
          sm.processSkillAcquisition(playerDeck, commonSkills, 'B', 5),
        ).toThrow()
      })

      it('does not mutate original commonSkills array', () => {
        const playerDeck = [skillA, skillB]
        const commonSkills = [commonSkillX, commonSkillY]
        const originalLength = commonSkills.length
        sm.processSkillAcquisition(playerDeck, commonSkills, 'B', 0)
        expect(commonSkills).toHaveLength(originalLength)
      })
    })

    describe('EC-09-A-2: empty player skill deck', () => {
      it('throws when playerSkillDeck is empty', () => {
        expect(() =>
          sm.processSkillAcquisition([], [commonSkillX], 'A', 0),
        ).toThrow('EC-09-A-2')
      })

      it('throws for choice B as well when playerSkillDeck is empty', () => {
        expect(() =>
          sm.processSkillAcquisition([], [commonSkillX], 'B', 0),
        ).toThrow('EC-09-A-2')
      })
    })
  })
})
