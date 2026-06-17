import { describe, it, expect } from 'vitest'
import { getAdvancedActions } from '@/data/loader'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import type { AdvancedActionCard, ManaToken } from '@/engine/types'

const AAs = getAdvancedActions()
function aa(name: string): AdvancedActionCard {
  const c = AAs.find((x) => x.name === name)
  if (!c) throw new Error(name)
  return c
}
const tok = (c: string): ManaToken => ({ color: c as ManaToken['color'], source: 'die' })

describe('Advanced Actions — gain_crystal (the Bolts)', () => {
  ;['Fire Bolt', 'Ice Bolt', 'Swift Bolt', 'Crushing Bolt'].forEach((name) => {
    it(`${name}: basic gains a crystal of the chosen colour`, () => {
      const c = aa(name)
      const color = c.color as 'red' | 'blue' | 'green' | 'white'
      const h = createHarness()
      h.setState(setupTurn([c]))
      h.run((e) => e.playCard(0, 'basic', { chosenColors: [color] }))
      const cr = h.state().player.mana.crystals
      expect(cr.red + cr.blue + cr.green + cr.white).toBe(1)
    })
  })
})

describe('Advanced Actions — strong effects need the card colour', () => {
  it('a Move AA strong applies its larger move with colour mana', () => {
    // Find an AA whose strong effect grants move
    const moveStrong = AAs.find((c) => (c.strongEffect?.actions ?? []).some((a) => a.type === 'move'))
    if (!moveStrong) return
    const value = (moveStrong.strongEffect!.actions.find((a) => a.type === 'move')!.value ?? 0)
    const color = (Array.isArray(moveStrong.color) ? moveStrong.color[0] : moveStrong.color) as string
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok(color)] })(setupTurn([moveStrong])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBeGreaterThanOrEqual(value)
  })

  it('a Move AA strong is refused without colour mana (stays in hand)', () => {
    const moveStrong = AAs.find((c) => (c.strongEffect?.actions ?? []).some((a) => a.type === 'move'))
    if (!moveStrong) return
    const h = createHarness()
    h.setState((s) => manaWith({})(setupTurn([moveStrong])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(0)
    expect(h.state().player.deck.hand.length).toBe(1)
  })
})
