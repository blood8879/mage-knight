import { describe, it, expect } from 'vitest'
import { UnitManager } from '@/engine/UnitManager'
import type { UnitInstance, RegularUnit } from '@/engine/types'

function makeUnit(overrides: Partial<RegularUnit> = {}): RegularUnit {
  return {
    id: 1,
    name: 'Peasants',
    type: 'infantry',
    tier: 'regular',
    level: 1,
    cost: 3,
    armor: 1,
    recruitSites: ['village'],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base',
    ...overrides,
  }
}

describe('Walkthrough: Units (Phase 6)', () => {
  const mgr = new UnitManager()

  describe('recruitment', () => {
    it('recruiting a unit adds it to units array with ready status', () => {
      const units: UnitInstance[] = []
      const result = mgr.recruitUnit(units, makeUnit(), 3)
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('ready')
      expect(result[0].woundCount).toBe(0)
    })

    it('cannot recruit beyond unit limit', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'ready', woundCount: 0 },
      ]
      expect(() => mgr.recruitUnit(units, makeUnit(), 1)).toThrow(
        'Unit limit reached',
      )
    })
  })

  describe('activation', () => {
    it('activating a unit sets status to spent', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'ready', woundCount: 0 },
      ]
      const result = mgr.activateUnit(units, 0)
      expect(result[0].status).toBe('spent')
    })

    it('cannot activate a wounded unit', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'wounded', woundCount: 1 },
      ]
      expect(() => mgr.activateUnit(units, 0)).toThrow()
    })
  })

  describe('wounding and healing', () => {
    it('wounding sets status to wounded, poison causes 2 wound count', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'ready', woundCount: 0 },
      ]
      const normal = mgr.woundUnit(units, 0, false)
      expect(normal[0].woundCount).toBe(1)
      expect(normal[0].status).toBe('wounded')

      const poisoned = mgr.woundUnit(units, 0, true)
      expect(poisoned[0].woundCount).toBe(2)
    })

    it('healing restores unit to ready with 0 wounds', () => {
      const units: UnitInstance[] = [
        { unit: makeUnit(), status: 'wounded', woundCount: 1 },
      ]
      const result = mgr.healUnit(units, 0)
      expect(result[0].woundCount).toBe(0)
      expect(result[0].status).toBe('ready')
    })
  })
})
