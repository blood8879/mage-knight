import { describe, it, expect } from 'vitest'
import { MovementResolver } from '@/engine/MovementResolver'
import type { CardAction } from '@/engine/types'

/**
 * Mist Form / Veil of Mist (Spell, id 22) — basic:
 *   "Move 4. The Move costs of all terrains, including lakes, is 2. You cannot
 *    enter hills and mountains for the rest of this turn."
 *
 * The Move 4 is the primary effect; this covers the terrain clause:
 *  - every terrain (incl. lakes) costs 2
 *  - hills and mountains become impassable (cost null)
 */
describe('Mist Form terrain modifiers', () => {
  const r = new MovementResolver()
  // What playCard adds for Mist Form basic: the card's all_including_lakes
  // cost-2 modifier plus the impassable hills/mountain modifier.
  const mods: CardAction[] = [
    { type: 'terrain_modifier', terrain: 'all_including_lakes', newCost: 2 },
    { type: 'terrain_modifier', terrain: ['hills', 'mountain'], impassable: true },
  ]

  it('all normal terrains cost 2', () => {
    expect(r.getMoveCost('plains', 'day', mods)).toBe(2)
    expect(r.getMoveCost('forest', 'day', mods)).toBe(2)
    expect(r.getMoveCost('swamp', 'day', mods)).toBe(2)
    expect(r.getMoveCost('desert', 'day', mods)).toBe(2)
  })

  it('lakes become passable at cost 2', () => {
    expect(r.getMoveCost('lake', 'day')).toBeNull() // normally impassable
    expect(r.getMoveCost('lake', 'day', mods)).toBe(2)
  })

  it('hills and mountains are impassable', () => {
    expect(r.getMoveCost('hills', 'day', mods)).toBeNull()
    expect(r.getMoveCost('mountain', 'day', mods)).toBeNull()
  })

  it('without the modifiers, terrains use their normal costs', () => {
    expect(r.getMoveCost('hills', 'day')).not.toBeNull()
    expect(r.getMoveCost('plains', 'day')).toBe(2)
  })
})
