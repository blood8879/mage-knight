import { describe, it, expect } from 'vitest'
import { MovementResolver } from '@/engine/MovementResolver'
import { validateSidewaysPlay } from '@/engine/CardPlayValidator'
import { getBasicActions } from '@/data/loader'
import { createHarness, setupTurn, setupInteraction } from './card-play-harness'
import type { AnyCard } from '@/engine/types'

function anyCard(): AnyCard {
  return getBasicActions().commonCards.find((c) => c.name === 'March')!
}

describe('Movement — terrain costs match the rulebook (p.5)', () => {
  const mr = new MovementResolver()
  const cases: Array<[string, 'day' | 'night', number | null]> = [
    ['plains', 'day', 2], ['plains', 'night', 2],
    ['hills', 'day', 3], ['hills', 'night', 3],
    ['forest', 'day', 3], ['forest', 'night', 5],   // forest harder at night
    ['desert', 'day', 5], ['desert', 'night', 3],   // desert easier at night
    ['swamp', 'day', 5], ['wasteland', 'day', 4],
    ['lake', 'day', null], ['mountain', 'day', null], // impassable
  ]
  cases.forEach(([terrain, dn, cost]) => {
    it(`${terrain} (${dn}) costs ${cost}`, () => {
      expect(mr.getMoveCost(terrain as never, dn)).toBe(cost)
    })
  })
})

describe('Sideways play (rulebook p.4-7)', () => {
  it('any non-wound card sideways → +1 Move in movement', () => {
    const h = createHarness()
    h.setState(setupTurn([anyCard()]))
    h.run((e) => e.playSidewaysCard(0, 'move'))
    expect(h.state().player.turn.movePointsAvailable).toBe(1)
  })

  it('any non-wound card sideways → +1 Influence in interaction', () => {
    const h = createHarness()
    h.setState(setupInteraction([anyCard()]))
    h.run((e) => e.playSidewaysCard(0, 'influence'))
    expect(h.state().interaction?.influencePool).toBe(1)
  })

  it('Wounds can NEVER be played sideways', () => {
    const wound = { type: 'wound', id: 'w1' } as AnyCard
    expect(validateSidewaysPlay(wound, 'move').valid).toBe(false)
    expect(validateSidewaysPlay(wound, 'attack').valid).toBe(false)
  })

  it('sideways attack is forbidden in the Ranged/Siege phase, allowed in melee', () => {
    const card = anyCard()
    expect(validateSidewaysPlay(card, 'attack', 'ranged_siege').valid).toBe(false)
    expect(validateSidewaysPlay(card, 'attack', 'attack').valid).toBe(true)
  })
})
