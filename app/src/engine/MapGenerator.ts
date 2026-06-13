import type {
  HexCoord,
  HexCell,
  MapTile,
  TerrainType,
  SiteType,
  SiteState,
  CityColor,
  ManaColor,
} from './types'
import type { MapState } from './GameState'
import type { SeededRandom } from '@/utils/random'
import { hexKey, getTileHexes, hexNeighbors } from '@/utils/hexMath'

export interface MapConfig {
  startingSide: 'A' | 'B'
  countrysideTileCount: number
  coreTileCount: number
  coreCityCount: number
}

const COUNTRYSIDE_TERRAINS: TerrainType[] = [
  'plains', 'plains', 'hills', 'hills', 'forest', 'forest',
  'wasteland', 'desert', 'swamp',
]

const CORE_TERRAINS: TerrainType[] = [
  'plains', 'hills', 'hills', 'forest', 'wasteland', 'wasteland',
  'desert', 'swamp',
]

const COUNTRYSIDE_SITES: SiteType[] = [
  'village', 'monastery', 'keep', 'mageTower', 'dungeon',
  'monsterDen', 'spawningGrounds', 'crystalMine', 'magicalGlade',
]

const CORE_SITES: SiteType[] = [
  'keep', 'mageTower', 'dungeon', 'tomb', 'monsterDen',
  'spawningGrounds', 'ancientRuins',
]

const SITE_TERRAIN_AFFINITY: Partial<Record<SiteType, TerrainType[]>> = {
  village: ['plains', 'hills'],
  monastery: ['plains', 'hills', 'forest'],
  keep: ['plains', 'hills', 'wasteland'],
  mageTower: ['plains', 'hills', 'forest', 'wasteland'],
  dungeon: ['wasteland', 'hills', 'swamp'],
  tomb: ['wasteland', 'desert', 'swamp'],
  ancientRuins: ['wasteland', 'desert', 'hills'],
  monsterDen: ['forest', 'hills', 'wasteland', 'swamp'],
  spawningGrounds: ['wasteland', 'swamp', 'desert'],
  crystalMine: ['hills', 'plains', 'wasteland', 'forest', 'desert'],
  magicalGlade: ['forest', 'plains'],
}

const MINE_COLORS: ManaColor[] = ['red', 'blue', 'green', 'white']

function createSiteState(site: SiteType, random: SeededRandom): SiteState {
  const state: SiteState = {
    type: site,
    isConquered: false,
    enemyTokenIds: [],
    shieldTokens: 0,
  }

  if (site === 'crystalMine') {
    state.mineColor = random.pick(MINE_COLORS)
  }

  return state
}

export class MapGenerator {
  private random: SeededRandom

  constructor(random: SeededRandom) {
    this.random = random
  }

  generateTileHexes(
    tileId: string,
    tileType: 'starting' | 'countryside' | 'core',
    tileCenter: HexCoord,
    cityColor?: CityColor,
  ): HexCell[] {
    const positions = getTileHexes(tileCenter)

    if (tileType === 'starting') {
      return this.generateStartingHexes(tileId, positions)
    }
    if (tileType === 'core') {
      return this.generateCoreHexes(tileId, positions, cityColor)
    }
    return this.generateCountrysideHexes(tileId, positions)
  }

  generateStartingTile(side: 'A' | 'B'): MapTile {
    const position: HexCoord = { q: 0, r: 0 }
    const tileId = `starting_${side}`
    const hexes = this.generateTileHexes(tileId, 'starting', position)

    return {
      id: tileId,
      type: 'starting',
      side,
      hasCity: false,
      hexes,
      position,
      isRevealed: true,
    }
  }

  generateMap(config: MapConfig): MapState {
    const startingTile = this.generateStartingTile(config.startingSide)

    const tileDeck = this.buildTileDeck(
      config.countrysideTileCount,
      config.coreTileCount,
      config.coreCityCount,
    )

    const hexGrid = new Map<string, HexCell>()
    for (const hex of startingTile.hexes) {
      hexGrid.set(hexKey(hex.coord), hex)
    }

    let mapState: MapState = {
      tiles: [startingTile],
      tileDeck,
      hexGrid,
    }

    // Wedge (역삼각형) positions: A=NW+NE, B=NW+NE+E
    const wedgePositions: HexCoord[] =
      config.startingSide === 'A'
        ? [
            { q: -2, r: -1 }, // NW of starting tile
            { q: 1, r: -3 },  // NE of starting tile
          ]
        : [
            { q: -2, r: -1 }, // NW of starting tile
            { q: 1, r: -3 },  // NE of starting tile
            { q: 3, r: -2 },  // E of starting tile (adjacent to NE tile)
          ]

    for (const position of wedgePositions) {
      mapState = this.revealTile(mapState, position)
    }

    return mapState
  }

