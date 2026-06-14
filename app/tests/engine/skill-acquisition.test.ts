import { describe, it, expect } from 'vitest'
import { SkillManager } from '@/engine/SkillManager'
import type { HeroSkill } from '@/engine/types'

function skill(id: number, name: string): HeroSkill {
  return { id, name, type: 'once_per_turn', effect: '', actions: [], isFlipped: false, isUsedThisTurn: false }
}

describe('SkillManager.processSkillAcquisition — level-up choice A/B', () => {
  const mgr = new SkillManager()

  it('Choice A: takes one revealed skill, the other goes to Common, AA anywhere', () => {
    const deck = [skill(1, 'A1'), skill(2, 'A2'), skill(3, 'A3')]
    const res = mgr.processSkillAcquisition(deck, [], 'A', 0)
    expect(res.acquiredSkill.id).toBe(1)
    expect(res.newCommonSkills.map((s) => s.id)).toEqual([2]) // unchosen → Common
    expect(res.remainingPlayerDeck.map((s) => s.id)).toEqual([3])
    expect(res.aaCardPosition).toBe('any')
  })

  it('Choice B: takes a skill from the Common pool, AA forced to bottom', () => {
    const deck = [skill(1, 'A1'), skill(2, 'A2')]
    const common = [skill(101, 'Dummy1'), skill(102, 'Dummy2')]
    const res = mgr.processSkillAcquisition(deck, common, 'B', 1)
    expect(res.acquiredSkill.id).toBe(102) // picked from Common
    expect(res.aaCardPosition).toBe('bottom')
    // both revealed player skills get pushed to Common; picked one removed
    expect(res.newCommonSkills.map((s) => s.id)).toContain(101)
    expect(res.newCommonSkills.map((s) => s.id)).not.toContain(102)
    expect(res.newCommonSkills.map((s) => s.id)).toEqual(expect.arrayContaining([1, 2]))
  })

  it('Choice B is impossible while the Common pool is empty (first level-up)', () => {
    const deck = [skill(1, 'A1'), skill(2, 'A2')]
    expect(() => mgr.processSkillAcquisition(deck, [], 'B', 0)).toThrow(/Common Skills pile is empty/)
  })

  it('empty player skill deck throws (acquisition skipped by caller)', () => {
    expect(() => mgr.processSkillAcquisition([], [skill(101, 'D1')], 'A', 0)).toThrow(/skill deck is empty/i)
  })
})
