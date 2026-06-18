import { describe, it, expect } from 'vitest'
import { createHarness, setupTurn, manaWith } from './card-play-harness'
import { MovementResolver } from '@/engine/MovementResolver'
import { ManaPool } from '@/engine/ManaPool'
import { getArtifacts } from '@/data/loader'
import type { AnyCard, CardAction, ManaPoolState } from '@/engine/types'

/**
 * Amulet of the Sun (id 15) / Amulet of Darkness (id 16) — the mana gain is the
 * primary effect; these cover the conditional bonus clauses:
 *  - Sun (played at Night):  forests cost 3, gold mana usable as wild basic
 *  - Darkness (played at Day): deserts cost 3, black mana usable as if Night
 */
function art(name: string): AnyCard {
  const c = getArtifacts().find((x) => x.name === name)
  if (!c) throw new Error(name)
  return c
}

describe('Amulet of the Sun (Night bonus)', () => {
  it('forests cost 3 and gold becomes usable at night', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'gold', source: 'effect' }] })(
      setupTurn([art('Amulet of Sun')], { dayNight: 'night' })(s)))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['red'] }))

    const turn = h.state().player.turn
    const mods = (turn.terrainModifiers ?? []) as CardAction[]
    const r = new MovementResolver()
    expect(r.getMoveCost('forest', 'night', mods)).toBe(3)

    expect(h.state().player.mana.goldUsableAtNight).toBe(true)
    // Gold can now pay a basic colour at night.
    const mp = new ManaPool()
    expect(mp.spendManaOfColor(h.state().player.mana, 'blue', 'night')).not.toBeNull()
  })

  it('played during the Day grants no Night bonus', () => {
    const h = createHarness('Tovak')
    h.setState(setupTurn([art('Amulet of Sun')], { dayNight: 'day' }))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['red'] }))
    expect(h.state().player.mana.goldUsableAtNight ?? false).toBe(false)
  })
})

describe('Amulet of Darkness (Day bonus)', () => {
  it('deserts cost 3 and black becomes usable by day', () => {
    const h = createHarness('Tovak')
    h.setState((s) => manaWith({ tokens: [{ color: 'black', source: 'effect' }] })(
      setupTurn([art('Amulet of Darkness')], { dayNight: 'day' })(s)))
    h.run((e) => e.playCard(0, 'basic', { chosenColors: ['red'] }))

    const turn = h.state().player.turn
    const mods = (turn.terrainModifiers ?? []) as CardAction[]
    const r = new MovementResolver()
    expect(r.getMoveCost('desert', 'day', mods)).toBe(3)

    const mana = h.state().player.mana as ManaPoolState
    expect(mana.blackUsableAtDay).toBe(true)
    const mp = new ManaPool()
    expect(mp.hasBlackMana(mana, 'day')).toBe(true) // black usable by day now
  })

  it('resetTurnState clears the amulet mana flags', () => {
    const mp = new ManaPool()
    const base = mp.createInitialState ? mp.createInitialState() : ({ dice: [], playerMana: [], crystals: { red: 0, blue: 0, green: 0, white: 0 }, sourceDieTakenThisTurn: false } as ManaPoolState)
    const flagged: ManaPoolState = { ...base, goldUsableAtNight: true, blackUsableAtDay: true }
    const reset = mp.resetTurnState(flagged)
    expect(reset.goldUsableAtNight).toBe(false)
    expect(reset.blackUsableAtDay).toBe(false)
  })
})
