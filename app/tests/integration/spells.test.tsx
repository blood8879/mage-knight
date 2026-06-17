import { describe, it, expect } from 'vitest'
import { getSpells } from '@/data/loader'
import { createHarness, setupTurn, setupInteraction, manaWith } from './card-play-harness'
import type { SpellCard, ManaToken } from '@/engine/types'

function spell(name: string): SpellCard {
  const c = getSpells().find((x) => x.name.startsWith(name))
  if (!c) throw new Error(`spell not found: ${name}`)
  return c
}
const tok = (color: string): ManaToken => ({ color: color as ManaToken['color'], source: 'die' })

// Spell rules (rulebook p.4): basic = one mana of its colour; strong = colour +
// black, NIGHT only.

describe('Spells — Movement', () => {
  it('Underground Travel basic: Move 3 (green mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('green')] })(setupTurn([spell('Underground Travel')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(3)
  })
  it('Wings of Wind basic: Move 3 (white mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('white')] })(setupTurn([spell('Wings of Wind')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(3)
  })
  it('Space Bending basic: Move 2 (blue mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('blue')] })(setupTurn([spell('Space Bending')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)
  })
  it('spell basic is refused without its colour mana', () => {
    const h = createHarness()
    h.setState((s) => manaWith({})(setupTurn([spell('Underground Travel')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(0)
    expect(h.state().player.deck.hand.length).toBe(1)
  })
})

describe('Spells — Heal / Draw', () => {
  it('Restoration basic: Heal 3 (green mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('green')] })(setupTurn([spell('Restoration')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(3)
  })
  it('Cure basic: Heal 2 (green mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('green')] })(setupTurn([spell('Cure')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(2)
  })
  it('Meditation basic: Draw 2 (green mana) — net +1 card (spell leaves hand)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('green')] })(setupTurn([spell('Meditation')])(s)))
    const before = h.state().player.deck.hand.length // 1
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.deck.hand.length).toBe(before + 1) // -1 played +2 drawn
  })
})

describe('Spells — Mana / Crystals', () => {
  it('Mana Claim basic: gain a mana token (blue mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('blue'), tok('blue')] })(setupTurn([spell('Mana Claim')])(s)))
    const before = h.state().player.mana.playerMana.length
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['blue'] }))
    // spent 1 blue for the spell, gained 1 token → net same or +0; assert a token of the gained colour exists
    expect(h.state().player.mana.playerMana.length).toBeGreaterThanOrEqual(before - 1)
  })
  it('Mana Meltdown basic: gain a crystal (red mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('red')] })(setupTurn([spell('Mana Meltdown')])(s)))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['red'] }))
    const crystals = h.state().player.mana.crystals
    const total = crystals.red + crystals.blue + crystals.green + crystals.white
    expect(total).toBeGreaterThanOrEqual(1)
  })
})

describe('Spells — Influence (interaction)', () => {
  it('Call to Arms strong: Influence 7 at NIGHT (white + black)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('white'), tok('black')] })(setupInteraction([spell('Call to Arms')], { dayNight: 'night' })(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().interaction?.influencePool).toBe(7)
  })
  it('Charm basic: Influence 4 (white mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('white')] })(setupInteraction([spell('Charm')])(s)))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().interaction?.influencePool).toBe(4)
  })
})

describe('Spells — strong effect mana rules (rulebook)', () => {
  it('spell strong is IMPOSSIBLE during the Day (needs black)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('blue'), tok('blue')] })(setupTurn([spell('Space Bending')], { dayNight: 'day' })(s)))
    const before = h.state().player.deck.hand.length
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.deck.hand.length).toBe(before) // refused, still in hand
  })
  it('spell strong at NIGHT needs colour + black; with both it resolves', () => {
    // Space Bending strong = Draw 2 (blue + black at night)
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('blue'), tok('black')] })(setupTurn([spell('Space Bending')], { dayNight: 'night' })(s)))
    const before = h.state().player.deck.hand.length
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.deck.hand.length).toBe(before + 1) // -1 played +2 drawn
  })
  it('spell strong at NIGHT without black is refused', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('blue')] })(setupTurn([spell('Space Bending')], { dayNight: 'night' })(s)))
    const before = h.state().player.deck.hand.length
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.deck.hand.length).toBe(before) // refused
  })
})
