import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { getAdvancedActions } from '@/data/loader'
import type { AnyCard } from '@/engine/types'

/**
 * Peaceful Moment (AA, id 36) — rulebook text:
 *  basic:  Influence 3. You may play this as your action: get Heal 1 for each
 *          2 Influence you spend.
 *  strong: Influence 6. … Heal 1 per 2 Influence and/or refresh Units.
 *
 * Influence is the primary use; the "as your action" clause converts the
 * Influence into Healing at 2:1 (basic 3 → Heal 1, strong 6 → Heal 3) via
 * engine.playPeacefulMoment, accumulating as healingAvailable.
 */
function peaceful(): AnyCard {
  const c = getAdvancedActions().find((x) => x.name === 'Peaceful Moment')
  if (!c) throw new Error('Peaceful Moment missing')
  return c
}

describe('Peaceful Moment: Influence spent as Healing', () => {
  it('basic → Heal 1 (Influence 3, 2:1)', () => {
    const h = createHarness('Tovak')
    h.setState(setupTurn([peaceful()]))
    const before = h.state().player.turn.healingAvailable ?? 0
    h.run((e) => e.playPeacefulMoment(0, 'basic'))
    expect((h.state().player.turn.healingAvailable ?? 0)).toBe(before + 1)
    expect(h.state().player.deck.hand).toHaveLength(0)
  })

  it('strong (white mana) → Heal 3 (Influence 6, 2:1)', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'white', source: 'effect' }] })(setupTurn([peaceful()])(s)))
    const before = h.state().player.turn.healingAvailable ?? 0
    h.run((e) => e.playPeacefulMoment(0, 'strong'))
    expect((h.state().player.turn.healingAvailable ?? 0)).toBe(before + 3)
  })

  it('strong without white mana is refused', () => {
    const h = createHarness('Tovak')
    h.setState(setupTurn([peaceful()]))
    h.run((e) => e.playPeacefulMoment(0, 'strong'))
    expect(h.state().player.deck.hand).toHaveLength(1) // not played
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(0)
  })
})
