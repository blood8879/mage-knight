import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCombatCards } from '@/hooks/useCombatCards'
import { deductAgilityMove } from '@/hooks/useCombat'
import { CombatResolver } from '@/engine/CombatResolver'
import { SeededRandom } from '@/utils/random'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getAdvancedActions } from '@/data/loader'
import type { EnemyToken, TurnState } from '@/engine/types'

/**
 * Agility (AA, id 7) — rulebook text:
 *  basic:  Move 2. During combat this turn you may spend Move points left from
 *          the Move phase as Attack points one for one.
 *  strong: Move 4. … one for one, or 2 Move points for 1 Ranged Attack.
 *
 * Move is the primary effect; the secondary clause turns leftover Move into
 * combat value. The flag is set on play; the combat tray spends Move via
 * playAgilityMove; the spent Move is deducted at confirm.
 */

function enemy(o: Partial<EnemyToken> = {}): EnemyToken {
  return { id: 1, name: 'E', color: 'green', category: 'marauding', armor: 4, attack: 3, attackType: 'normal', abilities: [], fameReward: 3, copies: 1, set: 'base', ...o }
}

describe('Agility flag is set on the turn when played', () => {
  it('basic → agility { ranged: false }', () => {
    const c = getAdvancedActions().find((x) => x.name === 'Agility')
    if (!c) return
    const h = createHarness('Tovak')
    h.setState(setupTurn([c]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.agility).toEqual({ ranged: false })
  })

  it('strong (green mana) → agility { ranged: true }', () => {
    const c = getAdvancedActions().find((x) => x.name === 'Agility')
    if (!c) return
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'green', source: 'effect' }] })(setupTurn([c])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.agility).toEqual({ ranged: true })
  })
})

describe('Agility converts Move into combat value', () => {
  it('melee phase: 3 Move → Attack 3 (1:1), each consumes 1 Move', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ armor: 3 })], false)
    const { result } = renderHook(() => useCombatCards('attack', [], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.playAgilityMove('attack'))
    act(() => result.current.playAgilityMove('attack'))
    act(() => result.current.playAgilityMove('attack'))
    const decls = result.current.buildAttackDeclarations()
    expect(decls).toHaveLength(1)
    expect(decls[0].attackValue).toBe(3)
    expect(decls[0].isRanged).toBe(false)
    const totalMove = result.current.plays.reduce((s, p) => s + (p.moveCost ?? 0), 0)
    expect(totalMove).toBe(3) // 3 × 1
    expect(r.resolveMeleeAttack({ ...combat, phase: 'attack' }, decls).enemies[0].isDefeated).toBe(true)
  })

  it('ranged/siege phase: 2 Move → Ranged Attack 1 (2:1), consumes 2 Move', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy({ armor: 1 })], false)
    const { result } = renderHook(() => useCombatCards('ranged_siege', [], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.playAgilityMove('ranged'))
    const decls = result.current.buildAttackDeclarations()
    expect(decls[0].attackValue).toBe(1)
    expect(decls[0].isRanged).toBe(true)
    expect(result.current.plays[0].moveCost).toBe(2)
  })

  it('melee-type conversion is rejected in the ranged/siege phase', () => {
    const r = new CombatResolver(new SeededRandom(42))
    const combat = r.initiateCombat([enemy()], false)
    const { result } = renderHook(() => useCombatCards('ranged_siege', [], [], combat.enemies, [], 'day'))
    act(() => result.current.setActiveTarget(combat.enemies[0].instanceId))
    act(() => result.current.playAgilityMove('attack'))
    expect(result.current.plays).toHaveLength(0)
  })
})

describe('deductAgilityMove', () => {
  it('adds the spent Move to movePointsSpent', () => {
    const turn = { movePointsAvailable: 4, movePointsSpent: 0 } as TurnState
    const state = { player: { turn } }
    const out = deductAgilityMove(state, [
      { sourceType: 'agility', moveCost: 1 } as never,
      { sourceType: 'agility', moveCost: 2 } as never,
      { sourceType: 'card', moveCost: undefined } as never,
    ])
    expect(out.player.turn.movePointsSpent).toBe(3)
  })

  it('no agility plays → state unchanged', () => {
    const turn = { movePointsAvailable: 4, movePointsSpent: 1 } as TurnState
    const state = { player: { turn } }
    const out = deductAgilityMove(state, [{ sourceType: 'card' } as never])
    expect(out.player.turn.movePointsSpent).toBe(1)
  })
})
