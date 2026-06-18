import { describe, it, expect } from 'vitest'
import { createHarness, setupInteraction } from './card-play-harness'
import { getArtifacts, getRegularUnits } from '@/data/loader'
import type { AnyCard, UnitInstance } from '@/engine/types'

/**
 * Banner of Command (Artifact, id 18) basic — rulebook text:
 *   "Influence 4. If you recruited a Unit this turn, you may assign this card
 *    to it instead of a Command token."
 *
 * Unlike the other (assign-only) banners, Banner of Command's primary effect is
 * Influence 4. Assigning is optional — and when assigned, you still gain the
 * Influence. Previously the generic banner-attach path swallowed the Influence.
 */
function banner(): AnyCard {
  const c = getArtifacts().find((x) => x.name === 'Banner of Command')
  if (!c) throw new Error('Banner of Command missing')
  return c
}
function readyUnit(): UnitInstance {
  const u = getRegularUnits()[0]
  return { unit: u, status: 'ready', woundCount: 0 }
}

describe('Banner of Command', () => {
  it('assigning it to a unit attaches the card AND grants Influence 4', () => {
    const h = createHarness('Tovak')
    h.setState((s) => {
      const base = setupInteraction([banner()])(s)
      return { ...base, player: { ...base.player, units: [readyUnit()] } }
    })
    const before = h.state().interaction!.influencePool
    h.run((e) => e.attachBanner(0, 0))

    const after = h.state()
    expect(after.player.units[0].bannerCard?.name).toBe('Banner of Command')
    expect(after.interaction!.influencePool).toBe(before + 4) // Influence 4 still applied
    expect(after.player.deck.hand).toHaveLength(0)
  })

  it('played for Influence only adds 4 to the pool without attaching', () => {
    const h = createHarness('Tovak')
    h.setState((s) => {
      const base = setupInteraction([banner()])(s)
      return { ...base, player: { ...base.player, units: [readyUnit()] } }
    })
    const before = h.state().interaction!.influencePool
    h.run((e) => e.playCard(0, 'basic'))

    const after = h.state()
    expect(after.interaction!.influencePool).toBe(before + 4)
    expect(after.player.units[0].bannerCard).toBeUndefined() // not attached
  })
})
