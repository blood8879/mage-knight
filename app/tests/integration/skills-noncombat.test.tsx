import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, setupInteraction, manaWith } from './card-play-harness'
import { getHeroSkills, getBasicActions, getAdvancedActions } from '@/data/loader'
import { MovementResolver } from '@/engine/MovementResolver'
import type { AnyCard, CardAction, GameState, HeroSkill, WoundCard } from '@/engine/types'

/**
 * Hero-skill audit (non-combat activation). Several skills hit the `default`
 * branch of activateSkill and silently did nothing — exactly the "skill usage
 * bug" the player reported. These verify the now-supported effects per rulebook.
 */
function skill(hero: string, id: number): HeroSkill {
  const s = getHeroSkills(hero).find((x) => x.id === id)
  if (!s) throw new Error(`skill ${id} for ${hero} missing`)
  return { ...s, type: s.type as HeroSkill['type'], actions: s.actions as HeroSkill['actions'], isFlipped: false, isUsedThisTurn: false }
}
const withSkill = (s: HeroSkill) => (st: GameState): GameState => ({
  ...st,
  player: { ...st.player, skills: [s] },
})
const wound = (id: string): WoundCard => ({ type: 'wound', id })

describe('Motivation (draw_cards) — Goldyx/Tovak', () => {
  it('draws 2 cards and gains the companion mana token', () => {
    const h = createHarness('Tovak')
    h.setState((s) => withSkill(skill('Tovak', 309))(setupTurn([])(s))) // Motivation, blue
    const handBefore = h.state().player.deck.hand.length
    const blueBefore = h.state().player.mana.playerMana.filter((t) => t.color === 'blue').length
    h.run((e) => e.activateSkill(0))
    expect(h.state().player.deck.hand.length).toBe(handBefore + 2)
    expect(h.state().player.mana.playerMana.filter((t) => t.color === 'blue').length).toBe(blueBefore + 1)
  })
})

describe('I Feel No Pain (discard_wound_draw_card) — Tovak', () => {
  it('discards a Wound from hand and draws a card', () => {
    const h = createHarness('Tovak')
    h.setState((s) => {
      const base = withSkill(skill('Tovak', 306))(setupTurn([wound('w1')])(s))
      return base
    })
    const drawBefore = h.state().player.deck.drawPile.length
    h.run((e) => e.activateSkill(0))
    const after = h.state()
    expect(after.player.deck.hand.some((c) => c.type === 'wound')).toBe(false) // wound discarded
    expect(after.player.deck.hand.length).toBe(1) // drew one replacement
    expect(after.player.deck.drawPile.length).toBe(drawBefore - 1)
  })

  it('does nothing when there is no Wound in hand', () => {
    const h = createHarness('Tovak')
    h.setState((s) => withSkill(skill('Tovak', 306))(setupTurn([])(s)))
    h.run((e) => e.activateSkill(0))
    expect(h.state().player.skills[0].isUsedThisTurn).toBe(false) // not consumed
  })
})

describe("I Don't Give a Damn! (sideways_bonus) — Tovak", () => {
  it('sets the one-shot sideways bonus, then a sideways play gives +2 (Action) / +3 (AA)', () => {
    const rage = getBasicActions().commonCards.find((c) => c.name === 'Rage')! as AnyCard
    const aa = getAdvancedActions()[0] as AnyCard // an advanced action → +3
    const h = createHarness('Tovak')
    h.setState((s) => withSkill(skill('Tovak', 307))(setupTurn([rage, aa])(s)))
    h.run((e) => e.activateSkill(0))
    expect(h.state().player.turn.sidewaysBonus).toEqual({ base: 2, boosted: 3, mode: 'card_type' })

    // Basic action played sideways → +2 Move.
    h.run((e) => e.playSidewaysCard(0, 'move'))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)
    expect(h.state().player.turn.sidewaysBonus).toBeUndefined() // consumed
  })

  it('an Advanced Action sideways play gets the boosted +3', () => {
    const aa = getAdvancedActions()[0] as AnyCard
    const h = createHarness('Tovak')
    h.setState((s) => withSkill(skill('Tovak', 307))(setupTurn([aa])(s)))
    h.run((e) => e.activateSkill(0))
    h.run((e) => e.playSidewaysCard(0, 'move'))
    expect(h.state().player.turn.movePointsAvailable).toBe(3)
  })
})

