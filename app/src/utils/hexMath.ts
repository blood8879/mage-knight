import type { HexCoord } from '@/engine/types'

const AXIAL_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((d) => ({
    q: coord.q + d.q,
    r: coord.r + d.r,
  }))
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr))
}

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`
}

export function parseHexKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export function hexesEqual(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r
}

export function tileHexOffsets(): HexCoord[] {
  return [
    { q: 0, r: 0 },
    ...AXIAL_DIRECTIONS,
  ]
}

export function getTileHexes(tileCenter: HexCoord): HexCoord[] {
  return tileHexOffsets().map((offset) => ({
    q: tileCenter.q + offset.q,
    r: tileCenter.r + offset.r,
  }))
}
