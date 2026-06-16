/**
 * Rules verification for combat damage assignment to Units.
 *
 * Rulebook (Assign Damage Phase): a Unit may be assigned damage only while
 * Unwounded; it then takes exactly ONE Wound and absorbs damage equal to its
 * Armor. A Unit resistant to the attack element absorbs up to twice its Armor
 * and is Wounded only if the damage exceeds its Armor. Excess damage cannot be
 * dumped onto a single Unit — it must spill to the Hero or other Units.
 *
 * Bug being guarded against: a single Unit could previously absorb the entire
 * attack value and accumulate multiple Wounds.
 */
import { describe, it, expect } from 'vitest'
import { isUnitEligible, isUnitResistant, unitAbsorption } from '@/utils/damageAssignUtils'
import { attackTypeToElement } from '@/engine/CombatResolver'
import type { UnitInstance, AnyUnit } from '@/engine/types'

function makeUnit(over: Partial<AnyUnit> = {}, inst: Partial<UnitInstance> = {}): UnitInstance {
  const unit: AnyUnit = {
    id: 1,
    name: 'Test Unit',
    type: 'unit',
    tier: 'regular',
    level: 1,
    cost: 4,
    armor: 4,
    recruitSites: [],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base',
    ...over,
  } as AnyUnit
  return { unit, status: 'ready', woundCount: 0, ...inst }
}

describe('attackTypeToElement', () => {
  it('maps enemy attack types to damage elements', () => {
    expect(attackTypeToElement('normal')).toBe('physical')
    expect(attackTypeToElement('fire')).toBe('fire')
    expect(attackTypeToElement('ice')).toBe('ice')
    expect(attackTypeToElement('cold_fire')).toBe('cold_fire')
    expect(attackTypeToElement('summon')).toBe('physical')
  })
})

describe('isUnitEligible', () => {
  it('excludes wounded units', () => {
    expect(isUnitEligible(makeUnit())).toBe(true)
    expect(isUnitEligible(makeUnit({}, { woundCount: 1, status: 'wounded' }))).toBe(false)
  })
  it('allows unwounded spent units', () => {
    expect(isUnitEligible(makeUnit({}, { status: 'spent' }))).toBe(true)
  })
})

describe('unitAbsorption — non-resistant unit', () => {
  const unit = makeUnit({ armor: 4 })

  it('absorbs only up to its Armor and takes exactly one wound', () => {
    // 7 incoming, armor 4 → soaks 4, 1 wound, 3 spills over
    expect(unitAbsorption(unit, 'physical', 7, false)).toEqual({ absorbed: 4, wounds: 1 })
  })

  it('cannot soak the whole attack when it exceeds Armor', () => {
    const { absorbed } = unitAbsorption(unit, 'physical', 10, false)
    expect(absorbed).toBe(4)
    expect(absorbed).toBeLessThan(10)
  })

  it('still takes a single wound when damage is below Armor', () => {
    expect(unitAbsorption(unit, 'physical', 2, false)).toEqual({ absorbed: 2, wounds: 1 })
  })

  it('inflicts two wound cards under Poison', () => {
    expect(unitAbsorption(unit, 'physical', 4, true)).toEqual({ absorbed: 4, wounds: 2 })
  })
})

describe('unitAbsorption — resistant unit', () => {
  const fireResist = makeUnit({ armor: 3, resistance: 'fire' })

  it('detects resistance to the matching element', () => {
    expect(isUnitResistant(fireResist, 'fire')).toBe(true)
    expect(isUnitResistant(fireResist, 'ice')).toBe(false)
  })

  it('absorbs up to twice Armor and wounds only if damage exceeds Armor', () => {
    // armor 3, resistant: capacity 6. 5 damage → soak 5, wounded (5 > 3)
    expect(unitAbsorption(fireResist, 'fire', 5, false)).toEqual({ absorbed: 5, wounds: 1 })
    // 3 damage → soak 3 with NO wound (within armor)
    expect(unitAbsorption(fireResist, 'fire', 3, false)).toEqual({ absorbed: 3, wounds: 0 })
    // 8 damage → capped at 6, wounded
    expect(unitAbsorption(fireResist, 'fire', 8, false)).toEqual({ absorbed: 6, wounds: 1 })
  })

  it('only resists Cold Fire when resistant to both Fire and Ice', () => {
    const both = makeUnit({ armor: 3, resistance: 'fire_ice' })
    expect(isUnitResistant(both, 'cold_fire')).toBe(true)
    expect(isUnitResistant(fireResist, 'cold_fire')).toBe(false)
  })
})
