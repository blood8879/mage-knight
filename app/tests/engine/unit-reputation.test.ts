import { describe, it, expect, beforeEach } from 'vitest'
import { UnitManager } from '@/engine/UnitManager'
import { ReputationManager } from '@/engine/ReputationManager'
import type { UnitInstance, AnyUnit, RegularUnit, EliteUnit } from '@/engine/types'

function makeUnit(id: number, name: string, level: number = 1, tier: 'regular' | 'elite' = 'regular'): AnyUnit {
  return {
    id,
    name,
    type: 'infantry',
    tier,
    level,
    cost: level + 2,
    armor: 3,
    recruitSites: ['village'],
    abilities: [],
    resistance: null,
    copies: 1,
    set: 'base',
  } as AnyUnit
}

function makeRegularUnit(id: number, name: string): RegularUnit {
  return makeUnit(id, name, 1, 'regular') as RegularUnit
}

function makeEliteUnit(id: number, name: string): EliteUnit {
  return makeUnit(id, name, 3, 'elite') as EliteUnit
}

function makeInstance(id: number, name: string, level: number = 1): UnitInstance {
  return {
    unit: makeUnit(id, name, level),
    status: 'ready',
    woundCount: 0,
  }
}

describe('UnitManager', () => {
  let um: UnitManager

  beforeEach(() => {
    um = new UnitManager()
  })

  describe('recruitUnit', () => {
    it('adds a new unit as ready with zero wounds', () => {
      const units: UnitInstance[] = []
      const unit = makeUnit(1, 'Peasants')
      const result = um.recruitUnit(units, unit, 3)

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('ready')
      expect(result[0].woundCount).toBe(0)
      expect(result[0].unit.name).toBe('Peasants')
    })

    it('throws when at unit limit', () => {
      const units = [makeInstance(1, 'A'), makeInstance(2, 'B')]
      const unit = makeUnit(3, 'C')

      expect(() => um.recruitUnit(units, unit, 2)).toThrow('Unit limit reached')
    })

    it('does not mutate the original array', () => {
      const units = [makeInstance(1, 'A')]
      const unit = makeUnit(2, 'B')
      const result = um.recruitUnit(units, unit, 3)

      expect(units).toHaveLength(1)
      expect(result).toHaveLength(2)
      expect(result).not.toBe(units)
    })
  })

  describe('disbandUnit', () => {
    it('removes unit at the given index', () => {
      const units = [makeInstance(1, 'A'), makeInstance(2, 'B'), makeInstance(3, 'C')]
      const result = um.disbandUnit(units, 1)

      expect(result).toHaveLength(2)
      expect(result[0].unit.name).toBe('A')
      expect(result[1].unit.name).toBe('C')
    })

    it('returns a new array for invalid index', () => {
      const units = [makeInstance(1, 'A')]
      const result = um.disbandUnit(units, 5)

      expect(result).toHaveLength(1)
      expect(result).not.toBe(units)
    })
  })

  describe('activateUnit', () => {
    it('sets a ready unit to spent', () => {
      const units = [makeInstance(1, 'A')]
      const result = um.activateUnit(units, 0)

      expect(result[0].status).toBe('spent')
    })

    it('throws for a wounded unit', () => {
      const units: UnitInstance[] = [{ ...makeInstance(1, 'A'), status: 'wounded', woundCount: 1 }]

      expect(() => um.activateUnit(units, 0)).toThrow('Unit cannot be activated')
    })

    it('throws for an already spent unit', () => {
      const units: UnitInstance[] = [{ ...makeInstance(1, 'A'), status: 'spent' }]

      expect(() => um.activateUnit(units, 0)).toThrow('Unit cannot be activated')
    })
  })

  describe('woundUnit', () => {
    it('wounds a unit with woundCount=1 for normal damage', () => {
      const units = [makeInstance(1, 'A')]
      const result = um.woundUnit(units, 0, false)

      expect(result[0].status).toBe('wounded')
      expect(result[0].woundCount).toBe(1)
    })

    it('wounds a unit with woundCount=2 for poison damage', () => {
      const units = [makeInstance(1, 'A')]
      const result = um.woundUnit(units, 0, true)

      expect(result[0].status).toBe('wounded')
      expect(result[0].woundCount).toBe(2)
    })

    it('throws if unit is already wounded', () => {
      const units: UnitInstance[] = [{ ...makeInstance(1, 'A'), status: 'wounded', woundCount: 1 }]

      expect(() => um.woundUnit(units, 0, false)).toThrow('already wounded')
    })
  })

  describe('healUnit', () => {
    it('removes wounds and sets status to ready', () => {
      const units: UnitInstance[] = [{ ...makeInstance(1, 'A'), status: 'wounded', woundCount: 2 }]
      const result = um.healUnit(units, 0)

      expect(result[0].woundCount).toBe(0)
      expect(result[0].status).toBe('ready')
    })

    it('returns a new array for an already healthy unit', () => {
      const units = [makeInstance(1, 'A')]
      const result = um.healUnit(units, 0)

      expect(result).toHaveLength(1)
      expect(result).not.toBe(units)
    })
  })

  describe('destroyUnit', () => {
    it('removes unit from the array (paralyze effect)', () => {
      const units = [makeInstance(1, 'A'), makeInstance(2, 'B')]
      const result = um.destroyUnit(units, 0)

      expect(result).toHaveLength(1)
      expect(result[0].unit.name).toBe('B')
    })
  })

  describe('readyAllUnits', () => {
    it('sets spent units to ready at round start', () => {
      const units: UnitInstance[] = [
        { ...makeInstance(1, 'A'), status: 'spent' },
        { ...makeInstance(2, 'B'), status: 'ready' },
      ]
      const result = um.readyAllUnits(units)

      expect(result[0].status).toBe('ready')
      expect(result[1].status).toBe('ready')
    })

    it('keeps wounded units with woundCount > 0 but sets status to ready', () => {
      const units: UnitInstance[] = [
        { ...makeInstance(1, 'A'), status: 'wounded', woundCount: 1 },
        { ...makeInstance(2, 'B'), status: 'spent' },
      ]
      const result = um.readyAllUnits(units)

      expect(result[0].status).toBe('ready')
      expect(result[0].woundCount).toBe(1)
      expect(result[1].status).toBe('ready')
    })
  })

  describe('isUnitActivatable', () => {
    it('returns true for ready unwounded unit', () => {
      const unit = makeInstance(1, 'A')
      expect(um.isUnitActivatable(unit)).toBe(true)
    })

    it('returns false for wounded unit', () => {
      const unit: UnitInstance = { ...makeInstance(1, 'A'), status: 'wounded', woundCount: 1 }
      expect(um.isUnitActivatable(unit)).toBe(false)
    })

    it('returns false for spent unit', () => {
      const unit: UnitInstance = { ...makeInstance(1, 'A'), status: 'spent' }
      expect(um.isUnitActivatable(unit)).toBe(false)
    })
  })

  describe('getAvailableUnits', () => {
    it('filters to only activatable units', () => {
      const units: UnitInstance[] = [
        makeInstance(1, 'Ready'),
        { ...makeInstance(2, 'Spent'), status: 'spent' },
        { ...makeInstance(3, 'Wounded'), status: 'wounded', woundCount: 1 },
        makeInstance(4, 'AlsoReady'),
      ]
      const result = um.getAvailableUnits(units)

      expect(result).toHaveLength(2)
      expect(result[0].unit.name).toBe('Ready')
      expect(result[1].unit.name).toBe('AlsoReady')
    })
  })

  describe('getHealingCost', () => {
    it('calculates cost as level * woundCount for normal wound', () => {
      const unit: UnitInstance = { ...makeInstance(1, 'A', 2), status: 'wounded', woundCount: 1 }
      expect(um.getHealingCost(unit)).toBe(2)
    })

    it('calculates double cost for poison double-wound', () => {
      const unit: UnitInstance = { ...makeInstance(1, 'A', 3), status: 'wounded', woundCount: 2 }
      expect(um.getHealingCost(unit)).toBe(6)
    })

    it('returns 0 for healthy unit', () => {
      const unit = makeInstance(1, 'A', 2)
      expect(um.getHealingCost(unit)).toBe(0)
    })
  })

  describe('canRecruit', () => {
    it('returns true when below unit limit', () => {
      const units = [makeInstance(1, 'A')]
      expect(um.canRecruit(units, 3)).toBe(true)
    })

    it('returns false when at unit limit', () => {
      const units = [makeInstance(1, 'A'), makeInstance(2, 'B')]
      expect(um.canRecruit(units, 2)).toBe(false)
    })
  })

  describe('refreshUnitOffer', () => {
    it('fills only regular units before core tiles are revealed', () => {
      const regulars = [makeRegularUnit(1, 'R1'), makeRegularUnit(2, 'R2'), makeRegularUnit(3, 'R3')]
      const elites = [makeEliteUnit(10, 'E1')]

      const result = um.refreshUnitOffer(regulars, elites, 3, false)

      expect(result.offer).toHaveLength(3)
      expect(result.offer.every((u) => u.tier === 'regular')).toBe(true)
      expect(result.remainingRegular).toHaveLength(0)
      expect(result.remainingElite).toHaveLength(1)
    })

    it('alternates regular/elite after core is revealed', () => {
      const regulars = [makeRegularUnit(1, 'R1'), makeRegularUnit(2, 'R2'), makeRegularUnit(3, 'R3')]
      const elites = [makeEliteUnit(10, 'E1'), makeEliteUnit(11, 'E2')]

      const result = um.refreshUnitOffer(regulars, elites, 4, true)

      expect(result.offer).toHaveLength(4)
      expect(result.offer[0].tier).toBe('regular')
      expect(result.offer[1].tier).toBe('elite')
      expect(result.offer[2].tier).toBe('regular')
      expect(result.offer[3].tier).toBe('elite')
    })

    it('does not mutate input decks', () => {
      const regulars = [makeRegularUnit(1, 'R1'), makeRegularUnit(2, 'R2')]
      const elites = [makeEliteUnit(10, 'E1')]
      const originalRegularLength = regulars.length
      const originalEliteLength = elites.length

      um.refreshUnitOffer(regulars, elites, 3, true)

      expect(regulars).toHaveLength(originalRegularLength)
      expect(elites).toHaveLength(originalEliteLength)
    })
  })

  describe('immutability', () => {
    it('does not mutate the original array on activateUnit', () => {
      const units = [makeInstance(1, 'A')]
      const original = units[0].status

      um.activateUnit(units, 0)

      expect(units[0].status).toBe(original)
    })

    it('does not mutate the original array on woundUnit', () => {
      const units = [makeInstance(1, 'A')]
      const originalWoundCount = units[0].woundCount

      um.woundUnit(units, 0, false)

      expect(units[0].woundCount).toBe(originalWoundCount)
    })
  })
})

