import { describe, it, expect } from 'vitest'
import { getHeroSkills } from '@/data/loader'

/**
 * Hero-skill coverage audit. Asserts every action type used by every hero's
 * skills is handled somewhere (non-combat activateSkill, combat tray, or a
 * passive). Guards against the "skill does nothing when used" class of bugs.
 */
const HEROES = ['Arythea', 'Goldyx', 'Norowas', 'Tovak']

// Handled by activateSkill (non-combat) switch.
const NONCOMBAT_HANDLED = new Set([
  'move', 'influence', 'healing', 'heal_wounds', 'gain_crystal', 'gain_mana_token',
  'free_unit_activation', 'move_per_ready_unit', 'heal_unit_wound', 'wound_as_card',
  'mana_conversion', 'discard_wound_for_mana', 'discard_card_for_mana', 'draw_cards',
  'discard_wound_draw_card', 'influence_per_crystal_color', 'sideways_bonus', 'flight',
  'sideways_mana_boost', 'cooperative_terrain_discount', 'cooperative_mana_overload',
  'cooperative_source_opening',
])
// Handled in combat (useCombatCards / applyCombatSpecials) — and unit_boost (Leadership).
const COMBAT_HANDLED = new Set([
  'attack', 'ranged_attack', 'siege_attack', 'block',
  'enemy_armor_reduction', 'unit_boost', 'wound_as_card',
])
// Passive skills apply automatically (no activation).
const PASSIVE_HANDLED = new Set(['passive_command_bonus', 'gain_mana_token'])

describe('Hero-skill coverage audit', () => {
  it('every skill action type is handled (no silent no-op)', () => {
    const unhandled = new Map<string, string>() // type → "hero/skill"
    for (const hero of HEROES) {
      for (const s of getHeroSkills(hero)) {
        for (const a of s.actions) {
          const t = a.type
          if (NONCOMBAT_HANDLED.has(t) || COMBAT_HANDLED.has(t) || PASSIVE_HANDLED.has(t)) continue
          unhandled.set(t, `${hero}/${s.name}`)
        }
      }
    }
    expect([...unhandled.entries()]).toEqual([])
  })

  it('scanned all four heroes with a meaningful number of skills', () => {
    const total = HEROES.reduce((n, h) => n + getHeroSkills(h).length, 0)
    expect(total).toBeGreaterThanOrEqual(36) // ~10 per hero
  })
})
