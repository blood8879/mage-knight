import { describe, it, expect, beforeEach } from 'vitest'
import { MovementResolver } from '@/engine/MovementResolver'
import { TERRAIN_MOVE_COST, hexKey } from '@/engine/GameState'
import type { MapState } from '@/engine/GameState'
import type { HexCell, HexCoord, TerrainType, DayNight } from '@/engine/types'

// Helper to create a minimal hex cell
function makeHex(q: number, r: number, terrain: TerrainType, overrides: Partial<HexCell> = {}): HexCell {
  return {
    coord: { q, r },
    terrain,
    enemyTokens: [],
    tileId: 'tile_1',
    isRevealed: true,
    ...overrides,
  }
}

// Helper to create a MapState from hex cells
function makeMapState(hexes: HexCell[]): MapState {
  const hexGrid = new Map<string, HexCell>()
  for (const hex of hexes) {
    hexGrid.set(hexKey(hex.coord), hex)
  }
  return { tiles: [], tileDeck: [], hexGrid }
}

describe('Walkthrough: Movement (Phase 2)', () => {
  let resolver: MovementResolver

  beforeEach(() => {
    resolver = new MovementResolver()
  })

  describe('terrain costs — day', () => {
    it('plains cost 2 movement points during day', () => {
      expect(resolver.getMoveCost('plains', 'day')).toBe(2)
    })

    it('hills cost 3 during day', () => {
      expect(resolver.getMoveCost('hills', 'day')).toBe(3)
    })

    it('forest costs 3 during day', () => {
      expect(resolver.getMoveCost('forest', 'day')).toBe(3)
    })

    it('wasteland costs 4 during day', () => {
      expect(resolver.getMoveCost('wasteland', 'day')).toBe(4)
    })

    it('desert costs 5 during day', () => {
      expect(resolver.getMoveCost('desert', 'day')).toBe(5)
    })

    it('swamp costs 5 during day', () => {
      expect(resolver.getMoveCost('swamp', 'day')).toBe(5)
    })

    it('lake is impassable', () => {
      expect(resolver.getMoveCost('lake', 'day')).toBeNull()
    })

    it('mountain is impassable', () => {
      expect(resolver.getMoveCost('mountain', 'day')).toBeNull()
    })
  })

  describe('terrain costs — night differences', () => {
    it('forest costs 5 at night (vs 3 day)', () => {
      expect(resolver.getMoveCost('forest', 'night')).toBe(5)
    })

    it('desert costs 3 at night (vs 5 day)', () => {
      expect(resolver.getMoveCost('desert', 'night')).toBe(3)
    })
  })

  describe('pathfinding', () => {
    it('finds shortest path across plains', () => {
      // Create a simple 3-hex line: (0,0) plains -> (1,0) plains -> (2,0) plains
      const hexes = [makeHex(0, 0, 'plains'), makeHex(1, 0, 'plains'), makeHex(2, 0, 'plains')]
      const map = makeMapState(hexes)
      const result = resolver.getMovementPath(map, { q: 0, r: 0 }, { q: 2, r: 0 }, 'day')
      expect(result).not.toBeNull()
      expect(result!.cost).toBe(4) // 2 plains = 2+2 = 4
      expect(result!.path).toHaveLength(3)
    })

    it('returns null for unreachable hex (lake blocking)', () => {
      const hexes = [makeHex(0, 0, 'plains'), makeHex(1, 0, 'lake'), makeHex(2, 0, 'plains')]
      const map = makeMapState(hexes)
      const result = resolver.getMovementPath(map, { q: 0, r: 0 }, { q: 2, r: 0 }, 'day')
      expect(result).toBeNull()
    })
  })

  describe('tile reveal', () => {
    it('tile reveal costs 2 movement points', () => {
      expect(resolver.getTileRevealCost()).toBe(2)
    })
  })
})
