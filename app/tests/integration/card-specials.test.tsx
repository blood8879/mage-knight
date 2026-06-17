import { describe, it, expect } from 'vitest'
import { getSpells } from '@/data/loader'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { hexKey } from '@/engine/GameState'
import type { GameState, ManaToken, SpellCard, TerrainType } from '@/engine/types'

function spell(name: string): SpellCard {
  const c = getSpells().find((x) => x.name.startsWith(name))
  if (!c) throw new Error(name)
  return c
}
const tok = (c: string): ManaToken => ({ color: c as ManaToken['color'], source: 'die' })

/** Set the terrain of the player's current hex. */
function setTerrain(terrain: TerrainType) {
  return (s: GameState): GameState => {
    const key = hexKey(s.player.position)
    const grid = new Map(s.map.hexGrid)
    const hex = grid.get(key)
    if (hex) grid.set(key, { ...hex, terrain })
    return { ...s, map: { ...s.map, hexGrid: grid } }
  }
}

// Card "special" secondary clauses, verified against the card text (data.text).

describe('Restoration / Rebirth — forest heal bonus', () => {
  it('basic: Heal 3 normally', () => {
    const h = createHarness()
    h.setState((s) => setTerrain('plains')(manaWith({ tokens: [tok('green')] })(setupTurn([spell('Restoration')])(s))))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(3)
  })
  it('basic: Heal 5 when in a forest', () => {
    const h = createHarness()
    h.setState((s) => setTerrain('forest')(manaWith({ tokens: [tok('green')] })(setupTurn([spell('Restoration')])(s))))
    h.run((e) => e.playCard(0, 'basic'))
    expect(h.state().player.turn.healingAvailable ?? 0).toBe(5)
  })
})

import { setupInteraction as setupInter } from './card-play-harness'

describe('Charm / Possess — interaction crystal bonus', () => {
  it('basic in interaction: Influence 4 AND gain a chosen crystal', () => {
    const h = createHarness()
    h.setState((s) => manaWith({ tokens: [tok('white')] })(setupInter([spell('Charm')])(s)))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['blue'] }))
    expect(h.state().interaction?.influencePool).toBe(4)
    expect(h.state().player.mana.crystals.blue).toBe(1)
  })
})