  revealTile(mapState: MapState, position: HexCoord): MapState {
    if (mapState.tileDeck.length === 0) return mapState

    const [tileId, ...remainingDeck] = mapState.tileDeck
    const tileType = tileId.startsWith('core') ? 'core' : 'countryside'
    const cityColor = this.extractCityColor(tileId)
    const hasCity = cityColor !== undefined

    const hexes = this.generateTileHexes(tileId, tileType, position, cityColor)

    const newTile: MapTile = {
      id: tileId,
      type: tileType,
      hasCity,
      cityColor,
      hexes,
      position,
      isRevealed: true,
    }

    const newHexGrid = new Map(mapState.hexGrid)
    for (const hex of hexes) {
      newHexGrid.set(hexKey(hex.coord), hex)
    }

    return {
      tiles: [...mapState.tiles, newTile],
      tileDeck: remainingDeck,
      hexGrid: newHexGrid,
    }
  }

  getValidTilePlacements(mapState: MapState): HexCoord[] {
    const occupiedHexes = new Set<string>()
    const seaHexKeys = new Set<string>()
    for (const hex of mapState.hexGrid.values()) {
      occupiedHexes.add(hexKey(hex.coord))
      if (hex.terrain === 'sea') {
        seaHexKeys.add(hexKey(hex.coord))
      }
    }

    const candidateSet = new Set<string>()

    for (const occupiedKey of occupiedHexes) {
      const occupiedCoord = parseHexKeyLocal(occupiedKey)
      for (const neighbor of hexNeighbors(occupiedCoord)) {
        if (!occupiedHexes.has(hexKey(neighbor))) {
          for (let dq = -1; dq <= 1; dq++) {
            for (let dr = -1; dr <= 1; dr++) {
              const candidate: HexCoord = { q: neighbor.q + dq, r: neighbor.r + dr }
              candidateSet.add(hexKey(candidate))
            }
          }
        }
      }
    }

    const validPlacements: HexCoord[] = []

    for (const candidateKey of candidateSet) {
      const candidate = parseHexKeyLocal(candidateKey)
      const candidateHexes = getTileHexes(candidate)

      const overlaps = candidateHexes.some((h) => occupiedHexes.has(hexKey(h)))
      if (overlaps) continue

      const isAdjacent = candidateHexes.some((h) =>
        hexNeighbors(h).some((n) => occupiedHexes.has(hexKey(n))),
      )
      if (!isAdjacent) continue

      const touchesSea = candidateHexes.some((h) =>
        hexNeighbors(h).some((n) => seaHexKeys.has(hexKey(n))),
      )
      if (touchesSea) continue

      validPlacements.push(candidate)
    }

    return validPlacements
  }

  getHexAt(mapState: MapState, coord: HexCoord): HexCell | undefined {
    return mapState.hexGrid.get(hexKey(coord))
  }

  private generateStartingHexes(tileId: string, positions: HexCoord[]): HexCell[] {
    // positions order from getTileHexes: [center, E, NE, NW, W, SW, SE]
    // Indices 1(E), 5(SW), 6(SE) are the southern coastline hexes (sea)
    // Indices 2(NE), 3(NW), 4(W) are walkable terrain
    const SEA_INDICES = new Set([1, 5, 6])

    const walkableTerrains: TerrainType[] = ['plains', 'forest', 'hills']
    const shuffled = this.random.shuffle(walkableTerrains)

    return positions.map((coord, i): HexCell => {
      if (i === 0) {
        return {
          coord,
          terrain: 'plains',
          site: 'portal',
          siteData: createSiteState('portal', this.random),
          enemyTokens: [],
          tileId,
          isRevealed: true,
        }
      }
      if (SEA_INDICES.has(i)) {
        return {
          coord,
          terrain: 'sea',
          enemyTokens: [],
          tileId,
          isRevealed: true,
        }
      }
      // Keep one nearby village on the starting tile so First Reconnaissance
      // always has an immediate, non-combat interaction target for new players.
      // This prevents early turns from becoming pure movement with no visible
      // reward loop while the rest of the countryside remains variable.
      if (i === 2) {
        return {
          coord,
          terrain: 'plains',
          site: 'village',
          siteData: createSiteState('village', this.random),
          enemyTokens: [],
          tileId,
          isRevealed: true,
        }
      }

      if (i === 3) {
        return {
          coord,
          terrain: 'plains',
          site: 'monsterDen',
          siteData: createSiteState('monsterDen', this.random),
          enemyTokens: [],
          tileId,
          isRevealed: true,
        }
      }

      // Walkable terrain indices: 2(NE), 3(NW), 4(W) → mapped to shuffled[0,1,2]
      const terrainIndex = i - 2 // i=2→0, i=3→1, i=4→2
      return {
        coord,
        terrain: shuffled[terrainIndex],
        enemyTokens: [],
        tileId,
        isRevealed: true,
      }
    })
  }

  private generateCountrysideHexes(tileId: string, positions: HexCoord[]): HexCell[] {
    const terrainPool = [...COUNTRYSIDE_TERRAINS]
    const terrains = this.pickTerrains(terrainPool, 7)

    const impassableIndex = this.random.nextInt(1, 6)
    const impassableTerrain: TerrainType = this.random.pick(['lake', 'mountain'])
    terrains[impassableIndex] = impassableTerrain

    const siteCount = this.random.nextInt(1, 3)
    const siteIndices = this.pickSiteIndices(terrains, siteCount, impassableIndex)
    const sites = this.pickSites(COUNTRYSIDE_SITES, siteCount)

    return this.buildHexCells(tileId, positions, terrains, siteIndices, sites)
  }

