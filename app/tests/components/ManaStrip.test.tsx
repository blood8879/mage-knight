import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n/config'

// Mock the engine hook so we can assert the strip wires clicks to it
const takeManaFromSource = vi.fn()
const useCrystal = vi.fn()
const returnManaToken = vi.fn()
vi.mock('@/hooks/useGameEngine', () => ({
  useGameEngine: () => ({ takeManaFromSource, useCrystal, returnManaToken }),
}))

// Controllable store state
let storeState: any
vi.mock('@/store/gameStore', () => ({
  useGameStore: (selector: (s: any) => unknown) => selector({ engineState: storeState }),
}))

import ManaStrip from '@/components/common/ManaStrip'

function setMana(partial: any) {
  storeState = {
    dayNight: partial.dayNight ?? 'day',
    player: {
      mana: {
        dice: partial.dice ?? [],
        playerMana: partial.playerMana ?? [],
        crystals: partial.crystals ?? { red: 0, blue: 0, green: 0, white: 0 },
        sourceDieTakenThisTurn: partial.sourceDieTakenThisTurn ?? false,
        extraSourceDice: partial.extraSourceDice ?? 0,
      },
    },
  }
}

describe('ManaStrip — take Source dice & spend crystals in overlays', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko')
    takeManaFromSource.mockClear()
    useCrystal.mockClear()
    returnManaToken.mockClear()
  })

  it('renders Source dice and taking a basic die calls takeManaFromSource', () => {
    setMana({ dice: [{ id: 'd1', color: 'blue', isInSource: true }] })
    render(<ManaStrip />)
    const die = screen.getByLabelText(/파란색 mana die/)
    expect(die).toBeEnabled()
    fireEvent.click(die)
    expect(takeManaFromSource).toHaveBeenCalledWith('d1')
  })

  it('disables a die once a Source die was taken this turn', () => {
    setMana({ dice: [{ id: 'd1', color: 'red', isInSource: true }], sourceDieTakenThisTurn: true })
    render(<ManaStrip />)
    expect(screen.getByLabelText(/빨간색 mana die/)).toBeDisabled()
  })

  it('re-enables when an extra Source die is granted (Mana Draw)', () => {
    setMana({ dice: [{ id: 'd1', color: 'red', isInSource: true }], sourceDieTakenThisTurn: true, extraSourceDice: 1 })
    render(<ManaStrip />)
    expect(screen.getByLabelText(/빨간색 mana die/)).toBeEnabled()
  })

  it('gold die is disabled at night, black die disabled at day', () => {
    setMana({ dayNight: 'night', dice: [{ id: 'g', color: 'gold', isInSource: true }, { id: 'b', color: 'black', isInSource: true }] })
    render(<ManaStrip />)
    expect(screen.getByLabelText(/금색 mana die/)).toBeDisabled()
    expect(screen.getByLabelText(/검은색 mana die/)).toBeEnabled()
  })

  it('spending a crystal calls useCrystal with its color', () => {
    setMana({ crystals: { red: 0, blue: 2, green: 0, white: 0 } })
    render(<ManaStrip />)
    const btn = screen.getByLabelText(/파란색 crystal/)
    fireEvent.click(btn)
    expect(useCrystal).toHaveBeenCalledWith('blue')
  })

  it('an active crystal/die mana token is undoable (returnManaToken)', () => {
    setMana({ playerMana: [{ color: 'red', source: 'crystal' }] })
    render(<ManaStrip />)
    const tokenBtn = screen.getByLabelText(/빨간색 마나 되돌리기/)
    fireEvent.click(tokenBtn)
    expect(returnManaToken).toHaveBeenCalledWith(0)
  })

  it('an effect-sourced mana token is NOT undoable (no button)', () => {
    setMana({ playerMana: [{ color: 'red', source: 'effect' }] })
    render(<ManaStrip />)
    expect(screen.queryByLabelText(/되돌리기/)).toBeNull()
  })
})
