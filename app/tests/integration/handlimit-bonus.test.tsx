import { describe, it, expect } from 'vitest'
import { keepCityHandLimitBonus } from '@/hooks/useGameEngine'
import { createHarness } from './card-play-harness'
import type { GameState, HexCoord } from '@/engine/types'

function withSites(pos: HexCoord, sites: GameState['player']['conqueredSites']) {
  return (s: GameState): GameState => ({
    ...s,
    player: { ...s.player, position: pos, conqueredSites: sites },
  })
}

describe('Keep/City hand-limit bonus (rulebook p.9)', () => {
  it('no owned keeps/cities → no bonus', () => {
    const h = createHarness()
    h.setState(withSites({ q: 0, r: 0 }, []))
    expect(keepCityHandLimitBonus(h.state())).toBe(0)
  })

  it('standing ON your keep → +1 (one keep owned)', () => {
    const h = createHarness()
    h.setState(withSites({ q: 0, r: 0 }, [{ siteType: 'keep', tileId: 't', hexCoord: { q: 0, r: 0 }, shieldTokens: 0 }]))
    expect(keepCityHandLimitBonus(h.state())).toBe(1)
  })

  it('ADJACENT to your keep, owning 2 keeps → +2', () => {
    const h = createHarness()
    h.setState(withSites({ q: 0, r: 0 }, [
      { siteType: 'keep', tileId: 't', hexCoord: { q: 1, r: 0 }, shieldTokens: 0 }, // adjacent
      { siteType: 'keep', tileId: 't2', hexCoord: { q: 5, r: 5 }, shieldTokens: 0 }, // far
    ]))
    expect(keepCityHandLimitBonus(h.state())).toBe(2) // adjacent to one → +count(2)
  })

  it('far from all your keeps → no bonus', () => {
    const h = createHarness()
    h.setState(withSites({ q: 0, r: 0 }, [{ siteType: 'keep', tileId: 't', hexCoord: { q: 9, r: 9 }, shieldTokens: 0 }]))
    expect(keepCityHandLimitBonus(h.state())).toBe(0)
  })

  it('on/next to a conquered city → +2', () => {
    const h = createHarness()
    h.setState(withSites({ q: 0, r: 0 }, [{ siteType: 'city', tileId: 't', hexCoord: { q: 0, r: 1 }, shieldTokens: 1 }]))
    expect(keepCityHandLimitBonus(h.state())).toBe(2)
  })
})

import { hexKey } from '@/engine/GameState'
import type { TerrainType } from '@/engine/types'

function setTerrainAndLore(terrain: TerrainType, lore: 'basic' | 'strong') {
  return (s: GameState): GameState => {
    const key = hexKey(s.player.position)
    const grid = new Map(s.map.hexGrid)
    const hex = grid.get(key)
    if (hex) grid.set(key, { ...hex, terrain })
    return { ...s, map: { ...s.map, hexGrid: grid }, player: { ...s.player, conqueredSites: [], turn: { ...s.player.turn, mountainLore: lore } } }
  }
}

describe('Mountain Lore hand-limit bonus', () => {
  it('basic: +1 when ending in hills', () => {
    const h = createHarness()
    h.setState(setTerrainAndLore('hills', 'basic'))
    expect(keepCityHandLimitBonus(h.state())).toBe(1)
  })
  it('basic: no bonus when not in hills', () => {
    const h = createHarness()
    h.setState(setTerrainAndLore('plains', 'basic'))
    expect(keepCityHandLimitBonus(h.state())).toBe(0)
  })
  it('strong: +2 when ending in mountains', () => {
    const h = createHarness()
    h.setState(setTerrainAndLore('mountain', 'strong'))
    expect(keepCityHandLimitBonus(h.state())).toBe(2)
  })
})
