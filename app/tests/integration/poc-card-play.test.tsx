import { describe, it, expect, beforeEach } from 'vitest'
import { getBasicActions } from '@/data/loader'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import type { BasicActionCard } from '@/engine/types'

function card(name: string): BasicActionCard {
  const { commonCards } = getBasicActions()
  const c = commonCards.find((x) => x.name === name)
  if (!c) throw new Error(`card not found: ${name}`)
  return c
}

describe('POC: basic action cards via the real play path', () => {
  beforeEach(() => {
    // fresh harness per test
  })

  it('March basic → +2 Move points (movement)', () => {
    const h = createHarness('Tovak')
    h.setState(setupTurn([card('March')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)
  })

  it('March strong → +4 Move points, spends green mana', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ crystals: { green: 1 } })(setupTurn([card('March')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(4)
    expect(h.state().player.mana.crystals.green).toBe(0)
  })

  it('March strong WITHOUT mana → refused (no move points, card stays in hand)', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({})(setupTurn([card('March')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(0)
    expect(h.state().player.deck.hand.length).toBe(1) // not consumed
  })
})
