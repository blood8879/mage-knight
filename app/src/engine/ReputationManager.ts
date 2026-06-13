import type { SiteType, RecruitSite } from './types'
import { REPUTATION_TABLE } from './GameState'

const MIN_REPUTATION = -7
const MAX_REPUTATION = 7

export class ReputationManager {
  getInfluenceModifier(reputation: number): number {
    const clamped = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation))
    const entry = REPUTATION_TABLE.find((e) => e.position === clamped)
    return entry ? entry.modifier : 0
  }

  canInteract(reputation: number): boolean {
    const clamped = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation))
    const entry = REPUTATION_TABLE.find((e) => e.position === clamped)
    return entry ? entry.canInteract : false
  }

  changeReputation(current: number, delta: number): number {
    return Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, current + delta))
  }

  /**
   * Calculate total influence for interaction.
   * Shield bonus for influence = shieldTokens × 1 (per RULES section 10.2).
   * City Leader bonus is for Hand Limit, NOT influence — removed from here.
   */
  getInteractionInfluence(
    baseInfluence: number,
    reputation: number,
    shieldTokensOnCity: number,
  ): number {
    const reputationModifier = this.getInfluenceModifier(reputation)
    // EC-06-A-2: Shield token bonus = +1 per shield token on conquered city
    return baseInfluence + reputationModifier + shieldTokensOnCity
  }

  /** @deprecated Use getInteractionInfluence instead */
  getInteractionCost(
    baseInfluence: number,
    reputation: number,
    shieldTokensOnCity: number,
    _isCityLeader?: boolean,
  ): number {
    return this.getInteractionInfluence(baseInfluence, reputation, shieldTokensOnCity)
  }

  canBuyHealing(
    playerInfluence: number,
    site: 'village' | 'monastery',
  ): { canBuy: boolean; costPerHealing: number; maxHealing: number } {
    const costPerHealing = site === 'village' ? 3 : 2
    const maxHealing = Math.floor(playerInfluence / costPerHealing)
    return {
      canBuy: maxHealing > 0,
      costPerHealing,
      maxHealing,
    }
  }

  canBuyAdvancedAction(playerInfluence: number): boolean {
    return playerInfluence >= 6
  }

  canBuySpell(playerInfluence: number, hasMatchingMana: boolean): boolean {
    return playerInfluence >= 7 && hasMatchingMana
  }

  canRecruitAtSite(site: SiteType, isConquered: boolean): RecruitSite[] | null {
    switch (site) {
      case 'village':
        return ['village']
      case 'monastery':
        return ['monastery']
      case 'keep':
        return isConquered ? ['keep'] : null
      case 'mageTower':
        return isConquered ? ['mage_tower'] : null
      case 'city':
        return isConquered ? ['city'] : null
      default:
        return null
    }
  }
}
