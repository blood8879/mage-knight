import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { MovementResolver } from '@/engine/MovementResolver'
import { getAdvancedActions } from '@/data/loader'
import type { AnyCard, CardAction } from '@/engine/types'

/**
 * Song of Wind (AA, id 11) — rulebook text:
 *  basic:  Move 2. plains/desert/wasteland Move cost −1 (min 0).
 *  strong: Move 2. plains/desert/wasteland Move cost −2 (min 0). You may pay a
 *          blue mana to travel through lakes for Move cost 0 this turn.
 *
 * The Move + terrain reduction is the primary effect; this covers the strong
 * clause: paying blue makes lakes travellable at cost 0.
 */
function song(): AnyCard {
  const c = getAdvancedActions().find((x) => x.name === 'Song of Wind')
  if (!c) throw new Error('Song of Wind missing')
  return c
}

describe('Song of Wind: blue-mana lake travel (strong)', () => {
  it('paying blue adds a lake-travel modifier (lake cost 0) and reductions', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [
      { color: 'white', source: 'effect' }, // strong cost
      { color: 'blue', source: 'effect' },  // lake option
    ] })(setupTurn([song()])(s)))
    h.run((e) => e.playCard(0, 'strong', { songOfWindLake: true }))

    const mods = (h.state().player.turn.terrainModifiers ?? []) as CardAction[]
    const r = new MovementResolver()
    expect(r.getMoveCost('lake', 'day', mods)).toBe(0) // lake now travellable
    expect(r.getMoveCost('plains', 'day', mods)).toBe(0) // 2 − 2 reduction
    // The blue mana was consumed.
    expect(h.state().player.mana.playerMana.some((t) => t.color === 'blue')).toBe(false)
  })

  it('without paying blue, lakes stay impassable', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'white', source: 'effect' }] })(setupTurn([song()])(s)))
    h.run((e) => e.playCard(0, 'strong'))
    const mods = (h.state().player.turn.terrainModifiers ?? []) as CardAction[]
    const r = new MovementResolver()
    expect(r.getMoveCost('lake', 'day', mods)).toBeNull() // still impassable
    expect(r.getMoveCost('plains', 'day', mods)).toBe(0) // reduction still applies
  })
})
