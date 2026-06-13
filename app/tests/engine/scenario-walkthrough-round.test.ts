import { describe, it, expect, beforeEach } from 'vitest'
import { TurnManager } from '@/engine/TurnManager'
import { SeededRandom } from '@/utils/random'
import type { TacticCard } from '@/engine/types'

function makeTactic(id: number, number: number, type: 'day' | 'night' = 'day'): TacticCard {
  return { id, name: `Tactic_${id}`, type, number, effect: `Effect for tactic ${id}`, isUsed: false }
}

function makeDayTactics(): TacticCard[] {
  return [makeTactic(1, 1), makeTactic(2, 2), makeTactic(3, 3), makeTactic(4, 4), makeTactic(5, 5), makeTactic(6, 6)]
}

describe('Walkthrough: Round & Turn Structure (Phase 1)', () => {
  let tm: TurnManager

  beforeEach(() => {
    const random = new SeededRandom(42)
    tm = new TurnManager(random)
  })

  it('dummy selects a valid tactic from available list', () => {
    const tactics = makeDayTactics()
    const { selected, remaining } = tm.selectTacticForDummy(tactics)
    expect(tactics).toContainEqual(selected)
    expect(remaining.find((t) => t.id === selected.id)).toBeUndefined()
  })

  it('turn order: lower tactic number goes first', () => {
    const playerTactic = makeTactic(3, 3)
    const dummyTactic = makeTactic(1, 1)
    expect(tm.determineTurnOrder(playerTactic, dummyTactic)).toBe('dummy_first')

    const playerTactic2 = makeTactic(1, 1)
    const dummyTactic2 = makeTactic(3, 3)
    expect(tm.determineTurnOrder(playerTactic2, dummyTactic2)).toBe('player_first')
  })

  it('round ends when both player and dummy have ended', () => {
    expect(tm.isRoundOver(true, true)).toBe(true)
    expect(tm.isRoundOver(true, false)).toBe(false)
    expect(tm.isRoundOver(false, true)).toBe(false)
  })

  it('used tactics are removed at end of round', () => {
    const tactics = makeDayTactics()
    const round = tm.startRound(1, 'day', tactics)
    const { selected: dummyT, remaining: afterDummy } = tm.selectTacticForDummy(round.availableTactics)
    const { selected: playerT, remaining: afterPlayer } = tm.selectTacticForPlayer(afterDummy, afterDummy[0].id)
    const updated = { ...round, availableTactics: afterPlayer, dummyTactic: dummyT, playerTactic: playerT }
    const ended = tm.endRound(updated)
    expect(ended.availableTactics).toHaveLength(4)
    expect(ended.availableTactics.find(t => t.id === dummyT.id)).toBeUndefined()
    expect(ended.availableTactics.find(t => t.id === playerT.id)).toBeUndefined()
  })
})
