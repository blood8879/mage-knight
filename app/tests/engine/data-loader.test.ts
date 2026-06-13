import { describe, it, expect } from 'vitest'
import {
  getAdvancedActions,
  getSpells,
  getArtifacts,
  getRegularUnits,
  getEliteUnits,
  getBasicActions,
  getAllCardData,
} from '@/data/loader'

describe('data loader', () => {
  it('loads 44 advanced actions', () => {
    const cards = getAdvancedActions()
    expect(cards).toHaveLength(44)
    expect(cards[0].name).toBe('Fire Bolt')
  })

  it('loads 24 spells', () => {
    const cards = getSpells()
    expect(cards).toHaveLength(24)
  })

  it('loads 25 artifacts', () => {
    const cards = getArtifacts()
    expect(cards).toHaveLength(25)
  })

  it('loads 15 regular units', () => {
    const units = getRegularUnits()
    expect(units).toHaveLength(15)
  })

  it('loads 15 elite units', () => {
    const units = getEliteUnits()
    expect(units).toHaveLength(15)
  })

  it('loads basic actions with common and hero-specific cards', () => {
    const { commonCards, heroSpecificCards } = getBasicActions()
    expect(commonCards.length).toBeGreaterThan(0)
    expect(heroSpecificCards.length).toBeGreaterThan(0)
  })

  it('getAllCardData returns all categories', () => {
    const data = getAllCardData()
    expect(data.advancedActions).toHaveLength(44)
    expect(data.spells).toHaveLength(24)
    expect(data.artifacts).toHaveLength(25)
    expect(data.regularUnits).toHaveLength(15)
    expect(data.eliteUnits).toHaveLength(15)
  })
})
