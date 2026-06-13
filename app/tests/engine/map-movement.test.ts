import { describe, it, expect } from 'vitest'
import {
  hexNeighbors,
  hexDistance,
  hexKey,
  parseHexKey,
  hexesEqual,
  tileHexOffsets,
  getTileHexes,
} from '@/utils/hexMath'
import { MapGenerator } from '@/engine/MapGenerator'
import type { MapConfig } from '@/engine/MapGenerator'
import { MovementResolver } from '@/engine/MovementResolver'
import type { HexCoord, HexCell, TerrainType } from '@/engine/types'
import type { MapState } from '@/engine/GameState'
import { SeededRandom } from '@/utils/random'

// ── Hex Math ──────────────────────────────

describe('hexMath', () => {
  it('hexNeighbors returns 6 adjacent coordinates', () => {
    const center: HexCoord = { q: 0, r: 0 }
    const neighbors = hexNeighbors(center)
    expect(neighbors).toHaveLength(6)

    const expected: HexCoord[] = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ]
    for (const exp of expected) {
      expect(neighbors).toContainEqual(exp)
    }
  })

  it('hexDistance returns correct manhattan distance', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0)
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1)
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2)
    expect(hexDistance({ q: -1, r: 2 }, { q: 1, r: -1 })).toBe(3)
  })

  it('hexKey and parseHexKey are inverse operations', () => {
    const coord: HexCoord = { q: 3, r: -5 }
    const key = hexKey(coord)
    expect(key).toBe('3,-5')
    expect(parseHexKey(key)).toEqual(coord)
  })

  it('hexesEqual checks coordinate equality', () => {
    expect(hexesEqual({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true)
    expect(hexesEqual({ q: 1, r: 2 }, { q: 2, r: 1 })).toBe(false)
  })

  it('tileHexOffsets returns 7 offsets (center + 6 neighbors)', () => {
    const offsets = tileHexOffsets()
    expect(offsets).toHaveLength(7)
    expect(offsets[0]).toEqual({ q: 0, r: 0 })
  })

  it('getTileHexes returns 7 absolute coordinates for a tile', () => {
    const center: HexCoord = { q: 3, r: -2 }
    const hexes = getTileHexes(center)
    expect(hexes).toHaveLength(7)
    expect(hexes[0]).toEqual(center)

    for (const hex of hexes.slice(1)) {
      expect(hexDistance(center, hex)).toBe(1)
    }
  })
})

// ── MapGenerator ──────────────────────────

