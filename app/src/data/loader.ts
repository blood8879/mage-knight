import advancedActionsData from '@data/advanced_actions.json'
import spellsData from '@data/spells.json'
import artifactsData from '@data/artifacts.json'
import unitsRegularData from '@data/units_regular.json'
import unitsEliteData from '@data/units_elite.json'
import basicActionsData from '@data/basic_actions.json'
import enemiesData from '@data/enemies.json'
import tacticsData from '@data/tactics.json'
import arytheaData from '@data/heroes/arythea.json'
import norowasData from '@data/heroes/norowas.json'
import goldyxData from '@data/heroes/goldyx.json'
import tovakData from '@data/heroes/tovak.json'
import firstReconData from '@data/scenarios/first_recon.json'
import tilesData from '@data/tiles.json'
import sitesData from '@data/sites.json'

import type {
  AdvancedActionCard,
  SpellCard,
  ArtifactCard,
  RegularUnit,
  EliteUnit,
  BasicActionCard,
  EnemyToken,
} from '@/engine/types'

// ── Local types for data not modeled in engine/types ──

interface CardEffect {
  text: string
  manaCost?: string
  actions: Array<{
    type: string
    value?: number
    color?: string
    element?: string
    choice?: boolean
    condition?: string
    bonusValue?: number
    rule?: string
    transferOne?: boolean
  }>
}

interface DeckCard {
  name: string
  color: string
  copies: number
  replaces?: string
  basicEffect?: CardEffect
  strongEffect?: CardEffect
}

export interface HeroSkillData {
  id: number
  name: string
  type: string
  effect: string
  actions: Array<{
    type: string
    value?: number
    color?: string
    element?: string
    choice?: boolean
    condition?: string
    bonusValue?: number
    rule?: string
    transferOne?: boolean
  }>
}

interface LevelEntry {
  level: number
  fameRequired: number
  armor: number
  handLimit: number
  unitLimit: number
  reward: string
}

export interface HeroData {
  name: string
  title: string
  startingStats: {
    armor: number
    handLimit: number
    unitLimit: number
  }
  startingDeck: {
    totalCards: number
    commonCards: DeckCard[]
    uniqueCard: DeckCard
    expansionReplacement: DeckCard
  }
  skills: HeroSkillData[]
  cooperativeSkill: {
    name: string
    effect: string
  }
  levelProgression: LevelEntry[]
}

interface SpecialRule {
  id: string
  description: string
}

interface AchievementBonus {
  name: string
  description: string
  points: number
}

export interface ScenarioData {
  name: string
  type: string
  playerCount: {
    min: number
    max: number
  }
  rounds: {
    total: number
    pattern: string[]
  }
  mapSetup: {
    startingTile: string
    shape: string
    countrysideTiles: {
      solo: number
      twoPlayer: number
      threePlayer: number
      fourPlayer: number
    }
    coreTiles: {
      city: number
      nonCity: number
      total: number
    }
  }
  victoryConditions: {
    endTrigger: string
    winner: string
  }
  specialRules: SpecialRule[]
  soloSetup: {
    usePlayerCount: number
    useDummyPlayer: boolean
    dummyPlayerCards: number
    dummyPlayerTacticSelection: string
  }
  scoring: {
    baseFame: boolean
    achievementBonuses: AchievementBonus[]
  }
}

interface StartingTile {
  id: string
  name: string
  sides: string[]
  hexCount: number
  features: Record<string, { portal: boolean; description: string }>
}

interface CountrysideTile {
  id: number
  name: string
  back: string
  hexCount: number
  set: string
}

interface CoreTile {
  id: number
  name: string
  back: string
  hexCount: number
  hasCity: boolean
  cityColor?: string
  set: string
}

interface TerrainInfo {
  type: string
  moveCostDay: number | null
  moveCostNight: number | null
  passable?: boolean
}

export interface TileData {
  startingTile: StartingTile
  countrysideTiles: CountrysideTile[]
  coreTiles: CoreTile[]
  terrainTypes: TerrainInfo[]
}

interface SiteInteraction {
  type: string
  description: string
  cost?: Record<string, string | number>
  reward?: string | Record<string, number>
  reputationCost?: number
  requiresOwnership?: boolean
  condition?: string
}

export interface SiteData {
  id: number
  type: string
  name: string
  enemyColor: string | null
  enemyNote?: string
  isFortified: boolean
  special?: string
  interactions: SiteInteraction[]
}

