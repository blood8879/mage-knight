import { describe, it, expect } from 'vitest'
import { DeckManager } from '@/engine/DeckManager'
import { SeededRandom } from '@/utils/random'
import type { DeckState, AnyCard } from '@/engine/types'

const dm = new DeckManager(new SeededRandom(42))
function cards(n: number): AnyCard[] {
  return Array.from({ length: n }, (_, i) => ({ id: 1000 + i, name: `C${i}`, type: 'basic_action', color: 'red', basicEffect: { text: '', actions: [] }, strongEffect: { text: '', actions: [] }, copies: 1, heroSpecific: null, replaces: null, set: 'base' } as never))
}
function deck(hand: number, draw: number, discard: number): DeckState {
  return { hand: cards(hand), drawPile: cards(draw), playArea: [], discardPile: cards(discard) }
}

describe('End-of-turn draw (rulebook p.9)', () => {
  it('draws up to the Hand limit', () => {
    const out = dm.drawToHandLimit(deck(2, 10, 0), 5)
    expect(out.hand.length).toBe(5)
    expect(out.drawPile.length).toBe(7)
  })
  it('does NOT reshuffle the discard pile mid-round — stops when the deck runs out', () => {
    const out = dm.drawToHandLimit(deck(2, 1, 8), 5)
    expect(out.hand.length).toBe(3) // 2 + only 1 available
    expect(out.drawPile.length).toBe(0)
    expect(out.discardPile.length).toBe(8) // untouched
  })
  it('draws nothing when already at/over the Hand limit', () => {
    const out = dm.drawToHandLimit(deck(5, 10, 0), 5)
    expect(out.hand.length).toBe(5)
    expect(out.drawPile.length).toBe(10)
  })
})
