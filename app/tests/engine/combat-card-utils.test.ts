/**
 * Regression tests for combatCardUtils element-attack handling.
 *
 * Bug: element-specific melee attacks (ice_attack / fire_attack /
 * cold_fire_attack — e.g. Cold Toughness "Ice Attack 2") were filtered out of
 * the melee Attack phase, so the only option offered was the sideways play
 * (physical Attack 1). Per the rulebook (Melee Attacks): "Any combination of
 * Attack effects can be played" — element attacks are valid melee Attacks.
 */
import { describe, it, expect } from 'vitest'
import {
  filterActionsForPhase, getActionElement,
  getConcentrationBonus, getStrongComboAction,
} from '@/utils/combatCardUtils'
import type { CardAction, AnyCard } from '@/engine/types'

describe('filterActionsForPhase — element melee attacks', () => {
  const iceAttack: CardAction = { type: 'ice_attack', value: 2, choice: true }
  const fireAttack: CardAction = { type: 'fire_attack', value: 3 }
  const coldFireAttack: CardAction = { type: 'cold_fire_attack', value: 4 }
  const iceBlock: CardAction = { type: 'ice_block', value: 3, choice: true }

  it('keeps ice/fire/cold_fire attacks in the melee attack phase', () => {
    expect(filterActionsForPhase([iceAttack], 'attack')).toHaveLength(1)
    expect(filterActionsForPhase([fireAttack], 'attack')).toHaveLength(1)
    expect(filterActionsForPhase([coldFireAttack], 'attack')).toHaveLength(1)
  })

  it('does not surface a melee element attack in the block phase', () => {
    expect(filterActionsForPhase([iceAttack], 'block')).toHaveLength(0)
  })

  it('still surfaces element blocks in the block phase', () => {
    expect(filterActionsForPhase([iceBlock], 'block')).toHaveLength(1)
  })

  it('does not surface a melee element attack in the ranged/siege phase', () => {
    // ice_attack is a melee attack, not ranged/siege
    expect(filterActionsForPhase([iceAttack], 'ranged_siege')).toHaveLength(0)
  })
})

describe('getActionElement', () => {
  it('derives element from the action type prefix', () => {
    expect(getActionElement({ type: 'ice_attack', value: 2 })).toBe('ice')
    expect(getActionElement({ type: 'fire_attack', value: 2 })).toBe('fire')
    expect(getActionElement({ type: 'cold_fire_attack', value: 2 })).toBe('cold_fire')
    expect(getActionElement({ type: 'cold_fire_block', value: 2 })).toBe('cold_fire')
    expect(getActionElement({ type: 'attack', value: 2 })).toBe('physical')
  })

  it('prefers an explicit element field over the type prefix', () => {
    expect(getActionElement({ type: 'ranged_attack', value: 4, element: 'fire' })).toBe('fire')
  })
})

describe('Concentration / Will Focus combo', () => {
  const concentration = {
    type: 'basic_action', id: 15, name: 'Concentration', color: 'green',
    basicEffect: { text: '', actions: [{ type: 'gain_mana', color: 'blue_white_or_red' }] },
    strongEffect: { text: '', manaCost: 'green', actions: [{ type: 'special', description: 'combo' }] },
  } as unknown as AnyCard

  const willFocus = { ...(concentration as object), name: 'Will Focus' } as unknown as AnyCard

  // A target Action card whose strong effect is Attack 4
  const rage = {
    type: 'basic_action', id: 99, name: 'Rage', color: 'red',
    basicEffect: { text: '', actions: [{ type: 'attack', value: 2, choice: true }] },
    strongEffect: { text: '', manaCost: 'red', actions: [{ type: 'attack', value: 4 }] },
  } as unknown as AnyCard

  it('identifies the combo bonus', () => {
    expect(getConcentrationBonus(concentration)).toBe(2)
    expect(getConcentrationBonus(willFocus)).toBe(3)
    expect(getConcentrationBonus(rage)).toBeNull()
  })

  it('finds the strong attack action of a target card for the melee phase', () => {
    const action = getStrongComboAction(rage, 'attack')
    expect(action).not.toBeNull()
    expect(action?.type).toBe('attack')
    expect(action?.value).toBe(4)
  })

  it('returns null when the target has no usable strong effect this phase', () => {
    // Rage strong is an attack — not usable in the block phase
    expect(getStrongComboAction(rage, 'block')).toBeNull()
    // Concentration itself is not a valid combo target (special only)
    expect(getStrongComboAction(concentration, 'attack')).toBeNull()
  })
})
