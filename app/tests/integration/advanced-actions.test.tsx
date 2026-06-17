import { describe, it, expect } from 'vitest'
import { getAdvancedActions } from '@/data/loader'
import { createHarness, setupTurn, setupInteraction } from './card-play-harness'
import type { AdvancedActionCard, CardAction } from '@/engine/types'

const AAs = getAdvancedActions()

function basicActions(c: AdvancedActionCard): CardAction[] {
  return c.basicEffect?.actions ?? []
}
function sumOf(actions: CardAction[], type: string): number {
  return actions.filter((a) => a.type === type).reduce((s, a) => s + (a.value ?? 0), 0)
}

// Advanced Action BASIC effects are free (no mana). Each card is played through
// the real playCard path; its primary non-combat effect must actually apply.

describe('Advanced Actions — Move (basic, played in movement)', () => {
  const moveCards = AAs.filter((c) => sumOf(basicActions(c), 'move') > 0)
  it(`covers ${moveCards.length} move cards`, () => expect(moveCards.length).toBeGreaterThan(0))
  moveCards.forEach((c) => {
    it(`${c.name}: basic grants +${sumOf(basicActions(c), 'move')} Move`, () => {
      const h = createHarness()
      h.setState(setupTurn([c]))
      h.run((e) => e.playCard(0, 'basic'))
      expect(h.state().player.turn.movePointsAvailable).toBe(sumOf(basicActions(c), 'move'))
    })
  })
})

describe('Advanced Actions — Influence (basic, played in interaction)', () => {
  const infCards = AAs.filter((c) => sumOf(basicActions(c), 'influence') > 0)
  it(`covers ${infCards.length} influence cards`, () => expect(infCards.length).toBeGreaterThan(0))
  infCards.forEach((c) => {
    it(`${c.name}: basic grants +${sumOf(basicActions(c), 'influence')} Influence`, () => {
      const h = createHarness()
      h.setState(setupInteraction([c]))
      h.run((e) => e.playCard(0, 'basic'))
      expect(h.state().interaction?.influencePool).toBe(sumOf(basicActions(c), 'influence'))
    })
  })
})

describe('Advanced Actions — Heal (basic, played in movement)', () => {
  const healCards = AAs.filter((c) => sumOf(basicActions(c), 'heal') > 0 && sumOf(basicActions(c), 'influence') === 0)
  healCards.forEach((c) => {
    it(`${c.name}: basic grants +${sumOf(basicActions(c), 'heal')} Heal`, () => {
      const h = createHarness()
      h.setState(setupTurn([c]))
      h.run((e) => e.playCard(0, 'basic'))
      expect(h.state().player.turn.healingAvailable ?? 0).toBe(sumOf(basicActions(c), 'heal'))
    })
  })
})