describe('MapGenerator', () => {
  const seed = 42
  const makeGenerator = () => new MapGenerator(new SeededRandom(seed))

  it('starting tile has portal on center hex', () => {
    const gen = makeGenerator()
    const tile = gen.generateStartingTile('A')

    expect(tile.type).toBe('starting')
    expect(tile.hexes).toHaveLength(7)
    expect(tile.position).toEqual({ q: 0, r: 0 })

    const portalHex = tile.hexes.find((h) => h.site === 'portal')
    expect(portalHex).toBeDefined()
    expect(portalHex!.coord).toEqual({ q: 0, r: 0 })
    expect(portalHex!.terrain).toBe('plains')
  })

  it('countryside tile has appropriate sites and at least 1 impassable', () => {
    const gen = makeGenerator()
    const hexes = gen.generateTileHexes('countryside_1', 'countryside', { q: 2, r: 0 })

    expect(hexes).toHaveLength(7)

    const impassable = hexes.filter(
      (h) => h.terrain === 'lake' || h.terrain === 'mountain',
    )
    expect(impassable.length).toBeGreaterThanOrEqual(1)

    const sitedHexes = hexes.filter((h) => h.site !== undefined)
    expect(sitedHexes.length).toBeGreaterThanOrEqual(1)
    expect(sitedHexes.length).toBeLessThanOrEqual(3)
  })

  it('core tile with city has city on center hex', () => {
    const gen = makeGenerator()
    const hexes = gen.generateTileHexes('core_city_green', 'core', { q: 4, r: 0 }, 'green')

    expect(hexes).toHaveLength(7)

    const centerHex = hexes[0]
    expect(centerHex.terrain).toBe('city')
    expect(centerHex.site).toBe('city')
    expect(centerHex.siteData).toBeDefined()
    expect(centerHex.siteData!.cityColor).toBe('green')
    expect(centerHex.siteData!.shieldTokens).toBe(2)
  })

  it('generateMap creates initial map with correct tile count', () => {
    const gen = makeGenerator()
    const config: MapConfig = {
      startingSide: 'A',
      countrysideTileCount: 4,
      coreTileCount: 3,
      coreCityCount: 1,
    }
    const mapState = gen.generateMap(config)

    expect(mapState.tiles.length).toBeGreaterThanOrEqual(3)
    expect(mapState.tiles.length).toBeLessThanOrEqual(4)

    const startingTile = mapState.tiles.find((t) => t.type === 'starting')
    expect(startingTile).toBeDefined()

    const totalDeckSize = config.countrysideTileCount + config.coreTileCount
    const revealedNonStarting = mapState.tiles.length - 1
    expect(mapState.tileDeck.length).toBe(totalDeckSize - revealedNonStarting)
  })

  it('revealTile adds a new tile to the map', () => {
    const gen = makeGenerator()
    const config: MapConfig = {
      startingSide: 'A',
      countrysideTileCount: 5,
      coreTileCount: 2,
      coreCityCount: 1,
    }
    const initialMap = gen.generateMap(config)
    const initialTileCount = initialMap.tiles.length
    const initialDeckSize = initialMap.tileDeck.length

    const placements = gen.getValidTilePlacements(initialMap)
    if (placements.length > 0 && initialDeckSize > 0) {
      const newMap = gen.revealTile(initialMap, placements[0])
      expect(newMap.tiles.length).toBe(initialTileCount + 1)
      expect(newMap.tileDeck.length).toBe(initialDeckSize - 1)
      expect(newMap.hexGrid.size).toBeGreaterThan(initialMap.hexGrid.size)
    }
  })

  it('getValidTilePlacements returns adjacent non-overlapping positions', () => {
    const gen = makeGenerator()
    const startingTile = gen.generateStartingTile('A')
    const hexGrid = new Map<string, HexCell>()
    for (const hex of startingTile.hexes) {
      hexGrid.set(hexKey(hex.coord), hex)
    }
    const mapState: MapState = {
      tiles: [startingTile],
      tileDeck: ['countryside_1'],
      hexGrid,
    }

    const placements = gen.getValidTilePlacements(mapState)
    expect(placements.length).toBeGreaterThan(0)

    const occupiedKeys = new Set<string>()
    for (const hex of mapState.hexGrid.values()) {
      occupiedKeys.add(hexKey(hex.coord))
    }
    for (const placement of placements) {
      const tileHexes = getTileHexes(placement)
      const overlaps = tileHexes.some((h) => occupiedKeys.has(hexKey(h)))
      expect(overlaps).toBe(false)
    }
  })

  it('revealTile does not mutate original map state (immutability)', () => {
    const gen = makeGenerator()
    const config: MapConfig = {
      startingSide: 'A',
      countrysideTileCount: 5,
      coreTileCount: 2,
      coreCityCount: 1,
    }
    const originalMap = gen.generateMap(config)
    const originalTileCount = originalMap.tiles.length
    const originalDeckLength = originalMap.tileDeck.length
    const originalGridSize = originalMap.hexGrid.size

    const placements = gen.getValidTilePlacements(originalMap)
    if (placements.length > 0 && originalMap.tileDeck.length > 0) {
      gen.revealTile(originalMap, placements[0])
      expect(originalMap.tiles.length).toBe(originalTileCount)
      expect(originalMap.tileDeck.length).toBe(originalDeckLength)
      expect(originalMap.hexGrid.size).toBe(originalGridSize)
    }
  })

  it('getHexAt returns the correct hex cell', () => {
    const gen = makeGenerator()
    const tile = gen.generateStartingTile('A')
    const hexGrid = new Map<string, HexCell>()
    for (const hex of tile.hexes) {
      hexGrid.set(hexKey(hex.coord), hex)
    }
    const mapState: MapState = { tiles: [tile], tileDeck: [], hexGrid }

    const center = gen.getHexAt(mapState, { q: 0, r: 0 })
    expect(center).toBeDefined()
    expect(center!.site).toBe('portal')

    const missing = gen.getHexAt(mapState, { q: 99, r: 99 })
    expect(missing).toBeUndefined()
  })
})

// ── MovementResolver ──────────────────────

