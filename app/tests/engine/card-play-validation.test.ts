/**
 * UNIT-02-B / UNIT-02-E: Card Play Validation Tests
 *
 * Covers:
 *  - validateCardPlay: spell, action, artifact, wound rules for day/night + mana
 *  - validateSidewaysPlay: wound, ranged/siege phase, elemental, phase checks
 */
import { describe, it, expect } from 'vitest'
import {
  validateCardPlay,
  validateSidewaysPlay,
} from '@/engine/CardPlayValidator'
import type {
  BasicActionCard,
  AdvancedActionCard,
  SpellCard,
  ArtifactCard,
  WoundCard,
  ManaColor,
  DayNight,
  CombatPhase,
} from '@/engine/types'
import type { ManaAvailability } from '@/engine/CardPlayValidator'

// ── Card Factories ────────────────────────────────────────────────────────────

function makeBasicAction(color: ManaColor = 'red'): BasicActionCard {
  return {
    id: 1,
    name: 'March',
    type: 'basic_action',
    color,
    basicEffect: { text: 'Move 2', actions: [{ type: 'move', value: 2 }] },
    strongEffect: { text: 'Move 4', actions: [{ type: 'move', value: 4 }] },
    copies: 2,
    heroSpecific: null,
    replaces: null,
    set: 'base',
  }
}

function makeAdvancedAction(color: ManaColor = 'blue'): AdvancedActionCard {
  return {
    id: 10,
    name: 'Ambush',
    type: 'advanced_action',
    color,
    basicEffect: { text: 'Attack 3', actions: [{ type: 'attack', value: 3 }] },
    strongEffect: { text: 'Attack 5', actions: [{ type: 'attack', value: 5 }] },
    set: 'base',
  }
}

function makeSpell(color: ManaColor = 'green'): SpellCard {
  return {
    id: 20,
    name: 'Fireball',
    type: 'spell',
    color,
    basicSpell: { name: 'Fireball Basic', text: 'Attack 3 fire', actions: [{ type: 'attack', value: 3, element: 'fire' }] },
    strongSpell: { name: 'Fireball Strong', text: 'Attack 6 fire', actions: [{ type: 'attack', value: 6, element: 'fire' }] },
    set: 'base',
  }
}

function makeArtifact(): ArtifactCard {
  return {
    id: 30,
    name: 'Amulet',
    type: 'artifact',
    basicEffect: { text: 'Gain 3 influence', actions: [{ type: 'influence', value: 3 }] },
    strongEffect: { text: 'Gain 6 influence', actions: [{ type: 'influence', value: 6 }] },
    set: 'base',
  }
}

function makeWound(): WoundCard {
  return { type: 'wound', id: 'wound_1' }
}

// ── Mana Availability Helpers ─────────────────────────────────────────────────

function noMana(): ManaAvailability {
  return { hasColor: () => false, hasBlack: false, hasGold: false }
}

function withColors(...colors: ManaColor[]): ManaAvailability {
  return {
    hasColor: (c: ManaColor) => colors.includes(c),
    hasBlack: false,
    hasGold: false,
  }
}

function withColorsAndBlack(...colors: ManaColor[]): ManaAvailability {
  return {
    hasColor: (c: ManaColor) => colors.includes(c),
    hasBlack: true,
    hasGold: false,
  }
}

function withGold(hasBlack = false): ManaAvailability {
  return { hasColor: () => false, hasBlack, hasGold: true }
}

