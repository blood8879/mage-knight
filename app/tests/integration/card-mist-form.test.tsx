import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { MovementResolver } from '@/engine/MovementResolver'
import { getSpells } from '@/data/loader'
import type { CardAction } from '@/engine/types'

/**
 * Mist Form (basic) played through the real playCard path must register the
 * turn-scoped terrain modifiers: all terrain (incl. lakes) cost 2, and hills /
 * mountains impassable. Spell basic needs the card's colour mana (blue).
 */
describe('Mist Form playCard wiring', () => {
  it('sets terrain modifiers so lakes cost 2 and hills/mountains are blocked', () => {
    const c = getSpells().find((x) => x.name.startsWith('Mist Form'))
    if (!c) return
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'blue', source: 'effect' }] })(setupTurn([c])(s)))
    h.run((e) => e.playCard(0, 'basic'))

    const mods = (h.state().player.turn.terrainModifiers ?? []) as CardAction[]
    expect(mods.length).toBeGreaterThanOrEqual(2)

    const r = new MovementResolver()
    expect(r.getMoveCost('lake', 'day', mods)).toBe(2)
    expect(r.getMoveCost('hills', 'day', mods)).toBeNull()
    expect(r.getMoveCost('mountain', 'day', mods)).toBeNull()
    expect(r.getMoveCost('plains', 'day', mods)).toBe(2)
  })
})
