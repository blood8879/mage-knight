import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, setupInteraction } from './card-play-harness'
import { getHeroSkills } from '@/data/loader'
import type { GameState, HeroSkill, WoundCard } from '@/engine/types'

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
