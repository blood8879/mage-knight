/**
 * Mana Search tactic (Night #3, id 9): "Once per turn, before you use mana from
 * the Source, you may reroll up to two mana dice." It must be usable only once
 * per turn — previously canActivateTactic always returned true for it, letting
 * the player reroll endlessly.
 */
import { describe, it, expect } from 'vitest'
import { canActivateTactic } from '@/engine/TacticEffectManager'
import type { TacticCard } from '@/engine/types'

function manaSearch(): TacticCard {
  return { id: 9, name: 'Mana Search', type: 'night', number: 3, effect: '', isUsed: false }
}

describe('canActivateTactic — Mana Search once per turn', () => {
  it('is available when not yet used this turn', () => {
    expect(canActivateTactic(manaSearch(), false).manaSearch).toBe(true)
  })

  it('is unavailable once used this turn', () => {
    expect(canActivateTactic(manaSearch(), true).manaSearch).toBe(false)
  })

  it('defaults to available (unused) when the flag is omitted', () => {
    expect(canActivateTactic(manaSearch()).manaSearch).toBe(true)
  })

  it('returns false for a non–Mana-Search tactic', () => {
    const rethink: TacticCard = { id: 2, name: 'Rethink', type: 'day', number: 2, effect: '', isUsed: false }
    expect(canActivateTactic(rethink, false).manaSearch).toBe(false)
  })
})
