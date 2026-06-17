import { describe, it, expect } from 'vitest'
import { getBasicActions } from '@/data/loader'
import { createHarness, setupTurn, setupInteraction, manaWith } from './card-play-harness'
import type { BasicActionCard } from '@/engine/types'

function card(name: string): BasicActionCard {
  const c = getBasicActions().commonCards.find((x) => x.name === name)
  if (!c) throw new Error(`card not found: ${name}`)
  return c
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic Action cards — each played through the REAL playCard path, asserting
// rulebook-correct outcomes in the appropriate phase.
// Combat-only effects (attack/block/ranged) are covered in basic-actions-combat.
// ─────────────────────────────────────────────────────────────────────────────

describe('Basic Actions — Movement effects', () => {
  it('March: basic +2 Move, strong +4 Move (green mana)', () => {
    let h = createHarness()
    h.setState(setupTurn([card('March')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)

    h = createHarness()
    h.setState((s) => manaWith({ crystals: { green: 1 } })(setupTurn([card('March')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(4)
    expect(h.state().player.mana.crystals.green).toBe(0)
  })

  it('Stamina: basic +2 Move, strong +4 Move (blue mana)', () => {
    let h = createHarness()
    h.setState(setupTurn([card('Stamina')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)

    h = createHarness()
    h.setState((s) => manaWith({ crystals: { blue: 1 } })(setupTurn([card('Stamina')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(4)
  })

  it('Swiftness: basic +2 Move', () => {
    const h = createHarness()
    h.setState(setupTurn([card('Swiftness')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)
  })

  it('Action strong is refused without its colour mana (card stays in hand)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({})(setupTurn([card('March')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(0)
    expect(h.state().player.deck.hand.length).toBe(1)
  })

  it('Action strong needs only colour at NIGHT (no black) — rulebook', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ crystals: { green: 1 } })(setupTurn([card('March')], { dayNight: 'night' })(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().player.turn.movePointsAvailable).toBe(4)
  })
})

describe('Basic Actions — Healing / Draw (Tranquility)', () => {
  it('Tranquility basic: choose Heal 1 → +1 healing', () => {
    const h = createHarness()
    h.setState(setupTurn([card('Tranquility')]))
    h.run((e) => e.playCard(0, 'basic', { chosenActionIndex: 0 }))
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(1)
  })

  it('Tranquility basic: choose Draw 1 → +1 card in hand', () => {
    const h = createHarness()
    h.setState(setupTurn([card('Tranquility')]))
    const before = h.state().player.deck.hand.length // 1 (just Tranquility)
    h.run((e) => e.playCard(0, 'basic', { chosenActionIndex: 1 }))
    // Tranquility leaves hand (−1) and draws 1 (+1) → net same, but a card was drawn
    expect(h.state().player.deck.hand.length).toBe(before) // -1 played +1 drawn
  })
})

describe('Basic Actions — Influence (interaction)', () => {
  it('Promise basic: +2 Influence in interaction', () => {
    const h = createHarness()
    h.setState(setupInteraction([card('Promise')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().interaction?.influencePool).toBe(2)
  })

  it('Promise strong: +4 Influence (white mana)', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ crystals: { white: 1 } })(setupInteraction([card('Promise')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().interaction?.influencePool).toBe(4)
  })

  it('Threaten basic: +2 Influence', () => {
    const h = createHarness()
    h.setState(setupInteraction([card('Threaten')]))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().interaction?.influencePool).toBe(2)
  })

  it('Threaten strong: +5 Influence and −1 Reputation (red mana)', () => {
    const h = createHarness()
    const repBefore = createHarness().state().player.reputation
    h.setState((s) => manaWith({ crystals: { red: 1 } })(setupInteraction([card('Threaten')])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    expect(h.state().interaction?.influencePool).toBe(5)
    expect(h.state().player.reputation).toBe(repBefore - 1)
  })
})

describe('Basic Actions — Mana / Crystals', () => {
  it('Crystallize basic: pay 1 chosen-colour mana → gain a crystal of that colour', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [{ color: 'blue', source: 'die' }] })(setupTurn([card('Crystallize')])(s)))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['blue'] }))
    expect(h.state().player.mana.crystals.blue).toBe(1)
    expect(h.state().player.mana.playerMana.length).toBe(0) // token spent
  })

  it('Mana Draw basic: gain one extra Source die this turn', () => {
    const h = createHarness()
    h.setState(setupTurn([card('Mana Draw')]))
    const before = h.state().player.mana.extraSourceDice ?? 0
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.mana.extraSourceDice ?? 0).toBe(before + 1)
  })

  it('Concentration basic: gain a chosen mana token (blue/white/red)', () => {
    const h = createHarness()
    h.setState(setupTurn([card('Concentration')]))
    const before = h.state().player.mana.playerMana.length
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['blue'] }))
    expect(h.state().player.mana.playerMana.length).toBe(before + 1)
    expect(h.state().player.mana.playerMana.some((t) => t.color === 'blue')).toBe(true)
  })
})