  private generateCoreHexes(
    tileId: string,
    positions: HexCoord[],
    cityColor?: CityColor,
  ): HexCell[] {
    const terrainPool = [...CORE_TERRAINS]
    const terrains = this.pickTerrains(terrainPool, 7)

    if (cityColor) {
      terrains[0] = 'city'
    }

    const impassableIndex = cityColor ? this.random.nextInt(1, 6) : this.random.nextInt(1, 6)
    if (!cityColor || impassableIndex !== 0) {
      terrains[impassableIndex] = this.random.pick(['lake', 'mountain'] as TerrainType[])
    }

    const siteCount = this.random.nextInt(1, 2)
    const reservedIndices = new Set<number>([impassableIndex])
    if (cityColor) reservedIndices.add(0)
    const siteIndices = this.pickSiteIndicesWithReserved(terrains, siteCount, reservedIndices)
    const sites = this.pickSites(CORE_SITES, siteCount)

    const hexCells = this.buildHexCells(tileId, positions, terrains, siteIndices, sites)

    if (cityColor) {
      const centerHex = hexCells[0]
      hexCells[0] = {
        ...centerHex,
        site: 'city',
        siteData: {
          type: 'city',
          isConquered: false,
          enemyTokenIds: [],
          shieldTokens: this.getCityShieldTokens(cityColor),
          cityColor,
        },
      }
    }

    return hexCells
  }

  private pickTerrains(pool: TerrainType[], count: number): TerrainType[] {
    const terrains: TerrainType[] = []
    for (let i = 0; i < count; i++) {
      terrains.push(this.random.pick(pool))
    }
    return terrains
  }

  private pickSiteIndices(
    terrains: TerrainType[],
    count: number,
    impassableIndex: number,
  ): number[] {
    const reserved = new Set([impassableIndex])
    return this.pickSiteIndicesWithReserved(terrains, count, reserved)
  }

  private pickSiteIndicesWithReserved(
    _terrains: TerrainType[],
    count: number,
    reserved: Set<number>,
  ): number[] {
    const available = Array.from({ length: 7 }, (_, i) => i)
      .filter((i) => !reserved.has(i))
    const shuffled = this.random.shuffle(available)
    return shuffled.slice(0, count)
  }

  private pickSites(sitePool: SiteType[], count: number): SiteType[] {
    const sites: SiteType[] = []
    const available = [...sitePool]
    for (let i = 0; i < count; i++) {
      const idx = this.random.nextInt(0, available.length - 1)
      sites.push(available[idx])
    }
    return sites
  }

  private buildHexCells(
    tileId: string,
    positions: HexCoord[],
    terrains: TerrainType[],
    siteIndices: number[],
    sites: SiteType[],
  ): HexCell[] {
    return positions.map((coord, i): HexCell => {
      const siteIdx = siteIndices.indexOf(i)
      const hasSite = siteIdx !== -1

      if (hasSite) {
        const site = sites[siteIdx]
        const affinity = SITE_TERRAIN_AFFINITY[site]
        if (affinity && !['lake', 'mountain', 'sea', 'city'].includes(terrains[i])) {
          terrains[i] = this.random.pick(affinity)
        }
      }

      const cell: HexCell = {
        coord,
        terrain: terrains[i],
        enemyTokens: [],
        tileId,
        isRevealed: true,
      }

      if (hasSite) {
        const site = sites[siteIdx]
        cell.site = site
        cell.siteData = createSiteState(site, this.random)
      }

      return cell
    })
  }

  private buildTileDeck(
    countrysideCount: number,
    coreCount: number,
    coreCityCount: number,
  ): string[] {
    const cityColors: CityColor[] = ['green', 'blue', 'white', 'red']
    const cityTiles: string[] = []
    for (let i = 0; i < Math.min(coreCityCount, cityColors.length); i++) {
      cityTiles.push(`core_city_${cityColors[i]}`)
    }

    const nonCityCore: string[] = []
    for (let i = 0; i < coreCount - coreCityCount; i++) {
      nonCityCore.push(`core_${i + 1}`)
    }

    const coreDeck = this.random.shuffle([...cityTiles, ...nonCityCore])

    const countrysideDeck: string[] = []
    for (let i = 0; i < countrysideCount; i++) {
      countrysideDeck.push(`countryside_${i + 1}`)
    }
    const shuffledCountryside = this.random.shuffle(countrysideDeck)

    return [...shuffledCountryside, ...coreDeck]
  }

  private extractCityColor(tileId: string): CityColor | undefined {
    const match = tileId.match(/^core_city_(.+)$/)
    if (!match) return undefined
    return match[1] as CityColor
  }

  private getCityShieldTokens(color: CityColor): number {
    const shields: Record<CityColor, number> = {
      green: 2,
      blue: 3,
      white: 3,
      red: 4,
    }
    return shields[color]
  }
}

function parseHexKeyLocal(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}
