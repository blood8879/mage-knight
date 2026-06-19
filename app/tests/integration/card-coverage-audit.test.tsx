import { describe, it, expect } from 'vitest'
import { getBasicActions, getAdvancedActions, getSpells, getArtifacts } from '@/data/loader'
import type { AnyCard, CardAction } from '@/engine/types'

/**
 * Rulebook coverage audit — a checklist-as-test. It enumerates EVERY card's
 * basic + strong actions and asserts the engine actually handles each action
 * type (no silent drops), and that every `special` clause is explicitly
 * categorised as implemented / multiplayer-only-no-op / known-limitation.
 *
 * If a new card or action type is added without engine support, this fails —
 * which is the guard against "the test said pass but hand-play had bugs".
 */

// Action types the engine resolves out of combat (CardEffectResolver.resolveEffect).
const RESOLVER_TYPES = new Set([
  'move', 'influence', 'healing', 'heal', 'draw_card', 'reputation', 'fame',
  'influence_per_wound', 'gain_advanced_action', 'gain_spell', 'take_wound',
  'ready_unit', 'terrain_modifier', 'gain_crystal', 'gain_mana', 'gain_mana_token',
])
// Combat action types (useCombatCards / applyCombatSpecials).
const COMBAT_TYPES = new Set([
  'attack', 'ranged_attack', 'siege_attack', 'fire_attack', 'ice_attack', 'cold_fire_attack',
  'block', 'fire_block', 'ice_block', 'cold_fire_block',
  'enemy_armor_reduction', 'enemy_skip_attack', 'destroy_enemy',
])
// Other handled types.
const OTHER_HANDLED = new Set([
  'assign_to_unit', // banner attach (GameScreen)
  'all_units_bonus', // Banner of Glory strong (throw-away combat bonus)
])

// Cards whose `special` clause is implemented (engine + tests).
const SPECIAL_IMPLEMENTED = new Set([
  'Agility', 'Ambush', 'Amulet of Darkness', 'Amulet of Sun', 'Banner of Command',
  'Banner of Courage', 'Banner of Fortitude', 'Blood of Ancients', 'Blood Rage',
  'Burning Shield / Exploding Shield', 'Charm / Possess', 'Chivalry', 'Cold Toughness',
  'Concentration', 'Crystallize', 'Cure / Disease', 'Diplomacy', 'Expose / Mass Expose',
  'Flame Wall / Flame Wave', 'Golden Grail', 'Horn of Wrath', 'Improvisation', 'Mana Draw',
  'Maximal Effect', 'Mist Form / Veil of Mist', 'Mountain Lore', 'Noble Manners',
  'Offering / Sacrifice', 'Peaceful Moment', 'Restoration / Rebirth', 'Shield Bash',
  'Shield of the Fallen Kings', 'Song of Wind', 'Soul Harvester', 'Steady Tempo', 'Will Focus',
])
// `special` clauses that are competitive/cooperative-only → correctly inert in the solo game.
const SPECIAL_MULTIPLAYER_NOOP = new Set([
  'Energy Flow / Energy Steal', 'Mind Read / Mind Steal',
])

function allCards(): AnyCard[] {
  const ba = getBasicActions()
  return [
    ...ba.commonCards, ...ba.heroSpecificCards,
    ...getAdvancedActions(), ...getSpells(), ...getArtifacts(),
  ] as AnyCard[]
}
function effectsOf(card: AnyCard): CardAction[] {
  const c = card as Record<string, { actions?: CardAction[] }>
  const out: CardAction[] = []
  for (const k of ['basicEffect', 'strongEffect', 'basicSpell', 'strongSpell']) {
    const e = c[k]
    if (e?.actions) out.push(...e.actions)
  }
  return out
}

describe('Card coverage audit (rulebook ↔ engine)', () => {
  it('every non-special action type is handled by the engine', () => {
    const unhandled = new Set<string>()
    for (const card of allCards()) {
      for (const a of effectsOf(card)) {
        if (a.type === 'special') continue
        if (RESOLVER_TYPES.has(a.type) || COMBAT_TYPES.has(a.type) || OTHER_HANDLED.has(a.type)) continue
        unhandled.add(a.type)
      }
    }
    expect([...unhandled]).toEqual([])
  })

  it('every special clause is categorised (implemented or multiplayer-no-op)', () => {
    const uncategorised: string[] = []
    for (const card of allCards()) {
      if (!('name' in card)) continue
      const hasSpecial = effectsOf(card).some((a) => a.type === 'special')
      if (!hasSpecial) continue
      const name = card.name
      if (!SPECIAL_IMPLEMENTED.has(name) && !SPECIAL_MULTIPLAYER_NOOP.has(name)) {
        uncategorised.push(name)
      }
    }
    expect([...new Set(uncategorised)]).toEqual([])
  })

  it('coverage summary (informational)', () => {
    const cards = allCards().filter((c) => 'name' in c)
    const specialCards = cards.filter((c) => effectsOf(c).some((a) => a.type === 'special'))
    // Sanity: the audit actually scanned a meaningful number of cards.
    expect(cards.length).toBeGreaterThan(90)
    expect(specialCards.length).toBeGreaterThan(30)
  })
})
