import type { HexCoord, HexCell, TerrainType, DayNight, CardAction } from './types'
import type { MapState } from './GameState'
import { TERRAIN_MOVE_COST } from './GameState'
import { hexKey, hexNeighbors } from '@/utils/hexMath'

const FORTIFIED_SITES = new Set(['keep', 'mageTower', 'city'])

/** Turn-scoped terrain cost modifiers from cards (Frost Bridge, Path Finding…). */
export type TerrainModifier = CardAction

function modifierMatches(mod: TerrainModifier, terrain: TerrainType): boolean {
  const target = mod.terrain
  if (target === 'all') return true
  // Mist Form: "the Move cost of all terrains, including lakes, is 2".
  if (target === 'all_including_lakes') return true
  if (typeof target === 'string') return target === terrain
  if (Array.isArray(target)) return (target as string[]).includes(terrain)
  return false
}

export class MovementResolver {
  getMoveCost(
    terrain: TerrainType,
    dayNight: DayNight,
    modifiers?: TerrainModifier[],
  ): number | null {
    const costs = TERRAIN_MOVE_COST[terrain]
    let cost = costs ? costs[dayNight] : null

    if (!modifiers || modifiers.length === 0) return cost

    for (const mod of modifiers) {
      if (!modifierMatches(mod, terrain)) continue
      if (mod.impassable) {
        // Mist Form: "you cannot enter hills and mountains this turn."
        cost = null
      } else if (typeof mod.newCost === 'number') {
        // Impassable terrain (lake) becomes passable only when explicitly enabled.
        // 'all_including_lakes' (Mist Form) implicitly enables lake travel.
        const lakeEnabled = mod.enableLake || mod.terrain === 'all_including_lakes'
        if (cost === null && !(terrain === 'lake' && lakeEnabled)) continue
        cost = mod.newCost
      } else if (typeof mod.costReduction === 'number' && cost !== null) {
        const minimum = typeof mod.minimum === 'number' ? mod.minimum : 0
        cost = Math.max(minimum, cost - mod.costReduction)
      }
    }
    return cost
  }

  canMoveTo(hex: HexCell, dayNight: DayNight, modifiers?: TerrainModifier[]): boolean {
    const cost = this.getMoveCost(hex.terrain, dayNight, modifiers)
    if (cost === null) return false

    if (hex.enemyTokens.length > 0 && !hex.siteData?.isConquered) {
      return true
    }

    return true
  }

  getReachableHexes(
    mapState: MapState,
    from: HexCoord,
    movePoints: number,
    dayNight: DayNight,
    modifiers?: TerrainModifier[],
  ): Map<string, number> {
    const reachable = new Map<string, number>()
    const fromKey = hexKey(from)
    reachable.set(fromKey, movePoints)

    const queue: Array<{ coord: HexCoord; remaining: number }> = [
      { coord: from, remaining: movePoints },
    ]

    while (queue.length > 0) {
      queue.sort((a, b) => b.remaining - a.remaining)
      const current = queue.shift()!

      for (const neighbor of hexNeighbors(current.coord)) {
        const neighborKey = hexKey(neighbor)
        const hex = mapState.hexGrid.get(neighborKey)

        if (!hex) continue
        if (!this.canMoveTo(hex, dayNight, modifiers)) continue

        const cost = this.getMoveCost(hex.terrain, dayNight, modifiers)
        if (cost === null) continue

        const remaining = current.remaining - cost
        if (remaining < 0) continue

        const existingRemaining = reachable.get(neighborKey)
        if (existingRemaining !== undefined && existingRemaining >= remaining) continue

        reachable.set(neighborKey, remaining)

        const isFortifiedUnconquered =
          hex.site !== undefined &&
          FORTIFIED_SITES.has(hex.site) &&
          hex.siteData !== undefined &&
          !hex.siteData.isConquered

        const hasRampagingEnemies =
          hex.enemyTokens.length > 0 &&
          (hex.siteData === undefined || !hex.siteData.isConquered)

        if (!isFortifiedUnconquered && !hasRampagingEnemies) {
          queue.push({ coord: neighbor, remaining })
        }
      }
    }

    return reachable
  }

