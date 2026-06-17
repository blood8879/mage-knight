import { describe, it, expect } from 'vitest'
import { getBasicActions } from '@/data/loader'
import { createHarness, setupTurn, setupInteraction } from './card-play-harness'
import type { BasicActionCard, AnyCard } from '@/engine/types'

function improv(): BasicActionCard {
  const c = getBasicActions().commonCards.find((x) => x.name === 'Improvisation')
  if (!c) throw new Error('Improvisation')
  return c
}
function dummy(id: number, name: string): AnyCard {
  return { id, name, type: 'basic_action', color: 'red', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' } as never
}

describe('Improvisation — discard another card for an effect (rulebook)', () => {
  it('basic → Move 3 in the movement phase', () => {
    const h = createHarness()
    h.setState(setupTurn([improv(), dummy(101, 'A'), dummy(102, 'B')]))
    // play Improvisation (index 0), discard "A" (index 1), choose Move
    h.run((e) => e.playCardWithDiscard(0, 1, 'move', 3))
    expect(h.state().player.turn.movePointsAvailable).toBe(3)
  })

  it('discards the CHOSEN card — discardIndex is relative to the hand minus Improvisation (UI convention)', () => {
    // Hand [Improv(0), A(1), B(2)]. The discard overlay hides Improvisation, so
    // the hand it shows is [A(0), B(1)]. Choosing A → discardIndex 0.
    const h = createHarness()
    h.setState(setupTurn([improv(), dummy(101, 'A'), dummy(102, 'B')]))
    h.run((e) => e.playCardWithDiscard(0, 0, 'move', 3))
    const hand = h.state().player.deck.hand
    const discard = h.state().player.deck.discardPile
    expect(hand.some((c) => c.name === 'B')).toBe(true) // B still in hand
    expect(hand.some((c) => c.name === 'A')).toBe(false) // A discarded
    expect(discard.some((c) => c.name === 'A')).toBe(true)
    expect(discard.some((c) => c.name === 'B')).toBe(false)
  })

  it('basic → Influence 3 in interaction', () => {
    const h = createHarness()
    h.setState(setupInteraction([improv(), dummy(101, 'A')]))
    h.run((e) => e.playCardWithDiscard(0, 1, 'influence', 3))
    expect(h.state().interaction?.influencePool).toBe(3)
  })
})