function withAll(): ManaAvailability {
  return { hasColor: () => true, hasBlack: true, hasGold: true }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT-02-B: Spell Card Play Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('UNIT-02-B: validateCardPlay — Action cards', () => {
  describe('Action Basic — always playable', () => {
    it('EC-02-B-1: basic action basic is playable with no mana (day)', () => {
      const card = makeBasicAction('red')
      const result = validateCardPlay(card, 'day', noMana())
      expect(result.canPlayBasic).toBe(true)
    })

    it('EC-02-B-1: basic action basic is playable with no mana (night)', () => {
      const card = makeBasicAction('blue')
      const result = validateCardPlay(card, 'night', noMana())
      expect(result.canPlayBasic).toBe(true)
    })

    it('advanced action basic is always playable', () => {
      const card = makeAdvancedAction('green')
      const result = validateCardPlay(card, 'day', noMana())
      expect(result.canPlayBasic).toBe(true)
    })
  })

  describe('Action Strong Day — needs matching color (or gold)', () => {
    it('EC-02-B-2: strong day requires matching color — succeeds with color', () => {
      const card = makeBasicAction('red')
      const result = validateCardPlay(card, 'day', withColors('red'))
      expect(result.canPlayStrong).toBe(true)
      expect(result.requiresBlackMana).toBe(false)
    })

    it('EC-02-B-2: strong day fails without matching color', () => {
      const card = makeBasicAction('red')
      const result = validateCardPlay(card, 'day', withColors('blue'))
      expect(result.canPlayStrong).toBe(false)
    })

    it('EC-02-B-2: strong day succeeds with gold (wildcard)', () => {
      const card = makeBasicAction('green')
      const result = validateCardPlay(card, 'day', withGold())
      expect(result.canPlayStrong).toBe(true)
    })

    it('strong day fails with no mana at all', () => {
      const card = makeAdvancedAction('white')
      const result = validateCardPlay(card, 'day', noMana())
      expect(result.canPlayStrong).toBe(false)
      expect(result.reason).toMatch(/white/)
    })
  })

  describe('Action Strong Night — needs matching color + black mana', () => {
    it('EC-02-B-3: strong night requires color AND black — succeeds with both', () => {
      const card = makeBasicAction('blue')
      const result = validateCardPlay(card, 'night', withColorsAndBlack('blue'))
      expect(result.canPlayStrong).toBe(true)
      expect(result.requiresBlackMana).toBe(true)
    })

    it('EC-02-B-3: strong night fails with color but no black', () => {
      const card = makeBasicAction('blue')
      const result = validateCardPlay(card, 'night', withColors('blue'))
      expect(result.canPlayStrong).toBe(false)
      expect(result.requiresBlackMana).toBe(true)
      expect(result.reason).toMatch(/black/i)
    })

    it('EC-02-B-3: strong night fails with black but no color', () => {
      const card = makeBasicAction('red')
      const result = validateCardPlay(card, 'night', withColorsAndBlack('blue')) // has blue, not red
      expect(result.canPlayStrong).toBe(false)
      expect(result.reason).toMatch(/red/)
    })

    it('EC-02-B-3: strong night fails with no mana', () => {
      const card = makeBasicAction('green')
      const result = validateCardPlay(card, 'night', noMana())
      expect(result.canPlayStrong).toBe(false)
    })

    it('gold substitutes color requirement at night when combined with black', () => {
      const card = makeBasicAction('white')
      const result = validateCardPlay(card, 'night', withGold(true)) // gold + black
      expect(result.canPlayStrong).toBe(true)
    })

    it('gold without black still fails at night', () => {
      const card = makeBasicAction('white')
      const result = validateCardPlay(card, 'night', withGold(false))
      expect(result.canPlayStrong).toBe(false)
    })
  })

  describe('requiredMana reflects card color', () => {
    it('returns card color as requiredMana', () => {
      const card = makeBasicAction('green')
      const result = validateCardPlay(card, 'day', noMana())
      expect(result.requiredMana).toBe('green')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('UNIT-02-B: validateCardPlay — Spell cards', () => {
  describe('Spell Basic — always needs matching color mana', () => {
    it('EC-02-B-4: spell basic requires color — succeeds with matching color (day)', () => {
      const card = makeSpell('green')
      const result = validateCardPlay(card, 'day', withColors('green'))
      expect(result.canPlayBasic).toBe(true)
    })

    it('EC-02-B-4: spell basic fails without color (day)', () => {
      const card = makeSpell('green')
      const result = validateCardPlay(card, 'day', noMana())
      expect(result.canPlayBasic).toBe(false)
    })

    it('EC-02-B-4: spell basic requires color — succeeds with matching color (night)', () => {
      const card = makeSpell('blue')
      const result = validateCardPlay(card, 'night', withColors('blue'))
      expect(result.canPlayBasic).toBe(true)
    })

    it('EC-02-B-4: spell basic fails without color (night)', () => {
      const card = makeSpell('blue')
      const result = validateCardPlay(card, 'night', noMana())
      expect(result.canPlayBasic).toBe(false)
    })

    it('spell basic succeeds with gold wildcard', () => {
      const card = makeSpell('red')
      const result = validateCardPlay(card, 'day', withGold())
      expect(result.canPlayBasic).toBe(true)
    })
  })

  describe('Spell Strong Day — IMPOSSIBLE', () => {
    it('EC-02-B-5: spell strong CANNOT be played during day (even with all mana)', () => {
      const card = makeSpell('green')
      const result = validateCardPlay(card, 'day', withAll())
      expect(result.canPlayStrong).toBe(false)
      expect(result.reason).toMatch(/day|black/i)
    })

    it('EC-02-B-5: spell strong day impossible even with gold + black... but black unavailable in day', () => {
      const card = makeSpell('white')
      // Even if somehow constructed with black, day rule forbids it
      const result = validateCardPlay(card, 'day', withAll())
      expect(result.canPlayStrong).toBe(false)
    })
  })

  describe('Spell Strong Night — needs matching color only (no black needed)', () => {
    it('EC-02-B-6: spell strong night succeeds with matching color, no black needed', () => {
      const card = makeSpell('blue')
      // Has color but NOT black — should still work
      const result = validateCardPlay(card, 'night', withColors('blue'))
      expect(result.canPlayStrong).toBe(true)
      expect(result.requiresBlackMana).toBe(false)
    })

    it('EC-02-B-6: spell strong night fails without matching color', () => {
      const card = makeSpell('red')
      const result = validateCardPlay(card, 'night', withColors('blue'))
      expect(result.canPlayStrong).toBe(false)
    })

    it('spell strong night succeeds with gold (no black needed)', () => {
      const card = makeSpell('green')
      const result = validateCardPlay(card, 'night', withGold(false))
      expect(result.canPlayStrong).toBe(true)
    })
  })

  describe('Spell requiresBlackMana', () => {
    it('spell never sets requiresBlackMana=true', () => {
      const card = makeSpell('red')
      const dayResult = validateCardPlay(card, 'day', withAll())
      const nightResult = validateCardPlay(card, 'night', withAll())
      expect(dayResult.requiresBlackMana).toBe(false)
      expect(nightResult.requiresBlackMana).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('UNIT-02-B: validateCardPlay — Artifact cards', () => {
  it('EC-02-B-7: artifact basic always playable, no mana needed', () => {
    const card = makeArtifact()
    expect(validateCardPlay(card, 'day', noMana()).canPlayBasic).toBe(true)
    expect(validateCardPlay(card, 'night', noMana()).canPlayBasic).toBe(true)
  })

  it('EC-02-B-7: artifact strong always playable (expended/thrown away)', () => {
    const card = makeArtifact()
    expect(validateCardPlay(card, 'day', noMana()).canPlayStrong).toBe(true)
    expect(validateCardPlay(card, 'night', noMana()).canPlayStrong).toBe(true)
  })

  it('artifact requiredMana is null', () => {
    const card = makeArtifact()
    expect(validateCardPlay(card, 'day', noMana()).requiredMana).toBeNull()
  })

  it('artifact requiresBlackMana is false', () => {
    const card = makeArtifact()
    expect(validateCardPlay(card, 'night', noMana()).requiresBlackMana).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// UNIT-02-E: Sideways Play Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('UNIT-02-E: validateSidewaysPlay — Wound cards', () => {
  it('EC-02-E-1: wound card CANNOT be played sideways for move', () => {
    const result = validateSidewaysPlay(makeWound(), 'move')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/wound/i)
  })

  it('EC-02-E-1: wound card CANNOT be played sideways for attack', () => {
    const result = validateSidewaysPlay(makeWound(), 'attack', 'attack')
    expect(result.valid).toBe(false)
  })

  it('EC-02-E-1: wound card CANNOT be played sideways for block', () => {
    const result = validateSidewaysPlay(makeWound(), 'block', 'block')
    expect(result.valid).toBe(false)
  })

  it('EC-02-E-1: wound card CANNOT be played sideways for influence', () => {
    const result = validateSidewaysPlay(makeWound(), 'influence')
    expect(result.valid).toBe(false)
  })
})

describe('UNIT-02-E: validateSidewaysPlay — Attack phase checks', () => {
  it('EC-02-E-2: sideways attack valid during melee attack phase', () => {
    const card = makeBasicAction('red')
    const result = validateSidewaysPlay(card, 'attack', 'attack')
    expect(result.valid).toBe(true)
    expect(result.element).toBe('physical')
  })

  it('EC-02-E-2: sideways attack INVALID during ranged_siege phase', () => {
    const card = makeBasicAction('red')
    const result = validateSidewaysPlay(card, 'attack', 'ranged_siege')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/ranged|siege/i)
  })

  it('EC-02-E-2: sideways attack invalid during block phase', () => {
    const card = makeBasicAction('red')
    const result = validateSidewaysPlay(card, 'attack', 'block')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/attack phase/i)
  })

  it('EC-02-E-2: sideways attack invalid during assign_damage phase', () => {
    const card = makeSpell('blue')
    const result = validateSidewaysPlay(card, 'attack', 'assign_damage')
    expect(result.valid).toBe(false)
  })

  it('sideways attack with no phase specified is allowed (non-combat context)', () => {
    const card = makeAdvancedAction('green')
    const result = validateSidewaysPlay(card, 'attack', undefined)
    expect(result.valid).toBe(true)
  })
})

describe('UNIT-02-E: validateSidewaysPlay — Block phase checks', () => {
  it('EC-02-E-3: sideways block valid during block phase', () => {
    const card = makeBasicAction('blue')
    const result = validateSidewaysPlay(card, 'block', 'block')
    expect(result.valid).toBe(true)
    expect(result.element).toBe('physical')
  })

  it('EC-02-E-3: sideways block invalid during ranged_siege phase', () => {
    const card = makeBasicAction('blue')
    const result = validateSidewaysPlay(card, 'block', 'ranged_siege')
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/block phase/i)
  })

  it('EC-02-E-3: sideways block invalid during attack phase', () => {
    const card = makeBasicAction('red')
    const result = validateSidewaysPlay(card, 'block', 'attack')
    expect(result.valid).toBe(false)
  })
})

describe('UNIT-02-E: validateSidewaysPlay — Always physical element', () => {
  it('sideways play always returns element=physical for any card', () => {
    const cards = [makeBasicAction('red'), makeAdvancedAction('blue'), makeSpell('green'), makeArtifact()]
    for (const card of cards) {
      const result = validateSidewaysPlay(card, 'move')
      expect(result.element).toBe('physical')
    }
  })

  it('sideways play for move is always valid (no phase restriction)', () => {
    const card = makeBasicAction('red')
    const result = validateSidewaysPlay(card, 'move')
    expect(result.valid).toBe(true)
    expect(result.element).toBe('physical')
  })

  it('sideways play for influence is always valid', () => {
    const card = makeAdvancedAction('green')
    const result = validateSidewaysPlay(card, 'influence')
    expect(result.valid).toBe(true)
    expect(result.element).toBe('physical')
  })
})

describe('UNIT-02-E: validateSidewaysPlay — Non-wound deed cards are valid sideways (right phase)', () => {
  it('basic_action card can be played sideways for move', () => {
    expect(validateSidewaysPlay(makeBasicAction(), 'move').valid).toBe(true)
  })

  it('advanced_action card can be played sideways for move', () => {
    expect(validateSidewaysPlay(makeAdvancedAction(), 'move').valid).toBe(true)
  })

  it('spell card can be played sideways for move', () => {
    expect(validateSidewaysPlay(makeSpell(), 'move').valid).toBe(true)
  })

  it('artifact card can be played sideways for move', () => {
    expect(validateSidewaysPlay(makeArtifact(), 'move').valid).toBe(true)
  })
})