  getMovementPath(
    mapState: MapState,
    from: HexCoord,
    to: HexCoord,
    dayNight: DayNight,
    modifiers?: TerrainModifier[],
  ): { path: HexCoord[]; cost: number } | null {
    const toKey = hexKey(to)
    const targetHex = mapState.hexGrid.get(toKey)
    if (!targetHex) return null
    if (!this.canMoveTo(targetHex, dayNight, modifiers)) return null

    const dist = new Map<string, number>()
    const prev = new Map<string, string>()
    const fromKey = hexKey(from)
    dist.set(fromKey, 0)

    const queue: Array<{ coord: HexCoord; cost: number }> = [
      { coord: from, cost: 0 },
    ]

    while (queue.length > 0) {
      queue.sort((a, b) => a.cost - b.cost)
      const current = queue.shift()!
      const currentKey = hexKey(current.coord)

      if (currentKey === toKey) break

      const currentCost = dist.get(currentKey)!
      if (currentCost > current.cost) continue

      const currentHex = mapState.hexGrid.get(currentKey)
      if (currentKey !== fromKey && currentHex) {
        const isFortifiedUnconquered =
          currentHex.site !== undefined &&
          FORTIFIED_SITES.has(currentHex.site) &&
          currentHex.siteData !== undefined &&
          !currentHex.siteData.isConquered

        const hasRampagingEnemies =
          currentHex.enemyTokens.length > 0 &&
          (currentHex.siteData === undefined || !currentHex.siteData.isConquered)

        if (isFortifiedUnconquered || hasRampagingEnemies) continue
      }

      for (const neighbor of hexNeighbors(current.coord)) {
        const neighborKey = hexKey(neighbor)
        const hex = mapState.hexGrid.get(neighborKey)
        if (!hex) continue
        if (!this.canMoveTo(hex, dayNight, modifiers)) continue

        const moveCost = this.getMoveCost(hex.terrain, dayNight, modifiers)
        if (moveCost === null) continue

        const totalCost = currentCost + moveCost
        const existingCost = dist.get(neighborKey)

        if (existingCost === undefined || totalCost < existingCost) {
          dist.set(neighborKey, totalCost)
          prev.set(neighborKey, currentKey)
          queue.push({ coord: neighbor, cost: totalCost })
        }
      }
    }

    if (!dist.has(toKey)) return null

    const path: HexCoord[] = []
    let current = toKey
    while (current !== fromKey) {
      const [q, r] = current.split(',').map(Number)
      path.unshift({ q, r })
      const previous = prev.get(current)
      if (!previous) return null
      current = previous
    }
    path.unshift(from)

    return { path, cost: dist.get(toKey)! }
  }

  getTileRevealCost(): number {
    return 2
  }

  canRevealTile(mapState: MapState, playerPos: HexCoord): boolean {
    if (mapState.tileDeck.length === 0) return false

    const occupiedHexes = new Set<string>()
    const seaHexKeys = new Set<string>()
    for (const hex of mapState.hexGrid.values()) {
      occupiedHexes.add(hexKey(hex.coord))
      if (hex.terrain === 'sea') {
        seaHexKeys.add(hexKey(hex.coord))
      }
    }

    for (const neighbor of hexNeighbors(playerPos)) {
      if (occupiedHexes.has(hexKey(neighbor))) continue

      // The empty space is "behind a coastline" only if every occupied hex
      // adjacent to it is a sea hex (i.e. the only route to it crosses sea).
      const emptyHexNeighbors = hexNeighbors(neighbor)
      const occupiedNeighbors = emptyHexNeighbors.filter((n) => occupiedHexes.has(hexKey(n)))
      const allOccupiedNeighborsAreSea = occupiedNeighbors.length > 0 &&
        occupiedNeighbors.every((n) => seaHexKeys.has(hexKey(n)))
      if (allOccupiedNeighborsAreSea) continue

      return true
    }

    return false
  }
}
