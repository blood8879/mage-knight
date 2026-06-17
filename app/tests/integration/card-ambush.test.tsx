import { describe, it, expect } from 'vitest'
import { applyAmbushAttackBonus, applyAmbushBlockBonus } from '@/hooks/useCombat'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getAdvancedActions } from '@/data/loader'
import type { AttackDeclaration, BlockDeclaration } from '@/engine/types'

/**
 * Ambush (AA, id 24) — rulebook text:
 *  basic:  Move 2. Add +1 to your first Attack card of any type or +2 to your
 *          first Block card of any type, whichever you play first this turn.
 *  strong: Move 4. Add +2 / +4 likewise.
 *
 * The Move part is the primary effect (movement phase); the bonus is a turn-
 * scoped flag consumed by the FIRST attack OR block in combat, whichever comes
 * first. Pure helpers boost only the first declaration in play order.
 */

function atk(id: string, value: number): AttackDeclaration {
  return { id, targetEnemyIds: ['e1'], attackValue: value, attackElement: 'physical', isSiege: false, isRanged: false, cardIds: [], unitIds: [] }
}
function blk(enemyInstanceId: string, value: number): BlockDeclaration {
  return { enemyInstanceId, blockValue: value, blockElement: 'physical', cardIds: [], unitIds: [], isSuccessful: false }
}

describe('Ambush bonus helpers', () => {
  it('basic: +1 to the first attack declaration only', () => {
    const { attacks, consumed } = applyAmbushAttackBonus([atk('a0', 3), atk('a1', 3)], { attackBonus: 1, blockBonus: 2 })
    expect(consumed).toBe(true)
    expect(attacks[0].attackValue).toBe(4) // first +1
    expect(attacks[1].attackValue).toBe(3) // second unchanged
  })

  it('strong: +4 to the first block declaration only', () => {
    const { blocks, consumed } = applyAmbushBlockBonus([blk('e1', 2), blk('e2', 2)], { attackBonus: 2, blockBonus: 4 })
    expect(consumed).toBe(true)
    expect(blocks[0].blockValue).toBe(6) // first +4
    expect(blocks[1].blockValue).toBe(2)
  })

  it('no bonus active → declarations unchanged, not consumed', () => {
    const a = applyAmbushAttackBonus([atk('a0', 3)], undefined)
    expect(a.consumed).toBe(false)
    expect(a.attacks[0].attackValue).toBe(3)
    const b = applyAmbushBlockBonus([blk('e1', 3)], undefined)
    expect(b.consumed).toBe(false)
    expect(b.blocks[0].blockValue).toBe(3)
  })

  it('empty declarations → nothing consumed (bonus saved for later phase)', () => {
    const a = applyAmbushAttackBonus([], { attackBonus: 1, blockBonus: 2 })
    expect(a.consumed).toBe(false)
  })
})

describe('Ambush flag is set on the turn when the card is played', () => {
  it('playing Ambush (basic) sets turn.ambush to +1/+2', () => {
    const ambush = getAdvancedActions().find((c) => c.name === 'Ambush')
    if (!ambush) return
    const h = createHarness('Tovak')
    h.setState(setupTurn([ambush]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.ambush).toEqual({ attackBonus: 1, blockBonus: 2 })
  })

  it('playing Ambush (strong) sets turn.ambush to +2/+4', () => {
    const ambush = getAdvancedActions().find((c) => c.name === 'Ambush')
    if (!ambush) return
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'green', source: 'effect' }] })(setupTurn([ambush])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.ambush).toEqual({ attackBonus: 2, blockBonus: 4 })
  })
})
