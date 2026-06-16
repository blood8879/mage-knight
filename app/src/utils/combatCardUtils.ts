import type {
  CardAction,
  CardEffect,
  CombatPhase,
  DeedCard,
  AnyCard,
  Element,
  UnitInstance,
  UnitAbility,
} from '../engine/types'

// ── Effect Extraction ────────────────────

/** Given a card and effect type, return the CardEffect */
export function getCardEffect(card: DeedCard, effectType: 'basic' | 'strong'): CardEffect | null {
  if (card.type === 'spell') {
    return effectType === 'basic' ? card.basicSpell : card.strongSpell
  }
  if (card.type === 'basic_action' || card.type === 'advanced_action' || card.type === 'artifact') {
    return effectType === 'basic' ? card.basicEffect : card.strongEffect
  }
  return null
}

// ── Phase Filtering ──────────────────────

/** Combat special effects (armor reduction / skip attack / destroy) by phase */
const SPECIALS_RANGED: ReadonlySet<string> = new Set(['enemy_armor_reduction', 'enemy_skip_attack'])
const SPECIALS_BLOCK: ReadonlySet<string> = new Set(['enemy_armor_reduction', 'enemy_skip_attack'])
const SPECIALS_ATTACK: ReadonlySet<string> = new Set(['enemy_armor_reduction', 'destroy_enemy'])

/** Filter actions relevant to current combat phase */
export function filterActionsForPhase(actions: CardAction[], phase: CombatPhase): CardAction[] {
  switch (phase) {
    case 'ranged_siege':
      return actions.filter((a) => {
        const t = a.type
        if (SPECIALS_RANGED.has(t)) return true
        return t === 'ranged_attack' || t === 'siege_attack' || t.includes('ranged') || t.includes('siege')
      })
    case 'block':
      return actions.filter((a) => SPECIALS_BLOCK.has(a.type) || a.type === 'block' || a.type.includes('block'))
    case 'attack':
      // EC-07-E-1: ranged/siege attacks not used in Phase 1 may also be
      // declared during the melee phase (all attack types are valid).
      // Element-specific melee attacks (ice_attack / fire_attack /
      // cold_fire_attack) must be allowed too — otherwise a card like
      // Cold Toughness ("Ice Attack 2") would only offer its sideways play.
      return actions.filter((a) => {
        const t = a.type
        if (SPECIALS_ATTACK.has(t)) return true
        return (
          t === 'attack' ||
          t === 'ranged_attack' ||
          t === 'siege_attack' ||
          t === 'fire_attack' ||
          t === 'ice_attack' ||
          t === 'cold_fire_attack'
        )
      })
    default:
      return []
  }
}

/** Combat special actions contribute no attack/block value of their own */
export function isCombatSpecialAction(action: CardAction | null): boolean {
  if (!action) return false
  return (
    action.type === 'enemy_armor_reduction' ||
    action.type === 'enemy_skip_attack' ||
    action.type === 'destroy_enemy'
  )
}

/** Check if a card has any actions relevant to phase (for UI highlighting) */
export function isCardRelevantForPhase(card: AnyCard, phase: CombatPhase): boolean {
  if (card.type === 'wound') return false

  // Improvisation: relevant for block and melee attack phases (provides Attack/Block)
  if ('name' in card && card.name === 'Improvisation') {
    return phase === 'block' || phase === 'attack'
  }

  const basicEffect = getCardEffect(card, 'basic')
  const strongEffect = getCardEffect(card, 'strong')

  const basicActions = basicEffect?.actions ?? []
  const strongActions = strongEffect?.actions ?? []

  return (
    filterActionsForPhase(basicActions, phase).length > 0 ||
    filterActionsForPhase(strongActions, phase).length > 0
  )
}

// ── Element Helpers ──────────────────────

/** Extract the Element from an action */
export function getActionElement(action: CardAction): Element {
  if (action.element) return action.element as Element

  const t = action.type
  if (t.startsWith('cold_fire_')) return 'cold_fire'
  if (t.startsWith('fire_')) return 'fire'
  if (t.startsWith('ice_')) return 'ice'

  return 'physical'
}

// ── Choice / Non-Choice ──────────────────

/** Get choice actions from effect (where choice === true) */
export function getChoiceActions(effect: CardEffect): CardAction[] {
  return (effect.actions ?? []).filter((a) => a.choice === true)
}

/** Get non-choice actions */
export function getNonChoiceActions(effect: CardEffect): CardAction[] {
  return (effect.actions ?? []).filter((a) => !a.choice)
}

// ── Mana Cost ────────────────────────────

/** Get mana cost for strong effect */
export function getManaCost(card: DeedCard): string | string[] | undefined {
  const strong = getCardEffect(card, 'strong')
  return strong?.manaCost
}

// ── Concentration / Will Focus combo ─────

/** Combo bonus for Concentration (+2) / Will Focus (+3), or null if not such a card */
export function getConcentrationBonus(card: AnyCard): number | null {
  if (card.type === 'wound' || !('name' in card)) return null
  if (card.name === 'Will Focus') return 3
  if (card.name === 'Concentration') return 2
  return null
}

/** The best (highest-value) strong combo action a target Action card offers for the phase */
export function getStrongComboAction(card: AnyCard, phase: CombatPhase): CardAction | null {
  if (card.type !== 'basic_action' && card.type !== 'advanced_action') return null
  const strong = getCardEffect(card, 'strong')
  if (!strong) return null
  const acts = filterActionsForPhase(strong.actions, phase).filter((a) => !isCombatSpecialAction(a))
  if (acts.length === 0) return null
  return acts.reduce((best, a) => (getActionValue(a) > getActionValue(best) ? a : best), acts[0])
}

// ── Attack Type Checks ───────────────────

/** Check ranged action */
export function isRangedAction(action: CardAction): boolean {
  return action.type === 'ranged_attack' || action.type.includes('ranged')
}

/** Check siege action */
export function isSiegeAction(action: CardAction): boolean {
  return action.type === 'siege_attack' || action.type.includes('siege')
}

// ── Unit Combat ──────────────────────────

/** Get unit combat abilities relevant to phase */
export function getUnitCombatActions(
  unit: UnitInstance,
  phase: CombatPhase,
): Array<{ ability: UnitAbility; action: CardAction }> {
  if (unit.status !== 'ready') return []

  const results: Array<{ ability: UnitAbility; action: CardAction }> = []

  for (const ability of unit.unit.abilities) {
    // EC-08-B-1: a unit carrying a banner may only use its basic abilities —
    // mana-powered abilities are unavailable while the banner is attached
    if (unit.bannerCard && ability.manaCost) continue
    const relevant = filterActionsForPhase(ability.actions, phase)
    for (const action of relevant) {
      results.push({ ability, action })
    }
  }

  // Banner of Fear: in the block phase, spend the bannered unit to cancel
  // one enemy attack entirely (modelled as an overwhelming block) — Fame +1
  if (phase === 'block' && unit.bannerCard?.name === 'Banner of Fear') {
    results.push({
      ability: {
        name: 'Banner of Fear',
        text: 'Spend this Unit to cancel one enemy attack. Fame +1.',
        actions: [],
      },
      action: { type: 'block', value: 99, bannerFear: true, description: 'cancel attack' },
    })
  }

  return results
}

// ── Value Extraction ─────────────────────

/** Get numeric value from action */
export function getActionValue(action: CardAction): number {
  // Special actions apply their effect directly — no attack/block contribution
  if (isCombatSpecialAction(action)) return 0
  return action.value ?? 0
}
