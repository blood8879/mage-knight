import type {
  InteractionState,
  InteractionSiteType,
  InteractionPurchase,
  HexCoord,
  CityColor,
  AnyUnit,
} from './types'
import { ReputationManager } from './ReputationManager'

export interface InteractionActionDescriptor {
  type: InteractionPurchase['type']
  cost: number
  label: string
}

export class InteractionManager {
  private reputationManager = new ReputationManager()

  startInteraction(
    reputation: number,
    siteType: InteractionSiteType,
    siteHex: HexCoord,
    cityColor?: CityColor,
    shieldTokens?: number,
  ): InteractionState {
    if (!this.reputationManager.canInteract(reputation)) {
      throw new Error('Reputation too low to interact')
    }

    const modifier = this.reputationManager.getInfluenceModifier(reputation)

    return {
      isActive: true,
      siteType,
      siteHex,
      influencePool: modifier,
      reputationModifierApplied: true,
      purchasesMade: [],
      cityColor,
      shieldTokens: shieldTokens ?? 0,
    }
  }

  addInfluence(state: InteractionState, amount: number): InteractionState {
    return {
      ...state,
      influencePool: state.influencePool + amount,
    }
  }

  spendInfluence(
    state: InteractionState,
    cost: number,
    purchaseType: InteractionPurchase['type'],
    itemId?: number | string,
    itemName?: string,
  ): InteractionState {
    if (state.influencePool < cost) {
      throw new Error('Not enough influence')
    }

    const purchase: InteractionPurchase = {
      type: purchaseType,
      cost,
      itemId,
      itemName,
    }

    return {
      ...state,
      influencePool: state.influencePool - cost,
      purchasesMade: [...state.purchasesMade, purchase],
    }
  }

  getAvailableActions(
    siteType: InteractionSiteType,
    cityColor?: CityColor,
  ): InteractionActionDescriptor[] {
    const actions: InteractionActionDescriptor[] = []

    switch (siteType) {
      case 'village':
        actions.push({ type: 'healing', cost: 3, label: 'Heal (3 influence per wound)' })
        actions.push({ type: 'unit', cost: 0, label: 'Recruit village unit' })
        break

      case 'monastery':
        actions.push({ type: 'healing', cost: 2, label: 'Heal (2 influence per wound)' })
        actions.push({ type: 'advanced_action', cost: 6, label: 'Buy advanced action (6 influence)' })
        actions.push({ type: 'unit', cost: 0, label: 'Recruit monastery unit' })
        break

      case 'mageTower':
        actions.push({ type: 'spell', cost: 7, label: 'Buy spell (7 influence + mana)' })
        actions.push({ type: 'unit', cost: 0, label: 'Recruit unit (village/monastery)' })
        break

      case 'keep':
        actions.push({ type: 'unit', cost: 0, label: 'Recruit keep unit' })
        break

      case 'city':
        if (cityColor) {
          switch (cityColor) {
            case 'green':
              actions.push({ type: 'advanced_action', cost: 6, label: 'Buy advanced action (6 influence)' })
              break
            case 'blue':
              actions.push({ type: 'spell', cost: 7, label: 'Buy spell (7 influence + mana)' })
              break
            case 'white':
              actions.push({ type: 'unit', cost: 0, label: 'Recruit any unit' })
              break
            case 'red':
              actions.push({ type: 'artifact', cost: 12, label: 'Buy artifact (12 influence)' })
              break
          }
        }
        actions.push({ type: 'unit', cost: 0, label: 'Recruit city unit' })
        break
    }

    return actions
  }

  filterUnitsForSite(
    unitOffer: AnyUnit[],
    siteType: InteractionSiteType,
    isConquered: boolean,
    cityColor?: CityColor,
  ): AnyUnit[] {
    if (siteType === 'city' && cityColor === 'white') {
      return [...unitOffer]
    }

    const allowedSites = this.reputationManager.canRecruitAtSite(siteType, isConquered)
    if (!allowedSites) {
      return []
    }

    return unitOffer.filter((unit) =>
      unit.recruitSites.some((rs) => allowedSites.includes(rs)),
    )
  }

  getHealingCost(siteType: InteractionSiteType): number {
    switch (siteType) {
      case 'village':
        return 3
      case 'monastery':
        return 2
      default:
        return -1
    }
  }

  canPurchase(state: InteractionState, cost: number): boolean {
    return state.influencePool >= cost
  }
}
