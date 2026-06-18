import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getAdvancedActions } from '@/data/loader'
import type { AnyCard, ManaColor } from '@/engine/types'

/**
 * Blood of Ancients (AA, id 31) basic — rulebook text:
 *   "Gain a Wound. Pay one mana of any color. Gain a card of that color from
 *    the Advanced Actions offer and put into your hand."
 *
 * engine.playBloodOfAncients takes a Wound, spends the chosen colour, and moves
 * the matching offer card into hand.
 */
function blood(): AnyCard {
  const c = getAdvancedActions().find((x) => x.name === 'Blood of Ancients')
  if (!c) throw new Error('Blood of Ancients missing')
  return c
}

describe('Blood of Ancients: gain a matching-colour AA from the offer', () => {
  it('pays the colour, gains a Wound, and moves the offer card to hand', () => {
    const h = createHarness('Tovak')
    // Pick a real offer card and pay its colour.
    const offerCard = h.state().offers.advancedActions[0]
    const color = (Array.isArray(offerCard.color) ? offerCard.color[0] : offerCard.color) as ManaColor

    h.setState((s) => manaWith({ tokens: [{ color, source: 'effect' }] })(setupTurn([blood()])(s)))
    const offerLenBefore = h.state().offers.advancedActions.length

    h.run((e) => e.playBloodOfAncients(0, color, offerCard.id))

    const after = h.state()
    expect(after.player.deck.hand.some((c) => 'id' in c && c.id === offerCard.id)).toBe(true) // gained to hand
    expect(after.player.deck.hand.some((c) => c.type === 'wound')).toBe(true) // gained a Wound
    expect(after.offers.advancedActions.length).toBe(offerLenBefore - 1) // removed from offer
    expect(after.player.mana.playerMana.some((t) => t.color === color)).toBe(false) // mana spent
  })

  it('refuses if the paid colour does not match the offer card', () => {
    const h = createHarness('Tovak')
    const offerCard = h.state().offers.advancedActions[0]
    const cardColor = (Array.isArray(offerCard.color) ? offerCard.color[0] : offerCard.color) as ManaColor
    const wrong: ManaColor = cardColor === 'red' ? 'blue' : 'red'

    h.setState((s) => manaWith({ tokens: [{ color: wrong, source: 'effect' }] })(setupTurn([blood()])(s)))
    h.run((e) => e.playBloodOfAncients(0, wrong, offerCard.id))

    // Nothing happened: Blood still in hand, offer intact.
    expect(h.state().player.deck.hand.some((c) => 'name' in c && c.name === 'Blood of Ancients')).toBe(true)
  })

  it('refuses without the mana to pay', () => {
    const h = createHarness('Tovak')
    const offerCard = h.state().offers.advancedActions[0]
    const color = (Array.isArray(offerCard.color) ? offerCard.color[0] : offerCard.color) as ManaColor
    h.setState(setupTurn([blood()])) // no mana
    h.run((e) => e.playBloodOfAncients(0, color, offerCard.id))
    expect(h.state().player.deck.hand.some((c) => 'name' in c && c.name === 'Blood of Ancients')).toBe(true)
  })
})