describe('MovementResolver', () => {
  const resolver = new MovementResolver()

  it('getMoveCost returns correct day/night costs', () => {
    expect(resolver.getMoveCost('plains', 'day')).toBe(2)
    expect(resolver.getMoveCost('plains', 'night')).toBe(2)
    expect(resolver.getMoveCost('forest', 'day')).toBe(3)
    expect(resolver.getMoveCost('forest', 'night')).toBe(5)
    expect(resolver.getMoveCost('desert', 'day')).toBe(5)
    expect(resolver.getMoveCost('desert', 'night')).toBe(3)
  })

  it('getMoveCost returns null for impassable terrain', () => {
    expect(resolver.getMoveCost('lake', 'day')).toBeNull()
    expect(resolver.getMoveCost('mountain', 'day')).toBeNull()
    expect(resolver.getMoveCost('sea', 'night')).toBeNull()
  })

  it('getReachableHexes returns BFS reachable hexes', () => {
    const hexGrid = new Map<string, HexCell>()
    const origin: HexCoord = { q: 0, r: 0 }
    const terrains: Array<[HexCoord, TerrainType]> = [
      [{ q: 0, r: 0 }, 'plains'],
      [{ q: 1, r: 0 }, 'plains'],
      [{ q: 0, r: 1 }, 'hills'],
      [{ q: -1, r: 1 }, 'forest'],
      [{ q: 1, r: -1 }, 'lake'],
    ]

    for (const [coord, terrain] of terrains) {
      hexGrid.set(hexKey(coord), {
        coord,
        terrain,
        enemyTokens: [],
        tileId: 'test',
        isRevealed: true,
      })
    }

    const mapState: MapState = { tiles: [], tileDeck: [], hexGrid }
    const reachable = resolver.getReachableHexes(mapState, origin, 5, 'day')

    expect(reachable.has(hexKey(origin))).toBe(true)
    expect(reachable.has(hexKey({ q: 1, r: 0 }))).toBe(true)
    expect(reachable.has(hexKey({ q: 0, r: 1 }))).toBe(true)
    expect(reachable.has(hexKey({ q: 1, r: -1 }))).toBe(false)
    expect(reachable.get(hexKey({ q: 1, r: 0 }))).toBe(3)
  })

  it('getMovementPath finds shortest path', () => {
    const hexGrid = new Map<string, HexCell>()
    const coords: Array<[HexCoord, TerrainType]> = [
      [{ q: 0, r: 0 }, 'plains'],
      [{ q: 1, r: 0 }, 'plains'],
      [{ q: 2, r: 0 }, 'plains'],
    ]

    for (const [coord, terrain] of coords) {
      hexGrid.set(hexKey(coord), {
        coord,
        terrain,
        enemyTokens: [],
        tileId: 'test',
        isRevealed: true,
      })
    }

    const mapState: MapState = { tiles: [], tileDeck: [], hexGrid }
    const result = resolver.getMovementPath(
      mapState,
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      'day',
    )

    expect(result).not.toBeNull()
    expect(result!.path).toHaveLength(3)
    expect(result!.path[0]).toEqual({ q: 0, r: 0 })
    expect(result!.path[2]).toEqual({ q: 2, r: 0 })
    expect(result!.cost).toBe(4)
  })

  it('getMovementPath returns null for unreachable target', () => {
    const hexGrid = new Map<string, HexCell>()
    hexGrid.set(hexKey({ q: 0, r: 0 }), {
      coord: { q: 0, r: 0 },
      terrain: 'plains',
      enemyTokens: [],
      tileId: 'test',
      isRevealed: true,
    })
    hexGrid.set(hexKey({ q: 1, r: 0 }), {
      coord: { q: 1, r: 0 },
      terrain: 'lake',
      enemyTokens: [],
      tileId: 'test',
      isRevealed: true,
    })

    const mapState: MapState = { tiles: [], tileDeck: [], hexGrid }
    const result = resolver.getMovementPath(
      mapState,
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      'day',
    )
    expect(result).toBeNull()
  })

  it('getTileRevealCost returns 2', () => {
    expect(resolver.getTileRevealCost()).toBe(2)
  })

  it('canRevealTile checks adjacent empty spaces and deck', () => {
    const gen = new MapGenerator(new SeededRandom(42))
    const tile = gen.generateStartingTile('A')
    const hexGrid = new Map<string, HexCell>()
    for (const hex of tile.hexes) {
      hexGrid.set(hexKey(hex.coord), hex)
    }

    const edgeHex: HexCoord = { q: 1, r: 0 }

    const mapWithDeck: MapState = {
      tiles: [tile],
      tileDeck: ['countryside_1'],
      hexGrid,
    }
    expect(resolver.canRevealTile(mapWithDeck, edgeHex)).toBe(true)

    const mapNoDeck: MapState = {
      tiles: [tile],
      tileDeck: [],
      hexGrid,
    }
    expect(resolver.canRevealTile(mapNoDeck, edgeHex)).toBe(false)
  })

  it('fortified unconquered sites block movement through', () => {
    const hexGrid = new Map<string, HexCell>()
    const coords: Array<[HexCoord, TerrainType, boolean]> = [
      [{ q: 0, r: 0 }, 'plains', false],
      [{ q: 1, r: 0 }, 'plains', true],
      [{ q: 2, r: 0 }, 'plains', false],
    ]

    for (const [coord, terrain, hasFortifiedSite] of coords) {
      const cell: HexCell = {
        coord,
        terrain,
        enemyTokens: [],
        tileId: 'test',
        isRevealed: true,
      }
      if (hasFortifiedSite) {
        cell.site = 'keep'
        cell.siteData = {
          type: 'keep',
          isConquered: false,
          enemyTokenIds: ['enemy_1'],
          shieldTokens: 0,
        }
      }
      hexGrid.set(hexKey(coord), cell)
    }

    const mapState: MapState = { tiles: [], tileDeck: [], hexGrid }

    const reachable = resolver.getReachableHexes(mapState, { q: 0, r: 0 }, 10, 'day')
    expect(reachable.has(hexKey({ q: 1, r: 0 }))).toBe(true)
    expect(reachable.has(hexKey({ q: 2, r: 0 }))).toBe(false)
  })
})