describe('Glittering Fortune (influence_per_crystal_color) — Goldyx', () => {
  it('grants Influence equal to the number of different crystal colours (in interaction)', () => {
    const h = createHarness('Goldyx')
    h.setState((s) => {
      const base = setupInteraction([])(s)
      return {
        ...base,
        player: {
          ...base.player,
          skills: [skill('Goldyx', 206)],
          mana: { ...base.player.mana, crystals: { red: 2, blue: 0, green: 1, white: 0 } },
        },
      }
    })
    const before = h.state().interaction!.influencePool
    h.run((e) => e.activateSkill(0))
    expect(h.state().interaction!.influencePool).toBe(before + 2) // red + green = 2 colours
  })

  it('does nothing outside interaction', () => {
    const h = createHarness('Goldyx')
    h.setState((s) => withSkill(skill('Goldyx', 206))(setupTurn([])(s)))
    h.run((e) => e.activateSkill(0))
    expect(h.state().player.skills[0].isUsedThisTurn).toBe(false)
  })
})

describe('Flight (flight) — Goldyx', () => {
  it('grants Move points and marks the flight flag', () => {
    const h = createHarness('Goldyx')
    h.setState((s) => withSkill(skill('Goldyx', 207))(setupTurn([])(s)))
    h.run((e) => e.activateSkill(0))
    expect(h.state().player.turn.movePointsAvailable).toBe(2)
    expect(h.state().player.turn.flightActive).toBe(true)
  })
})

describe('Universal Power (sideways_mana_boost) — Goldyx', () => {
  it('spends a mana and sets the next sideways play to +3 / +4', () => {
    const h = createHarness('Goldyx')
    h.setState((s) => manaWith({ tokens: [{ color: 'green', source: 'effect' }] })(withSkill(skill('Goldyx', 208))(setupTurn([])(s))))
    h.run((e) => e.activateSkill(0, { color: 'green' }))
    expect(h.state().player.turn.sidewaysBonus).toEqual({ base: 3, boosted: 4, mode: 'card_type' })
    expect(h.state().player.mana.playerMana.some((t) => t.color === 'green')).toBe(false) // mana spent
  })
})

describe('Prayer of Weather (cooperative_terrain_discount) — Norowas', () => {
  it('reduces a chosen terrain Move cost by 2 (min 1) for the player', () => {
    const h = createHarness('Norowas')
    h.setState((s) => withSkill(skill('Norowas', 109))(setupTurn([])(s)))
    h.run((e) => e.activateSkill(0, { terrain: 'swamp' }))
    const mods = (h.state().player.turn.terrainModifiers ?? []) as CardAction[]
    const r = new MovementResolver()
    // swamp day base 5 → 3
    expect(r.getMoveCost('swamp', 'day', mods)).toBe(3)
  })
})

describe('Cooperative self-benefits (solo) — Mana Overload / Source Opening', () => {
  it('Mana Overload gains a mana token of the chosen colour (Tovak)', () => {
    const h = createHarness('Tovak')
    h.setState((s) => withSkill(skill('Tovak', 310))(setupTurn([])(s)))
    h.run((e) => e.activateSkill(0, { color: 'red' }))
    expect(h.state().player.mana.playerMana.some((t) => t.color === 'red')).toBe(true)
  })

  it('Source Opening gains a crystal + extra Source die (Goldyx)', () => {
    const h = createHarness('Goldyx')
    h.setState((s) => withSkill(skill('Goldyx', 210))(setupTurn([])(s)))
    const before = h.state().player.mana.crystals.blue
    h.run((e) => e.activateSkill(0, { color: 'blue' }))
    expect(h.state().player.mana.crystals.blue).toBe(before + 1)
    expect(h.state().player.mana.extraSourceDice ?? 0).toBeGreaterThanOrEqual(1)
  })
})
