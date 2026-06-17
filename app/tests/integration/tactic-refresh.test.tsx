import { describe, it, expect } from 'vitest'
import { createHarness } from './card-play-harness'

/**
 * Rulebook (Tactics phase): every Round the used tactic cards are returned, so
 * all six tactic cards of the new Round's time (Day/Night) are available again.
 *
 * Regression: availableTactics was decremented on every pick but never refreshed
 * at round start, so after ~3 rounds (player + dummy each take one per round) the
 * pool of the current time emptied and the game stuck at round_start with no
 * tactic to offer. processEndOfRound must restore the full tactic list.
 */
describe('Tactics refresh each round', () => {
  it('processEndOfRound restores the full tactic pool', () => {
    const h = createHarness('Arythea')

    const total = h.state().availableTactics.length
    expect(total).toBeGreaterThanOrEqual(12) // 6 day + 6 night

    // Simulate a round where the pool was drained down to a single card.
    h.setState((s) => ({
      ...s,
      round: 2,
      phase: 'end_of_round',
      availableTactics: s.availableTactics.slice(0, 1),
    }))
    expect(h.state().availableTactics.length).toBe(1)

    h.run((e) => e.processEndOfRound())

    const after = h.state()
    expect(after.round).toBe(3)
    expect(after.phase).toBe('round_start')
    // Full pool restored, with both Day and Night tactics present.
    expect(after.availableTactics.length).toBe(total)
    expect(after.availableTactics.some((t) => t.type === 'day')).toBe(true)
    expect(after.availableTactics.some((t) => t.type === 'night')).toBe(true)
  })

  it('the new round always offers tactics of the current time', () => {
    const h = createHarness('Arythea')
    h.setState((s) => ({
      ...s,
      round: 1,
      phase: 'end_of_round',
      availableTactics: [],
    }))

    h.run((e) => e.processEndOfRound())

    const after = h.state()
    const ofCurrentTime = after.availableTactics.filter((t) => t.type === after.dayNight)
    expect(ofCurrentTime.length).toBe(6)
  })
})
