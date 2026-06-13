import type {
  UnitInstance,
  AnyUnit,
  RegularUnit,
  EliteUnit,
} from './types'

export class UnitManager {
  recruitUnit(units: UnitInstance[], unit: AnyUnit, unitLimit: number): UnitInstance[] {
    if (units.length >= unitLimit) {
      throw new Error('Unit limit reached. Disband a unit before recruiting.')
    }
    const newUnit: UnitInstance = {
      unit,
      status: 'ready',
      woundCount: 0,
    }
    return [...units, newUnit]
  }

  disbandUnit(units: UnitInstance[], index: number): UnitInstance[] {
    if (index < 0 || index >= units.length) return [...units]
    return units.filter((_, i) => i !== index)
  }

  activateUnit(units: UnitInstance[], index: number): UnitInstance[] {
    if (index < 0 || index >= units.length) return [...units]
    const unit = units[index]
    if (!this.isUnitActivatable(unit)) {
      throw new Error('Unit cannot be activated. Must be ready and unwounded.')
    }
    return units.map((u, i) =>
      i === index ? { ...u, status: 'spent' as const } : u,
    )
  }

  woundUnit(units: UnitInstance[], index: number, poisonDamage: boolean): UnitInstance[] {
    if (index < 0 || index >= units.length) return [...units]
    const unit = units[index]
    if (unit.woundCount > 0) {
      throw new Error('Unit is already wounded.')
    }
    const woundCount = poisonDamage ? 2 : 1
    return units.map((u, i) =>
      i === index ? { ...u, status: 'wounded' as const, woundCount } : u,
    )
  }

  healUnit(units: UnitInstance[], index: number): UnitInstance[] {
    if (index < 0 || index >= units.length) return [...units]
    const unit = units[index]
    if (unit.woundCount === 0) return [...units]
    return units.map((u, i) =>
      i === index ? { ...u, woundCount: 0, status: 'ready' as const } : u,
    )
  }

  destroyUnit(units: UnitInstance[], index: number): UnitInstance[] {
    if (index < 0 || index >= units.length) return [...units]
    return units.filter((_, i) => i !== index)
  }

  readyAllUnits(units: UnitInstance[]): UnitInstance[] {
    // EC-08-A-2: At round start ALL units become Ready.
    // Wounded units keep their woundCount but status becomes 'ready'.
    // isUnitActivatable checks woundCount === 0, so wounded-ready units still can't activate.
    return units.map((u) => {
      if (u.status === 'ready') return u
      return { ...u, status: 'ready' as const }
    })
  }

  isUnitActivatable(unit: UnitInstance): boolean {
    return unit.status === 'ready' && unit.woundCount === 0
  }

  getAvailableUnits(units: UnitInstance[]): UnitInstance[] {
    return units.filter((u) => this.isUnitActivatable(u))
  }

  getHealingCost(unit: UnitInstance): number {
    return unit.unit.level * unit.woundCount
  }

  canRecruit(units: UnitInstance[], unitLimit: number): boolean {
    return units.length < unitLimit
  }

  refreshUnitOffer(
    regularDeck: RegularUnit[],
    eliteDeck: EliteUnit[],
    slotCount: number,
    coreRevealed: boolean,
  ): { offer: AnyUnit[]; remainingRegular: RegularUnit[]; remainingElite: EliteUnit[] } {
    const offer: AnyUnit[] = []
    const remainingRegular = [...regularDeck]
    const remainingElite = [...eliteDeck]

    for (let i = 0; i < slotCount; i++) {
      if (!coreRevealed) {
        if (remainingRegular.length > 0) {
          offer.push(remainingRegular.shift()!)
        }
      } else {
        const useElite = i % 2 === 1
        if (useElite && remainingElite.length > 0) {
          offer.push(remainingElite.shift()!)
        } else if (remainingRegular.length > 0) {
          offer.push(remainingRegular.shift()!)
        } else if (remainingElite.length > 0) {
          offer.push(remainingElite.shift()!)
        }
      }
    }

    return { offer, remainingRegular, remainingElite }
  }
}
