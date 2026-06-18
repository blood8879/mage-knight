import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getSpells, getArtifacts } from '@/data/loader'
import type { AnyCard, WoundCard } from '@/engine/types'

/**
 * Cure / Disease (Spell, id 24) basic: "Heal 2. Draw a card for each Wound
 *   healed from hand this turn, and ready each Unit healed this turn."
 * Golden Grail (Artifact, id 11) strong: "Heal 6. Every time you Heal a Wound
 *   from hand this turn, draw a card."
 *
 * Heal is the primary effect; both share the secondary clause "draw a card per
 * Wound healed from hand this turn" — modelled by turn.drawPerWoundHeal, which
 * healWound consumes.
 */

const wound = (id: string): WoundCard => ({ type: 'wound', id })

describe('Cure / Golden Grail: draw a card per Wound healed', () => {
  it('Cure basic sets drawPerWoundHeal = 1', () => {
    const c = getSpells().find((x) => x.name.startsWith('Cure'))
    if (!c) return
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'green', source: 'effect' }] })(setupTurn([c as AnyCard])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.drawPerWoundHeal).toBe(1)
  })

  it('Golden Grail strong sets drawPerWoundHeal = 1', () => {
    const c = getArtifacts().find((x) => x.name === 'Golden Grail')
    if (!c) return
    const h = createHarness('Tovak')
    h.setState(setupTurn([c as AnyCard]))
    h.run((e) => e.playCard(0, 'strong')) // artifact strong = throw away, no mana
    expect(h.state().player.turn.drawPerWoundHeal).toBe(1)
  })

  it('healing a wound with the flag active draws a card; without it does not', () => {
    const h = createHarness('Tovak')
    // With the flag: hand is one wound, plenty of healing + draw pile.
    h.setState((s) => ({
      ...setupTurn([wound('w1')])(s),
      player: {
        ...setupTurn([wound('w1')])(s).player,
        turn: { ...setupTurn([wound('w1')])(s).player.turn, healingAvailable: 2, drawPerWoundHeal: 1 },
      },
    }))
    const before = h.state().player.deck.drawPile.length
    h.run((e) => e.healWound())
    const after = h.state()
    expect(after.player.deck.hand.filter((c) => c.type === 'wound')).toHaveLength(0) // wound healed
    expect(after.player.deck.hand.filter((c) => c.type !== 'wound')).toHaveLength(1) // drew one card
    expect(after.player.deck.drawPile.length).toBe(before - 1)
  })

  it('without the flag, healing a wound draws nothing', () => {
    const h = createHarness('Tovak')
    h.setState((s) => ({
      ...setupTurn([wound('w1')])(s),
      player: {
        ...setupTurn([wound('w1')])(s).player,
        turn: { ...setupTurn([wound('w1')])(s).player.turn, healingAvailable: 2 },
      },
    }))
    const before = h.state().player.deck.drawPile.length
    h.run((e) => e.healWound())
    const after = h.state()
    expect(after.player.deck.hand).toHaveLength(0) // wound gone, nothing drawn
    expect(after.player.deck.drawPile.length).toBe(before)
  })
})