export interface TacticCardData {
  id: number
  name: string
  type: 'day' | 'night'
  number: number
  effect: string
}

// ── Existing accessor functions (unchanged) ──

export function getAdvancedActions(): AdvancedActionCard[] {
  return (advancedActionsData as { cards: AdvancedActionCard[] }).cards
}

export function getSpells(): SpellCard[] {
  return (spellsData as { cards: SpellCard[] }).cards
}

export function getArtifacts(): ArtifactCard[] {
  return (artifactsData as { cards: ArtifactCard[] }).cards
}

export function getRegularUnits(): RegularUnit[] {
  return (unitsRegularData as { units: RegularUnit[] }).units
}

export function getEliteUnits(): EliteUnit[] {
  return (unitsEliteData as { units: EliteUnit[] }).units
}

export function getBasicActions(): {
  commonCards: BasicActionCard[]
  heroSpecificCards: BasicActionCard[]
} {
  const data = basicActionsData as {
    commonCards: BasicActionCard[]
    heroSpecificCards: BasicActionCard[]
  }
  return {
    commonCards: data.commonCards,
    heroSpecificCards: data.heroSpecificCards,
  }
}

// ── New accessor functions ──

export function getEnemies(): EnemyToken[] {
  return (enemiesData as { enemies: EnemyToken[] }).enemies
}

export function getTactics(): { dayTactics: TacticCardData[]; nightTactics: TacticCardData[] } {
  const allTactics = (tacticsData as { tactics: TacticCardData[] }).tactics
  return {
    dayTactics: allTactics.filter((t) => t.type === 'day'),
    nightTactics: allTactics.filter((t) => t.type === 'night'),
  }
}

export function getArythea(): HeroData {
  return (arytheaData as { hero: HeroData }).hero
}

/** Norowas skill tokens — used for the solo dummy player's skill deck (EC-09-A-3) */
export function getNorowasSkills(): HeroSkillData[] {
  return (norowasData as unknown as { hero: { skills: HeroSkillData[] } }).hero.skills
}

/** Goldyx skill tokens — prepared for hero selection / dummy skill decks */
export function getGoldyxSkills(): HeroSkillData[] {
  return (goldyxData as unknown as { hero: { skills: HeroSkillData[] } }).hero.skills
}

/** Tovak skill tokens — prepared for hero selection / dummy skill decks */
export function getTovakSkills(): HeroSkillData[] {
  return (tovakData as unknown as { hero: { skills: HeroSkillData[] } }).hero.skills
}

/** Playable heroes for the solo scenario */
export const PLAYABLE_HEROES = ['Arythea', 'Tovak', 'Goldyx', 'Norowas'] as const
export type HeroName = (typeof PLAYABLE_HEROES)[number]

/** Skill tokens for any hero (used for the player's skill deck and the dummy pool) */
export function getHeroSkills(heroName: string): HeroSkillData[] {
  switch (heroName) {
    case 'Goldyx': return getGoldyxSkills()
    case 'Tovak': return getTovakSkills()
    case 'Norowas': return getNorowasSkills()
    case 'Arythea':
    default: return getArythea().skills
  }
}

export function getFirstReconScenario(): ScenarioData {
  return (firstReconData as { scenario: ScenarioData }).scenario
}

export function getTiles(): TileData {
  const data = tilesData as TileData & { _meta: unknown }
  return {
    startingTile: data.startingTile,
    countrysideTiles: data.countrysideTiles,
    coreTiles: data.coreTiles,
    terrainTypes: data.terrainTypes,
  }
}

export function getSites(): SiteData[] {
  return (sitesData as { sites: SiteData[] }).sites
}

// ── Aggregate accessors ──

export function getAllCardData() {
  return {
    advancedActions: getAdvancedActions(),
    spells: getSpells(),
    artifacts: getArtifacts(),
    regularUnits: getRegularUnits(),
    eliteUnits: getEliteUnits(),
    basicActions: getBasicActions(),
  }
}

export function getAllGameData() {
  return {
    ...getAllCardData(),
    enemies: getEnemies(),
    tactics: getTactics(),
    arythea: getArythea(),
    firstReconScenario: getFirstReconScenario(),
    tiles: getTiles(),
    sites: getSites(),
  }
}
