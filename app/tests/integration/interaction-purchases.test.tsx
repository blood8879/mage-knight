import { describe, it, expect } from 'vitest'
import { createHarness, setupInteraction } from './card-play-harness'
import type { AnyUnit, AnyCard, GameState, WoundCard } from '@/engine/types'

const wound = (id: number): WoundCard => ({ type: 'wound', id: `w${id}` })
function unit(id: number, cost: number): AnyUnit {
  return { id, name: `U${id}`, type: 'unit', tier: 'regular', level: 1, cost, armor: 3, recruitSites: ['village'], abilities: [], resistance: null, copies: 1, set: 'base' } as unknown as AnyUnit
}
function aaCard(id: number): AnyCard {
  return { id, name: `AA${id}`, type: 'advanced_action', color: 'red', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, set: 'base' } as never
}

function withPool(pool: number) {
  return (s: GameState): GameState => ({ ...s, interaction: { ...s.interaction!, influencePool: pool } })
}

describe('Interaction purchases — Healing', () => {
  it('village healing costs 3 Influence per wound and removes a wound', () => {
    const h = createHarness()
    h.setState((s) => withPool(5)(setupInteraction([], { siteType: 'village' })(s)))
    h.setState((s) => ({ ...s, player: { ...s.player, deck: { ...s.player.deck, hand: [wound(1)] } } }))
    h.run((e) => e.purchaseHealing(1))
    expect(h.state().interaction?.influencePool).toBe(2) // 5 - 3
    expect(h.state().player.deck.hand.filter((c) => c.type === 'wound').length).toBe(0)
  })

  it('monastery healing costs 2 Influence per wound', () => {
    const h = createHarness()
    h.setState((s) => withPool(5)(setupInteraction([], { siteType: 'monastery' })(s)))
    h.setState((s) => ({ ...s, player: { ...s.player, deck: { ...s.player.deck, hand: [wound(1)] } } }))
    h.run((e) => e.purchaseHealing(1))
    expect(h.state().interaction?.influencePool).toBe(3) // 5 - 2
  })

  it('healing is refused when influence is insufficient (no wound removed, pool unchanged)', () => {
    const h = createHarness()
    h.setState((s) => withPool(2)(setupInteraction([], { siteType: 'village' })(s)))
    h.setState((s) => ({ ...s, player: { ...s.player, deck: { ...s.player.deck, hand: [wound(1)] } } }))
    h.run((e) => e.purchaseHealing(1))
    expect(h.state().interaction?.influencePool).toBe(2)
    expect(h.state().player.deck.hand.filter((c) => c.type === 'wound').length).toBe(1)
  })
})

describe('Interaction purchases — Recruit Unit', () => {
  it('recruiting deducts the unit cost from the influence pool and adds the unit', () => {
    const h = createHarness()
    const u = unit(900, 4)
    h.setState((s) => withPool(10)(setupInteraction([], { siteType: 'village' })(s)))
    h.setState((s) => ({ ...s, offers: { ...s.offers, units: [u] } }))
    const unitsBefore = h.state().player.units.length
    h.run((e) => e.purchaseUnit(u))
    expect(h.state().interaction?.influencePool).toBe(6) // 10 - 4
    expect(h.state().player.units.length).toBe(unitsBefore + 1)
  })

  it('recruiting is refused without enough influence', () => {
    const h = createHarness()
    const u = unit(901, 8)
    h.setState((s) => withPool(3)(setupInteraction([], { siteType: 'village' })(s)))
    h.setState((s) => ({ ...s, offers: { ...s.offers, units: [u] } }))
    const unitsBefore = h.state().player.units.length
    h.run((e) => e.purchaseUnit(u))
    expect(h.state().interaction?.influencePool).toBe(3)
    expect(h.state().player.units.length).toBe(unitsBefore)
  })
})

describe('Interaction purchases — Advanced Action (green city / AA offer, 6 Influence)', () => {
  it('buying an AA deducts 6 Influence and puts the card on TOP of the Deed deck (rulebook)', () => {
    const h = createHarness()
    const aa = aaCard(800)
    h.setState((s) => withPool(8)(setupInteraction([], { siteType: 'city' })(s)))
    h.setState((s) => ({ ...s, interaction: { ...s.interaction!, cityColor: 'green' }, offers: { ...s.offers, advancedActions: [aa] } }))
    const drawBefore = h.state().player.deck.drawPile.length
    h.run((e) => e.purchaseAdvancedAction(800))
    expect(h.state().interaction?.influencePool).toBe(2) // 8 - 6
    expect(h.state().player.deck.drawPile.length).toBe(drawBefore + 1)
    expect(h.state().player.deck.drawPile[0].id).toBe(800) // on top
  })
})