describe('ReputationManager', () => {
  let rm: ReputationManager

  beforeEach(() => {
    rm = new ReputationManager()
  })

  describe('getInfluenceModifier', () => {
    it('returns correct modifier for positive reputation', () => {
      expect(rm.getInfluenceModifier(3)).toBe(2)
      expect(rm.getInfluenceModifier(5)).toBe(5)
    })

    it('returns correct modifier for negative reputation', () => {
      expect(rm.getInfluenceModifier(-3)).toBe(-3)
      expect(rm.getInfluenceModifier(-4)).toBe(-5)
    })

    it('returns 0 for neutral reputation', () => {
      expect(rm.getInfluenceModifier(0)).toBe(0)
      expect(rm.getInfluenceModifier(1)).toBe(0)
    })

    it('clamps to valid range', () => {
      expect(rm.getInfluenceModifier(99)).toBe(5)
      expect(rm.getInfluenceModifier(-99)).toBe(0)
    })
  })

  describe('canInteract', () => {
    it('returns true for moderate reputation', () => {
      expect(rm.canInteract(0)).toBe(true)
      expect(rm.canInteract(3)).toBe(true)
      expect(rm.canInteract(-4)).toBe(true)
    })

    it('returns false at extreme negative reputation', () => {
      expect(rm.canInteract(-5)).toBe(false)
      expect(rm.canInteract(-6)).toBe(false)
      expect(rm.canInteract(-7)).toBe(false)
    })

    it('returns false for out-of-range negative (clamped to -7)', () => {
      expect(rm.canInteract(-10)).toBe(false)
    })
  })

  describe('changeReputation', () => {
    it('adds delta to current reputation', () => {
      expect(rm.changeReputation(0, 3)).toBe(3)
      expect(rm.changeReputation(2, -4)).toBe(-2)
    })

    it('clamps to maximum +7', () => {
      expect(rm.changeReputation(5, 10)).toBe(7)
    })

    it('clamps to minimum -7', () => {
      expect(rm.changeReputation(-3, -10)).toBe(-7)
    })
  })

  describe('getInteractionCost', () => {
    it('adds reputation modifier to base influence', () => {
      const result = rm.getInteractionCost(5, 3, 0, false)
      expect(result).toBe(7) // 5 + 2 (rep 3 modifier)
    })

    it('adds shield tokens for cities', () => {
      const result = rm.getInteractionCost(5, 0, 3, false)
      expect(result).toBe(8) // 5 + 0 (rep 0) + 3 shields
    })

    it('adds extra +1 for city leader (deprecated, no longer adds +1 for city leader)', () => {
      const result = rm.getInteractionCost(5, 0, 3, true)
      expect(result).toBe(8) // 5 + 0 + 3 shields (isCityLeader ignored)
    })

    it('handles negative reputation modifier', () => {
      const result = rm.getInteractionCost(10, -3, 0, false)
      expect(result).toBe(7) // 10 + (-3) modifier
    })
  })

  describe('canBuyHealing', () => {
    it('village costs 3 influence per healing', () => {
      const result = rm.canBuyHealing(6, 'village')
      expect(result.canBuy).toBe(true)
      expect(result.costPerHealing).toBe(3)
      expect(result.maxHealing).toBe(2)
    })

    it('monastery costs 2 influence per healing', () => {
      const result = rm.canBuyHealing(5, 'monastery')
      expect(result.canBuy).toBe(true)
      expect(result.costPerHealing).toBe(2)
      expect(result.maxHealing).toBe(2)
    })

    it('returns canBuy false when insufficient influence', () => {
      const result = rm.canBuyHealing(1, 'village')
      expect(result.canBuy).toBe(false)
      expect(result.maxHealing).toBe(0)
    })
  })

  describe('canBuyAdvancedAction', () => {
    it('returns true when influence >= 6', () => {
      expect(rm.canBuyAdvancedAction(6)).toBe(true)
      expect(rm.canBuyAdvancedAction(10)).toBe(true)
    })

    it('returns false when influence < 6', () => {
      expect(rm.canBuyAdvancedAction(5)).toBe(false)
    })
  })

  describe('canBuySpell', () => {
    it('returns true when influence >= 7 and has matching mana', () => {
      expect(rm.canBuySpell(7, true)).toBe(true)
    })

    it('returns false when influence < 7', () => {
      expect(rm.canBuySpell(6, true)).toBe(false)
    })

    it('returns false when no matching mana', () => {
      expect(rm.canBuySpell(10, false)).toBe(false)
    })
  })

  describe('canRecruitAtSite', () => {
    it('village always allows recruitment', () => {
      expect(rm.canRecruitAtSite('village', false)).toEqual(['village'])
    })

    it('monastery always allows recruitment', () => {
      expect(rm.canRecruitAtSite('monastery', false)).toEqual(['monastery'])
    })

    it('keep only when conquered', () => {
      expect(rm.canRecruitAtSite('keep', false)).toBeNull()
      expect(rm.canRecruitAtSite('keep', true)).toEqual(['keep'])
    })

    it('mage tower when conquered allows mage tower recruitment', () => {
      expect(rm.canRecruitAtSite('mageTower', false)).toBeNull()
      expect(rm.canRecruitAtSite('mageTower', true)).toEqual(['mage_tower'])
    })

    it('city when conquered', () => {
      expect(rm.canRecruitAtSite('city', false)).toBeNull()
      expect(rm.canRecruitAtSite('city', true)).toEqual(['city'])
    })

    it('returns null for non-recruitment sites', () => {
      expect(rm.canRecruitAtSite('dungeon', false)).toBeNull()
      expect(rm.canRecruitAtSite('tomb', true)).toBeNull()
    })
  })
})
