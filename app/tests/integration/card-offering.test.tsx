import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getSpells, getBasicActions, getAdvancedActions } from '@/data/loader'
import type { AnyCard } from '@/engine/types'

/**
 * Offering / Sacrifice (Spell, id 21) basic — rulebook text:
 *   "Gain a red crystal to your Inventory. You may discard up to 3 non-Wound
 *    cards from your hand. For each discarded card gain a crystal of the
 *    matching color to your Inventory."
 *
 * Spell basic costs the card's colour (red). The primary red-crystal gain plus
 * the per-discard colour crystals are applied by engine.playOffering.
 */
function offering(): AnyCard {
  const c = getSpells().find((x) => x.name.startsWith('Offering'))
  if (!c) throw new Error('Offering missing')
  return c
}
function basic(name: string): AnyCard {
  const c = getBasicActions().commonCards.find((x) => x.name === name)
  if (!c) throw new Error(name)
  return c
}

describe('Offering / Sacrifice: discard cards for crystals', () => {
  it('gains a red crystal plus one crystal per discarded card (by colour)', () => {
    const h = createHarness('Tovak')
    // Hand: Offering + a blue card (Crystallize is blue) + a green card.
    const blueCard = getBasicActions().commonCards.find((c) => {
      const col = Array.isArray(c.color) ? c.color[0] : c.color
      return col === 'blue'
    }) ?? basic('Crystallize')
    const greenCard = getBasicActions().commonCards.find((c) => {
      const col = Array.isArray(c.color) ? c.color[0] : c.color
      return col === 'green'
    }) ?? getAdvancedActions().find((c) => (Array.isArray(c.color) ? c.color[0] : c.color) === 'green')!
    const hand: AnyCard[] = [offering(), blueCard as AnyCard, greenCard as AnyCard]
    h.setState((s) => manaWith({ tokens: [{ color: 'red', source: 'effect' }] })(setupTurn(hand)(s)))

    const before = { ...h.state().player.mana.crystals }
    // Post-play hand (Offering removed) = [blue, green] → discard both (indices 0,1).
    h.run((e) => e.playOffering(0, [0, 1], []))

    const after = h.state().player.mana.crystals
    const blueCol = (Array.isArray(blueCard.color) ? blueCard.color[0] : blueCard.color) as 'blue' | 'green' | 'red' | 'white'
    const greenCol = (Array.isArray(greenCard.color) ? greenCard.color[0] : greenCard.color) as 'blue' | 'green' | 'red' | 'white'
    expect(after.red).toBe(before.red + 1) // primary red crystal
    expect(after[blueCol]).toBe(before[blueCol] + (blueCol === 'red' ? 1 : 1))
    expect(after[greenCol]).toBeGreaterThanOrEqual(before[greenCol] + 1)
    // Both discarded cards left the hand; Offering itself is played.
    expect(h.state().player.deck.hand).toHaveLength(0)
  })

  it('with no discards, only the red crystal is gained', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'red', source: 'effect' }] })(setupTurn([offering(), basic('Rage')])(s)))
    const before = h.state().player.mana.crystals.red
    h.run((e) => e.playOffering(0, [], []))
    expect(h.state().player.mana.crystals.red).toBe(before + 1)
    expect(h.state().player.deck.hand).toHaveLength(1) // Rage kept
  })

  it('does nothing without the red mana to pay for the spell', () => {
    const h = createHarness('Tovak')
    h.setState(setupTurn([offering(), basic('Rage')])) // no mana
    const before = h.state().player.mana.crystals.red
    h.run((e) => e.playOffering(0, [], []))
    expect(h.state().player.mana.crystals.red).toBe(before) // refused
    expect(h.state().player.deck.hand).toHaveLength(2) // nothing played
  })
})
