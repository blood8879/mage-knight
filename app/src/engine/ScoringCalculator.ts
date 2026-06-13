import type { SiteType, FinalScore, ScoreEntry } from './types'

export interface ScoringContext {
  playerName: string
  fame: number
  conqueredSites: Array<{ siteType: SiteType; shieldTokens: number }>
  advancedActionsInDeck: number
  spellsInDeck: number
  unitsOwned: number
  greatestKnowledge: boolean
  greatestLeader: boolean
  greatestConqueror: boolean
  dummyRemainingCards: number
  totalRounds: number
  roundsPlayed: number
  didNotDeclareEndOfRound: boolean
}

export interface SoloConquestScoringContext {
  playerName: string
  fame: number
  citiesConquered: number
  totalCities: number
  allCitiesConquered: boolean
  roundsRemaining: number
  dummyRemainingCards: number
  didNotDeclareEndOfRound: boolean
}

const SCORE_RATINGS: Array<{ min: number; max: number; label: string }> = [
  { min: 0, max: 19, label: 'Rookie' },
  { min: 20, max: 39, label: 'Apprentice' },
  { min: 40, max: 59, label: 'Scout' },
  { min: 60, max: 79, label: 'Knight' },
  { min: 80, max: 99, label: 'Veteran' },
  { min: 100, max: 119, label: 'Champion' },
  { min: 120, max: Infinity, label: 'Legend' },
]

export class ScoringCalculator {
  calculateFinalScore(context: ScoringContext): FinalScore {
    const achievements: ScoreEntry[] = []

    if (context.greatestKnowledge) {
      achievements.push({
        category: 'Greatest Knowledge',
        description: 'Most Advanced Actions + Spells in deed deck',
        points: 2,
        id: 'greatestKnowledge',
      })
    }

    if (context.greatestLeader) {
      achievements.push({
        category: 'Greatest Leader',
        description: 'Most Units in Unit area',
        points: 2,
        id: 'greatestLeader',
      })
    }

    if (context.greatestConqueror) {
      achievements.push({
        category: 'Greatest Conqueror',
        description: 'Most conquered sites',
        points: 2,
        id: 'greatestConqueror',
      })
    }

    const achievementPoints = achievements.reduce((sum, a) => sum + a.points, 0)

    return {
      playerName: context.playerName,
      baseFame: context.fame,
      achievements: [...achievements],
      totalScore: context.fame + achievementPoints,
    }
  }

  calculateSoloConquestScore(context: SoloConquestScoringContext): FinalScore {
    const achievements: ScoreEntry[] = []

    const cityPoints = context.citiesConquered * 10
    if (cityPoints > 0) {
      achievements.push({
        category: 'Cities Conquered',
        description: `${context.citiesConquered} cities conquered (10 points each)`,
        points: cityPoints,
        id: 'citiesConquered',
        params: { count: context.citiesConquered },
      })
    }

    if (context.allCitiesConquered) {
      achievements.push({
        category: 'All Cities Conquered',
        description: 'Bonus for conquering all cities',
        points: 15,
        id: 'allCitiesConquered',
      })
    }

    if (context.roundsRemaining > 0) {
      const earlyFinishPoints = context.roundsRemaining * 30
      achievements.push({
        category: 'Early Finish',
        description: `${context.roundsRemaining} rounds remaining (30 points each)`,
        points: earlyFinishPoints,
        id: 'earlyFinish',
        params: { count: context.roundsRemaining },
      })
    }

    if (context.dummyRemainingCards > 0) {
      achievements.push({
        category: 'Dummy Remaining Cards',
        description: `${context.dummyRemainingCards} cards remaining in dummy deck`,
        points: context.dummyRemainingCards,
        id: 'dummyRemainingCards',
        params: { count: context.dummyRemainingCards },
      })
    }

    if (context.didNotDeclareEndOfRound) {
      achievements.push({
        category: 'Endurance',
        description: 'Did not declare end of round in final round',
        points: 5,
        id: 'endurance',
      })
    }

    const achievementPoints = achievements.reduce((sum, a) => sum + a.points, 0)

    return {
      playerName: context.playerName,
      baseFame: context.fame,
      achievements: [...achievements],
      totalScore: context.fame + achievementPoints,
    }
  }

  getScoreRating(totalScore: number): string {
    for (const rating of SCORE_RATINGS) {
      if (totalScore >= rating.min && totalScore <= rating.max) {
        return rating.label
      }
    }
    return 'Rookie'
  }

  compareScores(a: FinalScore, b: FinalScore): number {
    return a.totalScore - b.totalScore
  }
}
