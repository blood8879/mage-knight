// ═══════════════════════════════════════════
// Unit Activation Tests — 2026-06-15
// Recruited units can be activated outside combat
// for their Move / Influence / Heal abilities.
//  - UnitManager marks a ready unit spent on activation
//  - spent / wounded units are not activatable
//  - Peasants data exposes Move 2 / Influence 2 / Attack|Block 2
// ═══════════════════════════════════════════

import { describe, test, expect } from 'vitest'
import { UnitManager } from '@/engine/UnitManager'
import unitsRegular from '../../data/units_regular.json'
import type { AnyUnit, UnitInstance } from '@/engine/types'

function loadUnits(): AnyUnit[] {
  const raw = unitsRegular as unknown
  if (Array.isArray(raw)) return raw as AnyUnit[]
  return Object.values(raw as Record<string, unknown>).find(Array.isArray) as AnyUnit[]
}

function makeInstance(unit: AnyUnit, status: UnitInstance['status'] = 'ready', woundCount = 0): UnitInstance {
  return { unit, status, woundCount }
}

describe('Unit activation outside combat', () => {
  const mgr = new UnitManager()
  const peasants = loadUnits().find((u) => u.name === 'Peasants')!

  test('Peasants exposes Move / Influence / Attack|Block abilities', () => {
    expect(peasants).toBeTruthy()
    const flat = peasants.abilities.flatMap((a) => a.actions)
    const move = flat.find((a) => a.type === 'move')
    const influence = flat.find((a) => a.type === 'influence')
    expect(move?.value).toBe(2)
    expect(influence?.value).toBe(2)
    expect(flat.some((a) => a.type === 'attack')).toBe(true)
    expect(flat.some((a) => a.type === 'block')).toBe(true)
  })

  test('a ready unit becomes spent after activation', () => {
    const units = [makeInstance(peasants, 'ready')]
    expect(mgr.isUnitActivatable(units[0])).toBe(true)
    const next = mgr.activateUnit(units, 0)
    expect(next[0].status).toBe('spent')
    // original array is not mutated
    expect(units[0].status).toBe('ready')
  })

  test('spent and wounded units are not activatable', () => {
    expect(mgr.isUnitActivatable(makeInstance(peasants, 'spent'))).toBe(false)
    expect(mgr.isUnitActivatable(makeInstance(peasants, 'wounded', 1))).toBe(false)
    expect(() => mgr.activateUnit([makeInstance(peasants, 'spent')], 0)).toThrow()
  })

  test('round start readies a spent unit again', () => {
    const units = [makeInstance(peasants, 'spent')]
    const readied = mgr.readyAllUnits(units)
    expect(readied[0].status).toBe('ready')
    expect(mgr.isUnitActivatable(readied[0])).toBe(true)
  })
})
