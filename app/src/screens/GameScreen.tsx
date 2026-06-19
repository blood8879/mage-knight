import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameEngine } from '@/hooks/useGameEngine'
import { useSaveLoad } from '@/hooks/useSaveLoad'
import { saveService } from '@/services/saveService'
import { useMovement } from '@/hooks/useMovement'
import { useCombat } from '@/hooks/useCombat'
import { useDragDrop } from '@/hooks/useDragDrop'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useTutorialProgress } from '@/hooks/useTutorialProgress'
import TopBar from '@/components/layout/TopBar'
import BottomPanel from '@/components/layout/BottomPanel'
import LearnByPlayingGuide from '@/components/learn/LearnByPlayingGuide'
import type { LearnContext } from '@/data/learnGuide'
import HexMap from '@/components/map/HexMap'
import CombatView from '@/components/combat/CombatView'
import InteractionPanel from '@/components/interaction/InteractionPanel'
import TileInfoPopup from '@/components/map/TileInfoPopup'
import FameTrack from '@/components/tracks/FameTrack'
import ReputationTrack from '@/components/tracks/ReputationTrack'
import ManaPoolDisplay from '@/components/tracks/ManaPoolDisplay'
import UnitSlots from '@/components/tracks/UnitSlots'
import UnitAbilityOverlay from '@/components/tracks/UnitAbilityOverlay'
import SkillPanel from '@/components/tracks/SkillPanel'
import CardOffer from '@/components/cards/CardOffer'
import Modal from '@/components/common/Modal'
import GameTips from '@/components/common/GameTips'
import EventToasts from '@/components/common/EventToasts'
import InteractiveTutorial from '@/components/common/InteractiveTutorial'
import { RoundTransition, TurnTransition } from '@/components/common/Transitions'
import AdInterstitial from '@/components/ads/AdInterstitial'
import CardSelectionOverlay from '@/screens/CardSelectionOverlay'
import DieSelectionOverlay from '@/screens/DieSelectionOverlay'
import LevelUpOverlay from '@/components/levelup/LevelUpOverlay'
import RewardOverlay from '@/components/combat/RewardOverlay'
import type { HexCoord, ManaColor, GamePhase, TacticCard, HexCell, RestType, DeedCard, CardEffect, CardAction } from '@/engine/types'
import { CHOICE_PICKER_TYPES, parseColorSpec } from '@/engine/CardEffectResolver'
import type { TutorialSnapshot } from '@/engine/TutorialChapters'
import { getChapter } from '@/engine/TutorialChapters'
import { hexKey, hexNeighbors } from '@/utils/hexMath'

const DEFAULT_SNAPSHOT: TutorialSnapshot = {
  phase: 'setup',
  combatPhase: undefined,
  combatActive: false,
  playerPosition: { q: 0, r: 0 },
  cardsInPlayArea: 0,
  cardsInHand: 0,
  manaTokenCount: 0,
  crystalTotal: 0,
  sourceDieTaken: false,
  unitCount: 0,
  fame: 0,
  level: 1,
  reputation: 0,
  turnType: 'regular',
  dayNight: 'day',
  tilesRevealed: 0,
  interactionActive: false,
  movePointsAvailable: 0,
  hasMovedThisTurn: false,
  hasActedThisTurn: false,
  woundsInHand: 0,
}

function getPhaseHint(phase: GamePhase, t: (key: string, options?: { defaultValue: string }) => string): string | undefined {
  const result = t(`game.phaseHint.${phase}`, { defaultValue: '' })
  return result || undefined
}

// Maps SiteType to the numeric key used in the `sites` translation namespace
const SITE_I18N_INDEX: Record<string, number> = {
  village: 1,
  monastery: 2,
  keep: 3,
  mageTower: 4,
  dungeon: 5,
  tomb: 6,
  ancientRuins: 7,
  monsterDen: 8,
  spawningGrounds: 9,
  crystalMine: 10,
  magicalGlade: 11,
  city: 12,
  portal: 13,
}

type Translator = (key: string, options?: Record<string, unknown>) => string

function getSiteLabel(cell: HexCell, t: Translator, tSites: Translator): string | null {
  if (!cell.siteData) return null
  const { type, isConquered, cityColor, mineColor } = cell.siteData
  const idx = SITE_I18N_INDEX[type]
  if (!idx) return null
  const baseName = tSites(`${idx}.name`, { defaultValue: type })

  if (type === 'keep' && isConquered) {
    return t('game.siteOwnedLabel', { defaultValue: `${baseName} (owned)`, site: baseName })
  }
  if ((type === 'mageTower' || type === 'city') && isConquered) {
    return t('game.siteConqueredLabel', { defaultValue: `${baseName} (conquered)`, site: baseName })
  }
  if (type === 'city' && cityColor) {
    return t('game.siteColorPrefix', {
      defaultValue: `${cityColor} ${baseName}`,
      color: t(`colors.${cityColor}`, { defaultValue: cityColor }),
      site: baseName,
    })
  }
  if (type === 'crystalMine' && mineColor) {
    return t('game.siteColorPrefix', {
      defaultValue: `${mineColor} ${baseName}`,
      color: t(`colors.${mineColor}`, { defaultValue: mineColor }),
      site: baseName,
    })
  }
  return baseName
}

function getOpportunityPriority(cell: HexCell): number {
  if (cell.enemyTokens.length > 0) return 0
  if (cell.siteData?.type === 'village' || cell.siteData?.type === 'monastery') return 1
  if (cell.siteData) return 2
  return 3
}

// ── Card decision helpers (choice effects & open-color gains) ──

const FIXED_BASIC_COLORS = new Set(['red', 'blue', 'green', 'white'])
const FIXED_ANY_COLORS = new Set(['red', 'blue', 'green', 'white', 'gold', 'black'])

const COLOR_SWATCH: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  white: 'bg-slate-200',
  gold: 'bg-amber-400',
  black: 'bg-neutral-900 ring-1 ring-neutral-500',
}

function getEffectForMode(card: DeedCard, mode: 'basic' | 'strong'): CardEffect | null {
  if (card.type === 'spell') return mode === 'strong' ? card.strongSpell : card.basicSpell
  if ('basicEffect' in card) return mode === 'strong' ? card.strongEffect : card.basicEffect
  return null
}

/** Color picks (in order) the engine will consume for this effect's open-color gains. */
function computeColorQueue(
  effect: CardEffect,
  chosenActionIndex: number | undefined,
  dayNight: 'day' | 'night',
): { allowed: string[] }[] {
  const actions = effect.actions.filter(
    (a, i) => !(a.choice && CHOICE_PICKER_TYPES.has(a.type)) || i === chosenActionIndex,
  )
  const queue: { allowed: string[] }[] = []
  for (const a of actions) {
    const spec = String(a.color ?? '')
    if (a.type === 'gain_crystal' && !FIXED_BASIC_COLORS.has(spec)) {
      queue.push({ allowed: parseColorSpec(spec || 'any_basic').filter((c) => c !== 'gold' && c !== 'black') })
    } else if ((a.type === 'gain_mana' || a.type === 'gain_mana_token') && !FIXED_ANY_COLORS.has(spec)) {
      const allowed = parseColorSpec(spec).filter(
        (c) => (c !== 'black' || dayNight === 'night') && (c !== 'gold' || dayNight === 'day'),
      )
      if (allowed.length === 0) continue
      const count = typeof a.count === 'number' ? a.count : 1
      for (let i = 0; i < count; i++) queue.push({ allowed })
    }
  }
  return queue
}

function decisionActionLabel(a: CardAction, t: Translator): string {
  const base = t(`game.actionType.${a.type}`, { defaultValue: a.type.replace(/_/g, ' ') })
  return typeof a.value === 'number' && a.value > 0 ? `${base} ${a.value}` : base
}

function TacticSelectionOverlay({
  tactics,
  onSelect,
}: {
  tactics: TacticCard[]
  onSelect: (id: number) => void
}) {
  const { t } = useTranslation('ui')
  const { t: tTactics } = useTranslation('tactics')

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
      <div className="mx-4 my-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-4 shadow-2xl shadow-violet-950/30 sm:p-6">
        <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
          {t('game.selectTactic', 'Select Tactic')}
        </h2>
        <p className="mb-4 text-center text-xs text-slate-500 sm:mb-5">
          {t('game.tacticHint', 'Choose a tactic card for this round')}
        </p>

        {tactics.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-600 italic">
            {t('game.noTactics', 'No tactics available')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tactics.map((tactic) => (
              <button
                key={tactic.id}
                type="button"
                onClick={() => onSelect(tactic.id)}
                className="group flex min-h-[44px] items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-800/60 px-3 py-3 text-left transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.98] sm:items-center sm:px-4"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 font-mono text-sm font-bold text-violet-400 ring-1 ring-violet-500/30 transition-colors group-hover:bg-violet-600/30 sm:mt-0">
                  {tactic.number}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-200">
                    {tTactics(`${tactic.id}.name`, { defaultValue: tactic.name })}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                    {tTactics(`${tactic.id}.effect`, { defaultValue: tactic.effect })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoundTransitionOverlay({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation('ui')

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-slate-700/50 bg-slate-900 p-8 shadow-2xl">
        <span className="text-4xl">{'\uD83D\uDCDC'}</span>
        <h2 className="text-lg font-black tracking-wide text-slate-100">
          {t('game.roundComplete', 'Round Complete')}
        </h2>
        <p className="text-center text-sm text-slate-400">
          {t('game.roundTransition', 'Prepare for the next round')}
        </p>
        <button
          type="button"
          onClick={onContinue}
          aria-label={t('game.continue', 'Continue')}
          className="rounded-lg bg-violet-600 px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition-all hover:bg-violet-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {t('game.continue', 'Continue')}
        </button>
      </div>
    </div>
  )
}

function GameOverOverlay() {
  const { t } = useTranslation('ui')

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-5xl">{'\uD83C\uDFC6'}</span>
        <h2 className="text-2xl font-extrabold text-amber-400">
          {t('score.title', 'Game Over')}
        </h2>
        <p className="text-sm text-slate-400">
          {t('game.calculatingScore', 'Calculating final score\u2026')}
        </p>
      </div>
    </div>
  )
}

export default function GameScreen() {
  const { t } = useTranslation('ui')
  const { t: tSites } = useTranslation('sites')
  const engine = useGameEngine()
  const movement = useMovement()
  const combat = useCombat()

  const phase = useGameStore((s) => s.phase)
  const isTutorialMode = useGameStore((s) => s.isTutorialMode)
  const tutorialChapter = useGameStore((s) => s.tutorialChapter)
  const learnMode = useGameStore((s) => s.learnMode)
  const selectedHero = useGameStore((s) => s.selectedHero)
  const fame = useGameStore((s) => s.fame)
  const reputation = useGameStore((s) => s.reputation)
  const level = useGameStore((s) => s.level)
  const dayNight = useGameStore((s) => s.dayNight)
  const isGameOver = useGameStore((s) => s.isGameOver)
  const engineState = useGameStore((s) => s.engineState)
  const modalOpen = useUIStore((s) => s.modalOpen)
  const closeModal = useUIStore((s) => s.closeModal)
  const navigate = useUIStore((s) => s.navigate)

  const round = useGameStore((s) => s.round)
  const { markChapterComplete } = useTutorialProgress()

  // Autosave at every turn/round boundary (disabled in tutorial mode)
  useSaveLoad({
    gameState: isTutorialMode ? null : engineState,
    onLoadState: engine.restoreGame,
  })

  const chapter = tutorialChapter ? getChapter(tutorialChapter) ?? null : null

  const tutorialSnapshot = useMemo<TutorialSnapshot>(() => {
    if (!engineState) return DEFAULT_SNAPSHOT
    return {
      phase: engineState.phase,
      combatPhase: engineState.combat.phase,
      combatActive: engineState.combat.isActive,
      playerPosition: engineState.player.position,
      cardsInPlayArea: engineState.player.deck.playArea.length,
      cardsInHand: engineState.player.deck.hand.length,
      manaTokenCount: engineState.player.mana.playerMana.length,
      crystalTotal: Object.values(engineState.player.mana.crystals).reduce((a, b) => a + b, 0),
      sourceDieTaken: engineState.player.mana.sourceDieTakenThisTurn,
      unitCount: engineState.player.units.length,
      fame: engineState.player.fame,
      level: engineState.player.level,
      reputation: engineState.player.reputation,
      turnType: engineState.player.turn.turnType,
      dayNight: engineState.dayNight,
      tilesRevealed: engineState.map.tiles.filter(t => t.isRevealed).length,
      interactionActive: engineState.phase === 'interaction',
      movePointsAvailable: engineState.player.turn.movePointsAvailable,
      hasMovedThisTurn: engineState.player.turn.hasMovedThisTurn,
      hasActedThisTurn: engineState.player.turn.cardsPlayedThisTurn.length > 0,
      woundsInHand: engineState.player.deck.hand.filter(c => c.type === 'wound').length,
    }
  }, [engineState])

  const drag = useDragDrop()
  const playZoneRef = useRef<HTMLDivElement>(null)
  const discardZoneRef = useRef<HTMLDivElement>(null)

  const [showRoundTransition, setShowRoundTransition] = useState(false)
  const [showTurnBanner, setShowTurnBanner] = useState(false)
  const [showInterstitial, setShowInterstitial] = useState(false)
  const [isFirstCombat, setIsFirstCombat] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [selectedTileInfo, setSelectedTileInfo] = useState<HexCell | null>(null)
  const [cardSelectionMode, setCardSelectionMode] = useState<{
    mode: 'rethink' | 'preparation' | 'meditation'
    tacticId: number
  } | null>(null)
  const [dieSelectionMode, setDieSelectionMode] = useState<{
    mode: 'mana_steal' | 'mana_search'
    tacticId: number
  } | null>(null)
  const [restMode, setRestMode] = useState<RestType | null>(null)
  const [improvisationMode, setImprovisationMode] = useState<{
    cardIndex: number
    value: number
    step: 'discard' | 'choose'
    discardIndex?: number
  } | null>(null)
  const [bannerAttachMode, setBannerAttachMode] = useState<{ handIndex: number } | null>(null)
  // Offering / Sacrifice (basic): pick up to 3 non-Wound cards to discard for crystals
  const [offeringMode, setOfferingMode] = useState<{ handIndex: number } | null>(null)
  // Peaceful Moment: choose Influence (normal) vs Heal (spend influence 2:1)
  const [peacefulMode, setPeacefulMode] = useState<{ handIndex: number; mode: 'basic' | 'strong' } | null>(null)
  // Song of Wind (strong): optionally pay a blue mana for lake travel
  const [songWindMode, setSongWindMode] = useState<{ handIndex: number } | null>(null)
  // Blood of Ancients: basic = pay a mana → gain a matching-colour AA from
  // offer; strong = use any offer AA's strong effect for free.
  const [bloodMode, setBloodMode] = useState<{ handIndex: number; mode: 'basic' | 'strong' } | null>(null)
  // Concentration / Will Focus strong: pick the Action card to combo with
  const [comboMode, setComboMode] = useState<{
    handIndex: number
    bonus: number
    skipCost?: boolean
    eligible: { index: number }[]
  } | null>(null)
  // Cards whose effect needs a player decision (Tranquility heal-vs-draw, Crystallize color…)
  const [cardDecisionMode, setCardDecisionMode] = useState<{
    handIndex: number
    mode: 'basic' | 'strong'
    cardName: string
    actionOptions: { actionIndex: number; label: string }[] | null
    chosenActionIndex?: number
    colorQueue: { allowed: string[] }[]
    chosenColors: string[]
  } | null>(null)
  const [unitAbilityIndex, setUnitAbilityIndex] = useState<number | null>(null)
  const prevPhaseRef = useRef<GamePhase>(phase)

  useEffect(() => {
    function syncZones() {
      if (playZoneRef.current) {
        const r = playZoneRef.current.getBoundingClientRect()
        drag.registerDropZone('play-area', { id: 'play-area', left: r.left, top: r.top, right: r.right, bottom: r.bottom })
      }
      if (discardZoneRef.current) {
        const r = discardZoneRef.current.getBoundingClientRect()
        drag.registerDropZone('discard-pile', { id: 'discard-pile', left: r.left, top: r.top, right: r.right, bottom: r.bottom })
      }
    }
    syncZones()
    window.addEventListener('resize', syncZones)
    return () => {
      window.removeEventListener('resize', syncZones)
      drag.unregisterDropZone('play-area')
      drag.unregisterDropZone('discard-pile')
    }
  }, [drag.registerDropZone, drag.unregisterDropZone])

  const handleCardDrop = useCallback(
    (handIndex: number, zoneId: string) => {
      if (zoneId === 'play-area') {
        engine.playCard(handIndex)
      } else if (zoneId === 'discard-pile') {
        engine.discardCard(handIndex)
      }
    },
    [engine],
  )

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (phase === prev) return

    if (phase === 'round_start' && prev !== 'setup') {
      setShowRoundTransition(true)
    }

    if (phase === 'player_turn_start' && prev !== 'setup') {
      setShowTurnBanner(true)
    }

    if (phase === 'combat_ranged_siege' && isFirstCombat) {
      setIsFirstCombat(false)
    }
  }, [phase, isFirstCombat])

  useEffect(() => {
    if (!engine.isInitialized) {
      if (isTutorialMode) {
        engine.initializeTutorial(tutorialChapter ?? 1)
      } else {
        engine.initializeGame(selectedHero, { learn: learnMode })
      }
    }
  }, [engine, isTutorialMode, tutorialChapter, selectedHero, learnMode])

  useEffect(() => {
    if (phase === 'player_turn_start' && engineState && engineState.turnCount === 0) {
      engine.startTurn()
    }
  }, [phase, engineState, engine])


  useEffect(() => {
    if (isGameOver && phase === 'game_over') {
      engine.calculateFinalScore()
      // A finished game can no longer be continued
      if (!isTutorialMode) void saveService.deleteAutoSave()
      const timeout = setTimeout(() => {
        navigate('score')
      }, 1200)
      return () => clearTimeout(timeout)
    }
  }, [isGameOver, phase, engine, navigate, isTutorialMode])

  const getHexAt = useCallback(
    (q: number, r: number): HexCell | undefined => {
      if (!engineState) return undefined
      return engineState.map.hexGrid.get(hexKey({ q, r }))
    },
    [engineState],
  )

  const enemiesNearby = useMemo(() => {
    if (!engineState) return null

    const playerPos = engineState.player.position
    const currentHex = getHexAt(playerPos.q, playerPos.r)

    if (currentHex && currentHex.enemyTokens.length > 0) {
      return {
        hex: currentHex,
        enemyTokens: currentHex.enemyTokens,
        isFortified: currentHex.siteData?.type === 'keep' ||
                     currentHex.siteData?.type === 'mageTower' ||
                     currentHex.siteData?.type === 'city',
        cityColor: currentHex.siteData?.cityColor,
      }
    }

    // Only rampaging enemies (orc marauders / draconum on open hexes with no
    // site) may be challenged from an adjacent space. Fortified sites
    // (keep/mageTower/city) and adventure sites must be assaulted/entered by
    // moving ONTO their hex — they cannot be fought from one tile away
    // (rulebook p.7).
    const neighbors = hexNeighbors(playerPos)
    for (const neighbor of neighbors) {
      const neighborHex = getHexAt(neighbor.q, neighbor.r)
      if (neighborHex && neighborHex.enemyTokens.length > 0 && !neighborHex.siteData) {
        return {
          hex: neighborHex,
          enemyTokens: neighborHex.enemyTokens,
          isFortified: false,
          cityColor: undefined,
        }
      }
    }

    return null
  }, [engineState, getHexAt])

  const interactableSite = useMemo(() => {
    if (!engineState) return null
    const playerPos = engineState.player.position
    const currentHex = getHexAt(playerPos.q, playerPos.r)
    if (!currentHex?.siteData) return null

    // Can't interact when enemies are present on this hex (must fight first)
    if (currentHex.enemyTokens.length > 0 && !currentHex.siteData.isConquered) return null

    const { type, isConquered, owner, cityColor } = currentHex.siteData
    const playerName = engineState.player.name

    if (type === 'village' || type === 'monastery') return { type, cityColor }
    if (type === 'keep' && owner === playerName) return { type, cityColor }
    if (type === 'mageTower' && isConquered) return { type, cityColor }
    if (type === 'city' && isConquered) return { type, cityColor }

    return null
  }, [engineState, getHexAt])

  const reachableOpportunities = useMemo(() => {
    if (!engineState || !movement.reachableHexes || movement.reachableHexes.size === 0) return []

    const playerPos = engineState.player.position
    return Array.from(movement.reachableHexes.entries())
      .map(([key, remaining]) => {
        const [q, r] = key.split(',').map(Number)
        const coord: HexCoord = { q, r }
        const cell = getHexAt(q, r)
        if (!cell) return null
        if (coord.q === playerPos.q && coord.r === playerPos.r) return null
        if (cell.siteData?.type === 'portal') return null

        const siteLabel = getSiteLabel(cell, t, tSites)
        const enemyCount = cell.enemyTokens.length
        if (!siteLabel && enemyCount === 0) return null

        const label = enemyCount > 0
          ? siteLabel
            ? t('game.oppEnemiesAt', {
                defaultValue: `${enemyCount} enemy at ${siteLabel}`,
                count: enemyCount,
                site: siteLabel,
              })
            : t('game.oppEnemies', { defaultValue: `${enemyCount} enemy`, count: enemyCount })
          : siteLabel ?? t('game.oppReachableHex', { defaultValue: 'Reachable hex' })

        const outcome = enemyCount > 0
          ? t('game.oppFight', { defaultValue: 'Fight after moving here' })
          : cell.siteData && (cell.siteData.type === 'village' || cell.siteData.type === 'monastery' || cell.siteData.isConquered)
            ? t('game.oppInteract', { defaultValue: 'Interact after moving here' })
            : t('game.oppExplore', { defaultValue: 'Explore this location' })

        return {
          coord,
          label,
          outcome,
          remaining,
          priority: getOpportunityPriority(cell),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.priority - b.priority || b.remaining - a.remaining || a.label.localeCompare(b.label))
      .slice(0, 5)
  }, [engineState, movement.reachableHexes, getHexAt, t, tSites])

  const handleHexClick = useCallback(
    (coord: HexCoord) => {
      if (phase === 'movement') {
        // 1) Tapping a valid placement explores the unrevealed tile
        if (movement.exploreAt(coord)) return
        // 2) Tapping a reachable hex selects it as a move destination
        const key = `${coord.q},${coord.r}`
        if (movement.reachableHexes?.has(key)) {
          movement.selectHex(coord)
          return
        }
        // 3) Otherwise fall through to show tile/enemy info (so distant
        //    monsters and tiles can still be inspected during movement)
      }
      const cell = getHexAt(coord.q, coord.r)
      if (cell) {
        setSelectedTileInfo(cell)
      }
    },
    [phase, movement, getHexAt],
  )

  const handleFightClick = useCallback(() => {
    if (enemiesNearby) {
      combat.startCombat(
        enemiesNearby.enemyTokens,
        enemiesNearby.isFortified,
        enemiesNearby.cityColor,
        enemiesNearby.hex.coord,
      )
    }
  }, [enemiesNearby, combat])

  const handleInteractClick = useCallback(() => {
    engine.startInteraction()
  }, [engine])

  const handleSelectTactic = useCallback(
    (tacticId: number) => {
      if (tacticId === 2) {
        setCardSelectionMode({ mode: 'rethink', tacticId })
        return
      }
      if (tacticId === 3) {
        setDieSelectionMode({ mode: 'mana_steal', tacticId: 3 })
        return
      }
      if (tacticId === 11) {
        setCardSelectionMode({ mode: 'preparation', tacticId })
        return
      }
      engine.selectTactic(tacticId)
    },
    [engine],
  )

  const handleMeditationSelect = useCallback(() => {
    setCardSelectionMode({ mode: 'meditation', tacticId: 10 })
  }, [])

  const handleCardSelectionConfirm = useCallback(
    (selectedIndices: number[]) => {
      if (!cardSelectionMode) return

      if (cardSelectionMode.mode === 'rethink') {
        engine.selectTactic(cardSelectionMode.tacticId, { rethinkDiscardIndices: selectedIndices })
      } else if (cardSelectionMode.mode === 'preparation') {
        engine.selectTactic(cardSelectionMode.tacticId, { preparationCardIndex: selectedIndices[0] })
      } else if (cardSelectionMode.mode === 'meditation') {
        engine.activateTacticEffect('midnight_meditation', { midnightMeditationCardIndices: selectedIndices })
      }

      setCardSelectionMode(null)
    },
    [cardSelectionMode, engine],
  )

  const handleCardSelectionCancel = useCallback(() => {
    if (!cardSelectionMode) return

    if (cardSelectionMode.mode === 'rethink') {
      engine.selectTactic(cardSelectionMode.tacticId, { rethinkDiscardIndices: [] })
    }

    setCardSelectionMode(null)
  }, [cardSelectionMode, engine])

  const handleDieSelectionConfirm = useCallback(
    (selectedDieIds: string[]) => {
      if (!dieSelectionMode) return

      if (dieSelectionMode.mode === 'mana_steal') {
        engine.selectTactic(dieSelectionMode.tacticId, { manaStealDieId: selectedDieIds[0] })
      } else if (dieSelectionMode.mode === 'mana_search') {
        engine.activateTacticEffect('mana_search', { manaSearchDieIds: selectedDieIds })
      }

      setDieSelectionMode(null)
    },
    [dieSelectionMode, engine],
  )

  const handleDieSelectionCancel = useCallback(() => {
    if (!dieSelectionMode) return

    if (dieSelectionMode.mode === 'mana_steal') {
      engine.selectTactic(dieSelectionMode.tacticId)
    }

    setDieSelectionMode(null)
  }, [dieSelectionMode, engine])

  const handleCardPlay = useCallback(
    (index: number, mode?: 'basic' | 'strong') => {
      if (!engineState) return
      const card = engineState.player.deck.hand[index]
      if (card && card.type !== 'wound' && 'name' in card && card.name === 'Improvisation') {
        setImprovisationMode({ cardIndex: index, value: 3, step: 'discard' })
        return
      }
      // EC-02-C-3: Banner basic effect = attach to a unit (when one is eligible)
      if (
        (mode ?? 'basic') === 'basic' &&
        card?.type === 'artifact' &&
        card.subtype === 'banner' &&
        engineState.player.units.some((u) => !u.bannerCard)
      ) {
        setBannerAttachMode({ handIndex: index })
        return
      }
      // Concentration / Will Focus strong, Maximal Effect (both modes):
      // combo with another Action card
      if (
        (card?.type === 'basic_action' || card?.type === 'advanced_action') &&
        ((card.name === 'Concentration' || card.name === 'Will Focus') && mode === 'strong' ||
          card.name === 'Maximal Effect')
      ) {
        const eligible = engineState.player.deck.hand
          .map((c, i) => ({ c, index: i }))
          .filter(({ c, index: i }) => i !== index && (c.type === 'basic_action' || c.type === 'advanced_action'))
          .map(({ index: i }) => ({ index: i }))
        if (eligible.length === 0) return
        setComboMode({
          handIndex: index,
          bonus: card.name === 'Will Focus' ? 3 : card.name === 'Concentration' ? 2 : 0,
          skipCost: card.name === 'Maximal Effect' && (mode ?? 'basic') === 'basic',
          eligible,
        })
        return
      }
      // Crystallize basic: pick which basic-color mana to pay (→ crystal of that color)
      if (card?.type === 'basic_action' && card.name === 'Crystallize' && (mode ?? 'basic') === 'basic') {
        const mana = engineState.player.mana
        const payable = (['red', 'blue', 'green', 'white'] as const).filter(
          (c) =>
            mana.playerMana.some((tk) => tk.color === c) ||
            mana.crystals[c] > 0 ||
            (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold')),
        )
        if (payable.length === 0) return
        setCardDecisionMode({
          handIndex: index,
          mode: 'basic',
          cardName: card.name,
          actionOptions: null,
          colorQueue: [{ allowed: [...payable] }],
          chosenColors: [],
        })
        return
      }
      // Mana Draw strong: pick the color the Source die is set to
      if (card?.type === 'basic_action' && card.name === 'Mana Draw' && mode === 'strong') {
        if (!engineState.player.mana.dice.some((d) => d.isInSource)) return
        const allowed = ['red', 'blue', 'green', 'white', ...(engineState.dayNight === 'night' ? ['black'] : [])]
        setCardDecisionMode({
          handIndex: index,
          mode: 'strong',
          cardName: card.name,
          actionOptions: null,
          colorQueue: [{ allowed }],
          chosenColors: [],
        })
        return
      }
      // Blood of Ancients (basic): pay a mana → gain a matching-colour AA from
      // the offer to hand. Show the affordable offer cards; if none are
      // affordable, fall through to a normal play (which just gains the Wound).
      if (card?.type === 'advanced_action' && card.name === 'Blood of Ancients') {
        if (mode === 'strong') {
          const m = engineState.player.mana
          const hasRed = m.playerMana.some((tk) => tk.color === 'red') || m.crystals.red > 0 ||
            (engineState.dayNight === 'day' && m.playerMana.some((tk) => tk.color === 'gold'))
          if (hasRed && engineState.offers.advancedActions.length > 0) { setBloodMode({ handIndex: index, mode: 'strong' }); return }
          return // need red mana + a non-empty offer
        }
        const mana = engineState.player.mana
        const canPay = (c: ManaColor) =>
          mana.playerMana.some((tk) => tk.color === c) || mana.crystals[c] > 0 ||
          (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'))
        const affordable = engineState.offers.advancedActions.some((oc) => {
          const cols = (Array.isArray(oc.color) ? oc.color : [oc.color]) as ManaColor[]
          return cols.some(canPay)
        })
        if (affordable) { setBloodMode({ handIndex: index, mode: 'basic' }); return }
        // else: normal play gains the Wound only
      }
      // Song of Wind (strong): offer the optional blue-mana lake-travel clause,
      // but only when a blue mana is available to pay for it.
      if (card?.type === 'advanced_action' && card.name === 'Song of Wind' && mode === 'strong') {
        const mana = engineState.player.mana
        const hasWhite = mana.playerMana.some((tk) => tk.color === 'white') || mana.crystals.white > 0 ||
          (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'))
        if (!hasWhite) return // strong needs its white mana
        const hasBlue = mana.playerMana.some((tk) => tk.color === 'blue') || mana.crystals.blue > 0
        if (hasBlue) { setSongWindMode({ handIndex: index }); return }
        engine.playCard(index, 'strong')
        return
      }
      // Peaceful Moment: offer Influence (normal) vs Heal (spend Influence 2:1).
      if (card?.type === 'advanced_action' && card.name === 'Peaceful Moment') {
        if (mode === 'strong') {
          const mana = engineState.player.mana
          const hasWhite = mana.playerMana.some((tk) => tk.color === 'white') || mana.crystals.white > 0 ||
            (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'))
          if (!hasWhite) return
        }
        setPeacefulMode({ handIndex: index, mode: mode ?? 'basic' })
        return
      }
      // Offering / Sacrifice (basic): open a multi-discard picker (up to 3
      // non-Wound cards → a crystal of each card's colour).
      if (card?.type === 'spell' && card.name.startsWith('Offering') && (mode ?? 'basic') === 'basic') {
        // Needs the red mana for the spell's basic effect.
        const mana = engineState.player.mana
        const hasRed = mana.playerMana.some((tk) => tk.color === 'red') || mana.crystals.red > 0 ||
          (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold'))
        if (!hasRed) return
        setOfferingMode({ handIndex: index })
        return
      }
      // Effects needing a player decision: pick one of the choice actions
      // (Tranquility heal-vs-draw) and/or pick colors (Crystallize, Mind Read…)
      if (card && card.type !== 'wound') {
        const effect = getEffectForMode(card as DeedCard, mode ?? 'basic')
        if (effect) {
          const actionOptions = effect.actions
            .map((a, i) => ({ a, i }))
            .filter(({ a }) => a.choice && CHOICE_PICKER_TYPES.has(a.type))
            .map(({ a, i }) => ({ actionIndex: i, label: decisionActionLabel(a, t) }))
          const colorQueue = actionOptions.length === 0
            ? computeColorQueue(effect, undefined, engineState.dayNight)
            : []
          if (actionOptions.length > 0 || colorQueue.length > 0) {
            setCardDecisionMode({
              handIndex: index,
              mode: mode ?? 'basic',
              cardName: 'name' in card ? card.name : '',
              actionOptions: actionOptions.length > 0 ? actionOptions : null,
              colorQueue,
              chosenColors: [],
            })
            return
          }
        }
      }
      engine.playCard(index, mode ?? 'basic')
    },
    [engine, engineState, t],
  )

  const handleDecisionAction = useCallback(
    (actionIndex: number) => {
      if (!cardDecisionMode || !engineState) return
      const card = engineState.player.deck.hand[cardDecisionMode.handIndex]
      if (!card || card.type === 'wound') { setCardDecisionMode(null); return }
      const effect = getEffectForMode(card as DeedCard, cardDecisionMode.mode)
      const colorQueue = effect ? computeColorQueue(effect, actionIndex, engineState.dayNight) : []
      if (colorQueue.length === 0) {
        engine.playCard(cardDecisionMode.handIndex, cardDecisionMode.mode, { chosenActionIndex: actionIndex })
        setCardDecisionMode(null)
      } else {
        setCardDecisionMode({ ...cardDecisionMode, chosenActionIndex: actionIndex, colorQueue })
      }
    },
    [cardDecisionMode, engine, engineState],
  )

  const handleDecisionColor = useCallback(
    (color: string) => {
      if (!cardDecisionMode) return
      const chosenColors = [...cardDecisionMode.chosenColors, color]
      const remaining = cardDecisionMode.colorQueue.slice(1)
      if (remaining.length === 0) {
        engine.playCard(cardDecisionMode.handIndex, cardDecisionMode.mode, {
          chosenActionIndex: cardDecisionMode.chosenActionIndex,
          chosenColors: chosenColors as (ManaColor | 'gold' | 'black')[],
        })
        setCardDecisionMode(null)
      } else {
        setCardDecisionMode({ ...cardDecisionMode, chosenColors, colorQueue: remaining })
      }
    },
    [cardDecisionMode, engine],
  )

  const handleImprovisationDiscard = useCallback(
    (selectedIndices: number[]) => {
      if (!improvisationMode || selectedIndices.length === 0) return
      setImprovisationMode({
        ...improvisationMode,
        step: 'choose',
        discardIndex: selectedIndices[0],
      })
    },
    [improvisationMode],
  )

  const handleImprovisationChoose = useCallback(
    (effectType: 'move' | 'influence' | 'attack' | 'block') => {
      if (!improvisationMode || improvisationMode.discardIndex === undefined) return
      engine.playCardWithDiscard(
        improvisationMode.cardIndex,
        improvisationMode.discardIndex,
        effectType,
        improvisationMode.value,
      )
      setImprovisationMode(null)
    },
    [improvisationMode, engine],
  )

  const handleImprovisationCancel = useCallback(() => {
    setImprovisationMode(null)
  }, [])

  const handleOfferingConfirm = useCallback(
    (selectedIndices: number[]) => {
      if (!offeringMode) return
      // Artifact discards need a chosen crystal colour; the picker only offers
      // non-Wound cards and most discards are coloured cards, so pass none here
      // (artifacts simply yield no crystal unless a colour is supplied).
      engine.playOffering(offeringMode.handIndex, selectedIndices, [])
      setOfferingMode(null)
    },
    [offeringMode, engine],
  )

  const handleActivateTactic = useCallback(
    (action: 'right_moment' | 'long_night' | 'midnight_meditation' | 'sparing_power_store' | 'sparing_power_retrieve' | 'mana_steal_use' | 'mana_search', options?: {
      midnightMeditationCardIndices?: number[]
      manaSearchDieIds?: string[]
    }) => {
      if (action === 'mana_search') {
        setDieSelectionMode({ mode: 'mana_search', tacticId: 9 })
        return
      }
      engine.activateTacticEffect(action, options)
    },
    [engine],
  )

  // Level-up & reward queues — overlays render off the head of each queue
  const pendingLevelUp = (!engineState?.combat.isActive && engineState?.pendingLevelUps?.[0]) || null
  const pendingReward =
    (!engineState?.combat.isActive &&
      (engineState?.pendingLevelUps?.length ?? 0) === 0 &&
      engineState?.pendingRewards?.[0]) ||
    null

  // Live context for the "Learn by Playing" teaching guide.
  const learnCtx: LearnContext = {
    round: engineState?.round ?? 1,
    phase,
    combatActive: engineState?.combat.isActive ?? false,
    interactionActive: engineState?.interaction?.isActive ?? false,
    hasInteractableSite: interactableSite !== null,
    hasEnemyNearby: enemiesNearby !== null,
    pendingLevelUp: !!pendingLevelUp,
    pendingReward: !!pendingReward,
    finalTurnPending: engineState?.finalTurnPending ?? false,
    movePoints: engineState?.player.turn.movePointsAvailable ?? 0,
  }

  // Safety: leave the level_up phase if there is nothing to resolve
  useEffect(() => {
    if (phase === 'level_up' && (engineState?.pendingLevelUps?.length ?? 0) === 0) {
      engine.advancePhase()
    }
  }, [phase, engineState, engine])

  const handleResolveLevelUp = useCallback(
    (params: { choice?: 'A' | 'B'; skillIndex?: number; aaCardId?: number }) => {
      engine.resolveLevelUp(params)
    },
    [engine],
  )

  const handleClaimReward = useCallback(
    (params: { artifactKeepIds?: number[]; spellCardId?: number; crystalColor?: ManaColor; chooseArtifact?: boolean }) => {
      engine.claimReward(params)
    },
    [engine],
  )

  const healingAvailable = engineState?.player.turn.healingAvailable ?? 0
  const woundsInHand = engineState?.player.deck.hand.filter((c) => c.type === 'wound').length ?? 0
  const showHealButton = healingAvailable > 0 && woundsInHand > 0 && !engineState?.combat.isActive

  const handleEndOfRound = useCallback(() => {
    setShowInterstitial(true)
  }, [])

  const handleInterstitialDone = useCallback(() => {
    setShowInterstitial(false)
    engine.processEndOfRound()
  }, [engine])

  const handleDieClick = useCallback(
    (dieId: string) => {
      engine.takeManaFromSource(dieId)
    },
    [engine],
  )

  const handleCrystalClick = useCallback(
    (color: ManaColor) => {
      engine.useCrystal(color)
    },
    [engine],
  )

  if (!engineState) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-violet-500" />
          <span className="text-sm text-slate-500">
            {t('game.loading', 'Loading\u2026')}
          </span>
        </div>
      </div>
    )
  }

  const manaState = engineState.player.mana
  const units = engineState.player.units
  const unitLimit = engineState.player.unitLimit
  const offers = engineState.offers
  // The unit offer also holds one Advanced Action per revealed Monastery
  // (buyable at a Monastery for Influence 6). Split it out so it doesn't look
  // like a stray unit in the info panel.
  const offerUnits = offers.units.filter((u) => u.type !== 'advanced_action')
  const monasteryAAs = offers.units.filter((u) => u.type === 'advanced_action')
  const phaseHint = getPhaseHint(phase, t)

  const availableTactics =
    phase === 'round_start' || phase === 'tactic_selection'
      ? engineState.availableTactics.filter((tc) => tc.type === dayNight)
      : []

  const showTacticSelection =
    (phase === 'round_start' || phase === 'tactic_selection') && availableTactics.length > 0
  const showEndOfRound = phase === 'end_of_round'
  const showMovementConfirm = movement.selectedHex !== null && movement.movePath !== null

  const showFightButton = enemiesNearby !== null &&
    (phase === 'player_turn_start' || phase === 'action_declaration')

  const showInteractButton = interactableSite !== null &&
    (phase === 'player_turn_start' || phase === 'action_declaration')

  const actionCoach = (() => {
    if (showTacticSelection) {
      return {
        title: t('game.coachTacticTitle', 'Choose a tactic'),
        body: t('game.coachTacticBody', 'Pick one card to set initiative and begin the round.'),
      }
    }
    if (phase === 'player_turn_start') {
      return {
        title: t('game.coachTurnTitle', 'Start your turn'),
        body: t('game.coachTurnBody', 'Tap a card in your hand. Use a sideways movement play to travel, or Basic/Strong effects for actions.'),
      }
    }
    if (phase === 'movement') {
      const remaining = movement.movePointsRemaining
      return {
        title: t('game.coachMoveTitle', 'Move or explore'),
        body: remaining > 0
          ? t('game.coachMoveBody', { defaultValue: `Green hexes are reachable. Tap one, then Confirm Move. Remaining Move: ${remaining}`, remaining })
          : t('game.coachNoMoveBody', 'No Move left. End turn or play more Move if you still have cards.'),
      }
    }
    if (phase === 'action_declaration') {
      return {
        title: t('game.coachActionTitle', 'Choose your action'),
        body: t('game.coachActionBody', 'Fight enemies, interact at the current site, or end your turn.'),
      }
    }
    if (phase === 'interaction') {
      return {
        title: t('game.coachInteractionTitle', 'Interaction'),
        body: t('game.coachInteractionBody', 'Play Influence cards, buy what you need, then end interaction.'),
      }
    }
    if (phase.startsWith('combat_')) {
      return {
        title: t('game.coachCombatTitle', 'Combat'),
        body: t('game.coachCombatBody', 'Use the combat tray at the bottom, confirm each phase, then end combat.'),
      }
    }
    return null
  })()

  return (
    <div className="relative flex h-full flex-col bg-slate-950" aria-label={t('game.title', 'Game')}>
      {learnMode && engineState && <LearnByPlayingGuide ctx={learnCtx} />}
      <TopBar
        onEndTurn={() => engine.endTurn()}
        onRest={(type) => {
          // EC-03-C: a hand with only wounds can never standard-rest → Slow Recovery
          const handCards = engineState?.player.deck.hand ?? []
          const hasNonWound = handCards.some((c) => c.type !== 'wound')
          if (!hasNonWound) {
            engine.declareRest('slow_recovery')
            return
          }
          if (type === 'standard') {
            setRestMode('standard')
          } else {
            engine.declareRest(type)
          }
        }}
        onDeclareEndOfRound={() => { engine.declareEndOfRound(); engine.endTurn() }}
        onUndo={() => engine.undoLastAction()}
        canUndo={engine.canUndo}
        onActivateTactic={handleActivateTactic}
        onMeditationSelect={handleMeditationSelect}
      />

      {phaseHint && (
        <div data-tutorial="phase-hint" className="flex items-center justify-center gap-2 border-b border-slate-800 bg-slate-900/70 px-3 py-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
          <span className="text-xs font-medium tracking-wide text-slate-400">
            {phaseHint}
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div data-tutorial="hex-map" className="relative flex-1">
          <HexMap
            onHexClick={handleHexClick}
            explorePlacements={movement.validExplorePlacements}
            reachableHexes={movement.reachableHexes}
            selectedHex={movement.selectedHex}
          />

          {actionCoach && !isTutorialMode && !(showFightButton || showInteractButton) && (
            <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-xl border border-slate-700/70 bg-slate-950/85 p-3 shadow-xl shadow-black/30 backdrop-blur sm:right-auto sm:max-w-[320px]">
              <div className="text-xs font-black uppercase tracking-widest text-violet-300">
                {actionCoach.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {actionCoach.body}
              </p>
            </div>
          )}

          {movement.isMovementPhase && movement.movePointsAvailable > 0 && (
            <div className="absolute left-1/2 top-[4.5rem] z-10 -translate-x-1/2 sm:top-3">
              <div className="flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 shadow-lg ring-1 ring-slate-700/60 backdrop-blur-sm">
                <span className="text-xs font-semibold text-slate-400">
                  {t('game.movePoints', 'Move')}
                </span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {movement.movePointsRemaining}
                </span>
                <span className="text-xs text-slate-600">/</span>
                <span className="font-mono text-xs text-slate-500">
                  {movement.movePointsAvailable}
                </span>
              </div>
            </div>
          )}

          {phase === 'movement' && reachableOpportunities.length > 0 && (
            <div data-tutorial="opportunities" className="absolute left-3 right-3 top-28 z-10 max-h-[35vh] overflow-y-auto rounded-xl border border-emerald-500/30 bg-slate-950/90 p-3 shadow-xl shadow-black/30 backdrop-blur sm:left-auto sm:top-3 sm:max-h-none sm:w-[280px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  {t('game.oppHeader', { defaultValue: 'Reachable opportunities' })}
                </span>
                <span className="text-[10px] text-slate-500">
                  {t('game.oppMoveLeft', { defaultValue: `${movement.movePointsRemaining} Move left`, count: movement.movePointsRemaining })}
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                {reachableOpportunities.map((opportunity) => (
                  <button
                    key={`${opportunity.coord.q},${opportunity.coord.r}`}
                    type="button"
                    onClick={() => movement.selectHex(opportunity.coord)}
                    className="w-full rounded-lg border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-left transition-all hover:border-emerald-400/60 hover:bg-emerald-950/30 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    <span className="block truncate text-xs font-bold text-slate-100">
                      {opportunity.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {opportunity.outcome} · {t('game.oppMoveAfter', { defaultValue: `${opportunity.remaining} Move after arrival`, count: opportunity.remaining })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(showFightButton || showInteractButton) && !isTutorialMode && (
            <div data-tutorial="available-action-coach" className="absolute left-3 right-3 top-3 z-10 rounded-xl border border-amber-500/30 bg-slate-950/90 p-3 shadow-xl shadow-black/30 backdrop-blur sm:left-auto sm:w-[280px]">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                {t('game.availableAction', { defaultValue: 'Available action' })}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {showFightButton
                  ? t('game.availableFight', { defaultValue: 'An enemy is here or adjacent. Start a fight to earn Fame and clear the location.' })
                  : t('game.availableInteract', { defaultValue: 'This site can be used now. Play Influence, then interact to recruit, heal, or buy rewards.' })}
              </p>
            </div>
          )}

          <div
            ref={playZoneRef}
            className={[
              'pointer-events-none absolute inset-x-0 top-0 bottom-0 z-10 flex items-center justify-center transition-all duration-200',
              drag.isDragging ? 'opacity-100' : 'opacity-0',
              drag.dropTarget === 'play-area'
                ? 'bg-violet-500/10 ring-2 ring-inset ring-violet-400/40'
                : '',
            ].join(' ')}
          >
            {drag.isDragging && (
              <div
                className={[
                  'rounded-xl border-2 border-dashed px-8 py-4 text-sm font-bold tracking-wide transition-all',
                  drag.dropTarget === 'play-area'
                    ? 'border-violet-400 bg-violet-500/20 text-violet-300 scale-105'
                    : 'border-slate-600/60 text-slate-500',
                ].join(' ')}
              >
                {'\u2728'} {t('game.dropToPlay', { defaultValue: 'Drop to Play' })}
              </div>
            )}
          </div>

          <div
            ref={discardZoneRef}
            className={[
              'absolute bottom-3 right-3 z-10 flex items-center justify-center rounded-xl transition-all duration-200',
              drag.isDragging
                ? 'h-16 w-16 opacity-100'
                : 'h-0 w-0 opacity-0',
              drag.dropTarget === 'discard-pile'
                ? 'border-2 border-red-400 bg-red-500/20 text-red-300 scale-110'
                : 'border-2 border-dashed border-slate-600/60 bg-slate-800/60 text-slate-500',
            ].join(' ')}
          >
            {drag.isDragging && (
              <span className="text-xl">{'\uD83D\uDDD1'}</span>
            )}
          </div>

          {showMovementConfirm && (
            <div data-tutorial="confirm-move" className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-4">
              <button
                type="button"
                onClick={() => {
                  if (!movement.selectedHex) return
                  const cell = getHexAt(movement.selectedHex.q, movement.selectedHex.r)
                  if (cell) setSelectedTileInfo(cell)
                }}
                aria-label={t('game.tileInfo', 'Tile Info')}
                className="flex min-h-[44px] items-center justify-center rounded-lg bg-slate-700 px-3 py-2.5 text-sm font-bold text-slate-200 shadow-lg transition-all hover:bg-slate-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                ⓘ
              </button>
              <button
                type="button"
                onClick={movement.confirmMove}
                aria-label={t('game.confirmMove', 'Confirm Move')}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {t('game.confirmMove', 'Confirm Move')}
              </button>
              <button
                type="button"
                onClick={movement.cancelMovement}
                aria-label={t('game.cancel', 'Cancel')}
                className="min-h-[44px] rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 shadow-lg transition-all hover:bg-slate-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t('game.cancel', 'Cancel')}
              </button>
            </div>
          )}



          {showHealButton && (
            <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2">
              <button
                type="button"
                onClick={() => engine.healWound()}
                className="min-h-[44px] rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-600 active:scale-95"
              >
                {'💚'} {t('game.healWound', 'Heal Wound')} ({healingAvailable})
              </button>
            </div>
          )}

          {(showFightButton || showInteractButton) && (
            <div data-tutorial="fight-button" className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {showFightButton && (
                <button
                  type="button"
                  onClick={handleFightClick}
                  aria-label={t('game.fight', 'Fight')}
                  className="min-h-[44px] rounded-lg bg-red-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/40 transition-all hover:bg-red-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  {'\u2694\uFE0F'} {t('game.fight', 'Fight')}
                </button>
              )}
              {showInteractButton && (
                <button
                  type="button"
                  onClick={handleInteractClick}
                  aria-label={t('interaction.interact', 'Interact')}
                  className="min-h-[44px] rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/40 transition-all hover:bg-emerald-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  🏘️ {t('interaction.interact', 'Interact')}
                </button>
              )}
            </div>
          )}

          <AnimatePresence>
            {showTacticSelection && (
              <motion.div
                key="tactic-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <TacticSelectionOverlay
                  tactics={availableTactics}
                  onSelect={handleSelectTactic}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showEndOfRound && (
              <motion.div
                key="round-end-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <RoundTransitionOverlay onContinue={handleEndOfRound} />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {cardSelectionMode && engineState && (
              <motion.div
                key="card-selection-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                {cardSelectionMode.mode === 'rethink' && (
                  <CardSelectionOverlay
                    cards={engineState.player.deck.hand}
                    maxSelectable={3}
                    minSelectable={0}
                    title={t('game.rethinkTitle', 'Rethink')}
                    subtitle={t('game.rethinkSubtitle', 'Discard up to 3 cards (including wounds) from your hand, then draw that many.')}
                    confirmLabel={t('game.discard', 'Discard')}
                    onConfirm={handleCardSelectionConfirm}
                    onCancel={handleCardSelectionCancel}
                  />
                )}
                {cardSelectionMode.mode === 'preparation' && (
                  <CardSelectionOverlay
                    cards={engineState.player.deck.drawPile}
                    maxSelectable={1}
                    minSelectable={1}
                    title={t('game.preparationTitle', 'Preparation')}
                    subtitle={t('game.preparationSubtitle', 'Search your deck for one card to take into your hand.')}
                    confirmLabel={t('game.takeCard', 'Take Card')}
                    onConfirm={handleCardSelectionConfirm}
                  />
                )}
                {cardSelectionMode.mode === 'meditation' && (
                  <CardSelectionOverlay
                    cards={engineState.player.deck.hand}
                    maxSelectable={5}
                    minSelectable={0}
                    title={t('game.meditationTitle', 'Midnight Meditation')}
                    subtitle={t('game.meditationSubtitle', 'Shuffle up to 5 cards (including wounds) from your hand back into your deck, then draw that many.')}
                    confirmLabel={t('game.shuffleBack', 'Shuffle Back')}
                    onConfirm={handleCardSelectionConfirm}
                    onCancel={handleCardSelectionCancel}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {dieSelectionMode && engineState && (
              <motion.div
                key="die-selection-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                {dieSelectionMode.mode === 'mana_steal' && (
                  <DieSelectionOverlay
                    dice={engineState.player.mana.dice.filter((d) => d.isInSource)}
                    maxSelectable={1}
                    minSelectable={1}
                    title={t('game.manaStealSelectTitle', 'Mana Steal')}
                    subtitle={t('game.manaStealSelectSubtitle', 'Select 1 basic-color die from the Source.')}
                    confirmLabel={t('game.selectDie', 'Select')}
                    filterBasicOnly
                    onConfirm={handleDieSelectionConfirm}
                    onCancel={handleDieSelectionCancel}
                  />
                )}
                {dieSelectionMode.mode === 'mana_search' && (
                  <DieSelectionOverlay
                    dice={engineState.player.mana.dice.filter((d) => d.isInSource)}
                    maxSelectable={2}
                    minSelectable={1}
                    title={t('game.manaSearchSelectTitle', 'Mana Search')}
                    subtitle={t('game.manaSearchSelectSubtitle', 'Select up to 2 dice to reroll.')}
                    confirmLabel={t('game.reroll', 'Reroll')}
                    onConfirm={handleDieSelectionConfirm}
                    onCancel={handleDieSelectionCancel}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Improvisation: Step 1 - Discard selection */}
          <AnimatePresence>
            {improvisationMode?.step === 'discard' && engineState && (
              <motion.div
                key="improvisation-discard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <CardSelectionOverlay
                  cards={engineState.player.deck.hand.filter((_, i) => i !== improvisationMode.cardIndex)}
                  maxSelectable={1}
                  minSelectable={1}
                  title={t('game.improvisationDiscardTitle', 'Improvisation')}
                  subtitle={t('game.improvisationDiscardSubtitle', 'Discard a card from your hand to activate the effect.')}
                  confirmLabel={t('game.discard', 'Discard')}
                  onConfirm={handleImprovisationDiscard}
                  onCancel={handleImprovisationCancel}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Offering / Sacrifice: discard up to 3 non-Wound cards for crystals */}
          <AnimatePresence>
            {offeringMode && (
              <motion.div
                key="offering-discard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <CardSelectionOverlay
                  cards={engineState.player.deck.hand.filter((_, i) => i !== offeringMode.handIndex)}
                  maxSelectable={3}
                  minSelectable={0}
                  validate={(sel, cards) => sel.every((i) => cards[i]?.type !== 'wound')}
                  invalidHint={t('game.offeringNoWounds', 'Wounds cannot be discarded')}
                  title={t('game.offeringTitle', 'Offering')}
                  subtitle={t('game.offeringSubtitle', 'Discard up to 3 non-Wound cards — gain a crystal of each card’s colour.')}
                  confirmLabel={t('game.offeringConfirm', 'Sacrifice')}
                  onConfirm={handleOfferingConfirm}
                  onCancel={() => setOfferingMode(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Peaceful Moment: Influence vs Heal */}
          <AnimatePresence>
            {peacefulMode && (
              <motion.div
                key="peaceful-moment"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                  <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                    <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                      {t('game.peacefulTitle', 'Peaceful Moment')}
                    </h2>
                    <p className="mb-5 text-center text-xs text-slate-500">
                      {t('game.peacefulSubtitle', 'Take the Influence, or spend it as Healing (2 Influence → Heal 1).')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => { engine.playCard(peacefulMode.handIndex, peacefulMode.mode); setPeacefulMode(null) }}
                        className="flex min-h-[56px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.97]"
                      >
                        💬 {t('game.influence', 'Influence')} {peacefulMode.mode === 'strong' ? 6 : 3}
                      </button>
                      <button
                        type="button"
                        onClick={() => { engine.playPeacefulMoment(peacefulMode.handIndex, peacefulMode.mode); setPeacefulMode(null) }}
                        className="flex min-h-[56px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-emerald-500/50 hover:bg-slate-800 active:scale-[0.97]"
                      >
                        ❤️ {t('game.heal', 'Heal')} {peacefulMode.mode === 'strong' ? 3 : 1}
                      </button>
                    </div>
                    {/* Strong: refresh a spent Unit (2 Influence per level), rest → Heal */}
                    {peacefulMode.mode === 'strong' && engineState.player.units.some((u) => u.status === 'spent') && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {t('game.peacefulReadyUnit', 'Or refresh a Unit (2 Influence / level)')}
                        </p>
                        {engineState.player.units.map((u, i) =>
                          u.status === 'spent' && 2 * u.unit.level <= 6 ? (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { engine.playPeacefulMoment(peacefulMode.handIndex, 'strong', i); setPeacefulMode(null) }}
                              className="flex w-full items-center justify-between rounded-lg border border-slate-700/40 bg-slate-800/60 px-3 py-2 text-left transition-all hover:border-emerald-500/50 hover:bg-slate-800"
                            >
                              <span className="text-xs font-bold text-slate-200">{u.unit.name}</span>
                              <span className="text-[10px] text-slate-500">
                                −{2 * u.unit.level} · {t('game.heal', 'Heal')} {Math.floor((6 - 2 * u.unit.level) / 2)}
                              </span>
                            </button>
                          ) : null,
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setPeacefulMode(null)}
                      className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                    >
                      {t('game.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Blood of Ancients: pick an affordable AA from the offer */}
          <AnimatePresence>
            {bloodMode && engineState && (() => {
              const mana = engineState.player.mana
              const payColorFor = (cols: ManaColor[]): ManaColor | null => {
                for (const c of cols) {
                  if (mana.playerMana.some((tk) => tk.color === c) || mana.crystals[c] > 0) return c
                }
                // gold (day) can pay any single basic colour
                if (engineState.dayNight === 'day' && mana.playerMana.some((tk) => tk.color === 'gold')) return cols[0] ?? null
                return null
              }
              const isStrong = bloodMode.mode === 'strong'
              const affordable = engineState.offers.advancedActions
                .map((oc) => ({ oc, color: isStrong ? ('red' as ManaColor) : payColorFor((Array.isArray(oc.color) ? oc.color : [oc.color]) as ManaColor[]) }))
                .filter((x) => isStrong || x.color !== null) as { oc: typeof engineState.offers.advancedActions[number]; color: ManaColor }[]
              return (
                <motion.div
                  key="blood-of-ancients"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.25 } }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                >
                  <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                    <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                      <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                        {t('game.bloodTitle', 'Blood of Ancients')}
                      </h2>
                      <p className="mb-5 text-center text-xs text-slate-500">
                        {isStrong
                          ? t('game.bloodStrongSubtitle', 'Gain a Wound, then use an Advanced Action’s strong effect for free (it stays in the offer).')
                          : t('game.bloodSubtitle', 'Gain a Wound, pay a mana, and take a matching Advanced Action into your hand.')}
                      </p>
                      <div className="flex flex-col gap-2">
                        {affordable.map(({ oc, color }) => (
                          <button
                            key={oc.id}
                            type="button"
                            onClick={() => {
                              if (isStrong) engine.playBloodOfAncientsStrong(bloodMode.handIndex, oc.id)
                              else engine.playBloodOfAncients(bloodMode.handIndex, color, oc.id)
                              setBloodMode(null)
                            }}
                            className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-left transition-all hover:border-rose-500/50 hover:bg-slate-800 active:scale-[0.98]"
                          >
                            <span className="text-sm font-bold text-slate-200">{oc.name}</span>
                            {!isStrong && <span className="text-[10px] uppercase text-slate-500">{t(`colors.${color}`, color)}</span>}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setBloodMode(null)}
                        className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                      >
                        {t('game.cancel', 'Cancel')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          {/* Song of Wind (strong): optional blue-mana lake travel */}
          <AnimatePresence>
            {songWindMode && (
              <motion.div
                key="song-of-wind"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                  <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                    <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                      {t('game.songWindTitle', 'Song of Wind')}
                    </h2>
                    <p className="mb-5 text-center text-xs text-slate-500">
                      {t('game.songWindSubtitle', 'Pay a blue mana to travel through lakes for Move cost 0 this turn?')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => { engine.playCard(songWindMode.handIndex, 'strong', { songOfWindLake: true }); setSongWindMode(null) }}
                        className="flex min-h-[56px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-blue-500/50 hover:bg-slate-800 active:scale-[0.97]"
                      >
                        💧 {t('game.songWindPayBlue', 'Pay blue — lake travel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { engine.playCard(songWindMode.handIndex, 'strong'); setSongWindMode(null) }}
                        className="flex min-h-[56px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.97]"
                      >
                        {t('game.songWindNoLake', 'Move only')}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSongWindMode(null)}
                      className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                    >
                      {t('game.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Improvisation: Step 2 - Choose effect */}
          <AnimatePresence>
            {improvisationMode?.step === 'choose' && (
              <motion.div
                key="improvisation-choose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                  <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                    <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                      {t('game.improvisationChooseTitle', 'Choose Effect')}
                    </h2>
                    <p className="mb-5 text-center text-xs text-slate-500">
                      {t('game.improvisationChooseSubtitle', 'Select the effect you want to gain.')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(['move', 'influence', 'attack', 'block'] as const).map((eff) => (
                        <button
                          key={eff}
                          type="button"
                          onClick={() => handleImprovisationChoose(eff)}
                          className="flex min-h-[56px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.97]"
                        >
                          {eff === 'move' && `⚡ ${t('game.move', 'Move')} ${improvisationMode.value}`}
                          {eff === 'influence' && `🤝 ${t('game.influence', 'Influence')} ${improvisationMode.value}`}
                          {eff === 'attack' && `⚔️ ${t('game.attack', 'Attack')} ${improvisationMode.value}`}
                          {eff === 'block' && `🛡️ ${t('game.block', 'Block')} ${improvisationMode.value}`}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleImprovisationCancel}
                      className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                    >
                      {t('game.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Combo (Concentration / Will Focus strong): pick the target card */}
          <AnimatePresence>
            {comboMode && engineState && (
              <motion.div
                key="combo-select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <CardSelectionOverlay
                  cards={comboMode.eligible.map(({ index }) => engineState.player.deck.hand[index])}
                  maxSelectable={1}
                  minSelectable={1}
                  title={t('game.comboTitle', 'Choose a card to play with it')}
                  subtitle={t('game.comboSubtitle', { defaultValue: 'Its strong effect resolves for free with +{{bonus}}.', bonus: comboMode.bonus })}
                  confirmLabel={t('game.play', 'Play')}
                  onConfirm={(sel) => {
                    if (sel.length > 0) {
                      engine.playComboCard(comboMode.handIndex, comboMode.eligible[sel[0]].index, {
                        skipCost: comboMode.skipCost,
                      })
                    }
                    setComboMode(null)
                  }}
                  onCancel={() => setComboMode(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card decision: pick an effect and/or colors — portaled above any modal */}
          {cardDecisionMode &&
            createPortal(
              <motion.div
                key="card-decision"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                className="fixed inset-0 z-[60]"
              >
                <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                  <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                    {cardDecisionMode.actionOptions && cardDecisionMode.chosenActionIndex === undefined ? (
                      <>
                        <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                          {t('game.chooseEffectTitle', 'Choose Effect')}
                        </h2>
                        <p className="mb-5 text-center text-xs text-slate-500">
                          {cardDecisionMode.cardName} — {t('game.chooseEffectSubtitle', 'Select one effect to apply.')}
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {cardDecisionMode.actionOptions.map((opt) => (
                            <button
                              key={opt.actionIndex}
                              type="button"
                              onClick={() => handleDecisionAction(opt.actionIndex)}
                              className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.97]"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                          {t('game.chooseColorTitle', 'Choose Color')}
                        </h2>
                        <p className="mb-5 text-center text-xs text-slate-500">
                          {cardDecisionMode.cardName} — {t('game.chooseColorSubtitle', 'Pick a mana color.')}
                          {cardDecisionMode.colorQueue.length > 1 &&
                            ` (${cardDecisionMode.chosenColors.length + 1}/${cardDecisionMode.chosenColors.length + cardDecisionMode.colorQueue.length})`}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {(cardDecisionMode.colorQueue[0]?.allowed ?? []).map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => handleDecisionColor(color)}
                              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-sm font-bold text-slate-200 transition-all hover:border-violet-500/50 hover:bg-slate-800 active:scale-[0.97]"
                            >
                              <span className={`h-4 w-4 rotate-45 rounded-sm ${COLOR_SWATCH[color] ?? 'bg-slate-500'}`} />
                              {t(`colors.${color}`, { defaultValue: color })}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setCardDecisionMode(null)}
                      className="mt-4 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                    >
                      {t('game.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>,
              document.body,
            )}

          {/* Unit ability activation (Move / Influence / Heal outside combat) */}
          <UnitAbilityOverlay
            unit={unitAbilityIndex != null ? units[unitAbilityIndex] ?? null : null}
            unitIndex={unitAbilityIndex}
            combatActive={engineState?.combat.isActive === true}
            interactionActive={engineState?.interaction?.isActive === true}
            onActivate={(idx, action) => engine.activateUnit(idx, action)}
            onClose={() => setUnitAbilityIndex(null)}
          />

          {/* Banner attach: pick a unit (EC-02-C-3) */}
          <AnimatePresence>
            {bannerAttachMode && engineState && (
              <motion.div
                key="banner-attach"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
                  <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900 p-6 shadow-2xl">
                    <h2 className="mb-1 text-center text-lg font-black tracking-wide text-slate-100">
                      🚩 {t('game.attachBannerTitle', 'Attach Banner')}
                    </h2>
                    <p className="mb-4 text-center text-xs text-slate-500">
                      {t('game.attachBannerSubtitle', 'Choose a unit to carry this banner. It keeps the bonus until the unit is disbanded.')}
                    </p>
                    <div className="flex flex-col gap-2">
                      {engineState.player.units.map((u, idx) =>
                        u.bannerCard ? null : (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              engine.attachBanner(bannerAttachMode.handIndex, idx)
                              setBannerAttachMode(null)
                            }}
                            className="flex min-h-[48px] items-center justify-between rounded-xl border border-slate-700/40 bg-slate-800/60 px-4 py-3 text-left transition-all hover:border-amber-500/50 hover:bg-slate-800 active:scale-[0.98]"
                          >
                            <span className="text-sm font-bold text-slate-200">{u.unit.name}</span>
                            <span className="text-[10px] text-slate-500">
                              Lv {u.unit.level} · {t('game.armor', 'Armor')} {u.unit.armor}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                    {(() => {
                      const banner = engineState.player.deck.hand[bannerAttachMode.handIndex]
                      const hasInfluence = banner && banner.type === 'artifact' &&
                        banner.basicEffect?.actions?.some((a) => a.type === 'influence')
                      // Banner of Command: assigning is optional — you may instead
                      // just take its Influence (play the card normally).
                      return hasInfluence ? (
                        <button
                          type="button"
                          onClick={() => {
                            engine.playCard(bannerAttachMode.handIndex, 'basic')
                            setBannerAttachMode(null)
                          }}
                          className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition-all hover:bg-emerald-600 active:scale-95"
                        >
                          {t('game.bannerInfluenceOnly', 'Influence only (do not assign)')}
                        </button>
                      ) : null
                    })()}
                    <button
                      type="button"
                      onClick={() => setBannerAttachMode(null)}
                      className="mt-2 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-600 active:scale-95"
                    >
                      {t('game.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {restMode === 'standard' && engineState && (
              <motion.div
                key="rest-card-selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <CardSelectionOverlay
                  cards={engineState.player.deck.hand}
                  maxSelectable={engineState.player.deck.hand.length}
                  minSelectable={1}
                  title={t('game.standardRestTitle', { defaultValue: 'Standard Rest' })}
                  subtitle={t('game.standardRestSubtitle', { defaultValue: 'Select 1 non-wound card (required) and any wounds to discard' })}
                  confirmLabel={t('game.standardRestConfirm', { defaultValue: 'Rest' })}
                  validate={(indices, cards) =>
                    indices.filter((i) => cards[i]?.type !== 'wound').length === 1
                  }
                  invalidHint={t('game.standardRestRule', { defaultValue: 'Discard exactly one non-Wound card (plus any number of Wounds).' })}
                  onConfirm={(selectedIndices) => {
                    engine.declareRest('standard', selectedIndices)
                    setRestMode(null)
                  }}
                  onCancel={() => setRestMode(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {isGameOver && <GameOverOverlay />}
        </div>

        <aside className="hidden gap-4 overflow-y-auto border-l border-slate-700/60 bg-slate-900 px-3 py-4 lg:flex lg:w-72 lg:flex-col">
          <FameTrack fame={fame} level={level} />
          <ReputationTrack reputation={reputation} />

          {manaState && (
            <ManaPoolDisplay
              manaState={manaState}
              dayNight={dayNight}
              onDieClick={handleDieClick}
              onCrystalClick={handleCrystalClick}
            />
          )}

          <UnitSlots units={units} unitLimit={unitLimit} onUnitClick={setUnitAbilityIndex} />

          <SkillPanel
            skills={engineState.player.skills}
            units={units}
            hand={engineState.player.deck.hand}
            playerMana={engineState.player.mana.playerMana}
            dayNight={dayNight}
            interactionActive={engineState.interaction?.isActive === true}
            combatActive={engineState.combat.isActive}
            onActivate={(skillIndex, options) => engine.activateSkill(skillIndex, options)}
          />

          <div className="border-t border-slate-800" />

          {offers && (
            <>
              <CardOffer
                cards={offers.advancedActions}
                type="advanced_action"
                title={t('game.advancedActions', 'Advanced Actions')}
                layout="vertical"
              />
              <CardOffer
                cards={offers.spells}
                type="spell"
                title={t('game.spells', 'Spells')}
                layout="vertical"
              />
              <CardOffer
                cards={offerUnits}
                type="unit"
                title={t('game.units', 'Units')}
                layout="vertical"
              />
              {monasteryAAs.length > 0 && (
                <CardOffer
                  cards={monasteryAAs}
                  type="advanced_action"
                  title={t('game.monasteryAdvancedActions', 'Monastery Advanced Actions')}
                  layout="vertical"
                />
              )}
            </>
          )}
        </aside>
      </div>

      <button
        type="button"
        onClick={() => setMobileDrawerOpen(true)}
        className="fixed bottom-36 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/40 transition-all active:scale-90 lg:hidden"
        aria-label={t('game.info', 'Info')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
      </button>

      <AnimatePresence>
        {mobileDrawerOpen && (
          <motion.div
            key="mobile-drawer-overlay"
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-700/60 bg-slate-900 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
                <h3 className="text-sm font-bold text-slate-200">{t('game.info', 'Info')}</h3>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                  aria-label={t('game.close', 'Close')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <FameTrack fame={fame} level={level} />
                <ReputationTrack reputation={reputation} />

                {manaState && (
                  <ManaPoolDisplay
                    manaState={manaState}
                    dayNight={dayNight}
                    onDieClick={handleDieClick}
                    onCrystalClick={handleCrystalClick}
                  />
                )}

                <UnitSlots units={units} unitLimit={unitLimit} onUnitClick={(idx) => { setUnitAbilityIndex(idx); setMobileDrawerOpen(false) }} />

                <SkillPanel
                  skills={engineState.player.skills}
                  units={units}
                  hand={engineState.player.deck.hand}
                  playerMana={engineState.player.mana.playerMana}
                  dayNight={dayNight}
                  interactionActive={engineState.interaction?.isActive === true}
                  combatActive={engineState.combat.isActive}
                  onActivate={(skillIndex, options) => { engine.activateSkill(skillIndex, options); setMobileDrawerOpen(false) }}
                />

                <div className="border-t border-slate-800" />

                {offers && (
                  <>
                    <CardOffer
                      cards={offers.advancedActions}
                      type="advanced_action"
                      title={t('game.advancedActions', 'Advanced Actions')}
                      layout="vertical"
                    />
                    <CardOffer
                      cards={offers.spells}
                      type="spell"
                      title={t('game.spells', 'Spells')}
                      layout="vertical"
                    />
                    <CardOffer
                      cards={offerUnits}
                      type="unit"
                      title={t('game.units', 'Units')}
                      layout="vertical"
                    />
                    {monasteryAAs.length > 0 && (
                      <CardOffer
                        cards={monasteryAAs}
                        type="advanced_action"
                        title={t('game.monasteryAdvancedActions', 'Monastery Advanced Actions')}
                        layout="vertical"
                      />
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomPanel
        onCardDrop={handleCardDrop}
        onCardPlay={handleCardPlay}
        onCardDiscard={(index) => engine.discardCard(index)}
        onCardPlaySideways={(index, type) => engine.playSidewaysCard(index, type)}
        onDieClick={handleDieClick}
        onCrystalClick={handleCrystalClick}
        onUnitHeal={(idx) => engine.healUnit(idx)}
        onBannerAbility={(idx) => engine.useBannerAbility(idx)}
        dragDrop={drag}
      />

      <CombatView />
      <InteractionPanel />
      <EventToasts />

      <TileInfoPopup
        cell={selectedTileInfo}
        onClose={() => setSelectedTileInfo(null)}
        dayNight={dayNight}
      />

      <AdInterstitial
        show={showInterstitial}
        onComplete={handleInterstitialDone}
        onSkip={handleInterstitialDone}
      />

      <Modal isOpen={modalOpen === 'settings'} onClose={closeModal} title={t('game.settings', 'Settings')}>
        <div className="flex flex-col gap-3">
          <button
            onClick={closeModal}
            className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-500 active:bg-violet-700"
          >
            {t('game.resume', 'Resume')}
          </button>
          <button
            onClick={() => {
              // Persist progress before leaving so Continue can resume it
              const save =
                !isTutorialMode && engineState && !engineState.isGameOver
                  ? saveService.autoSave(engineState)
                  : Promise.resolve()
              void save.finally(() => navigate('main_menu'))
            }}
            className="w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 shadow transition-colors hover:bg-slate-600 active:bg-slate-800"
          >
            {t('game.saveAndExit', 'Save & Main Menu')}
          </button>
        </div>
      </Modal>

      <AnimatePresence>
        {showRoundTransition && (
          <RoundTransition
            key="round-transition"
            round={round}
            dayNight={dayNight}
            onComplete={() => setShowRoundTransition(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTurnBanner && (
          <TurnTransition
            key="turn-banner"
            text={phase === 'player_turn_start' ? t('game.yourTurn', 'Your Turn') : t('game.dummyTurn', "Dummy's Turn")}
            onComplete={() => setShowTurnBanner(false)}
          />
        )}
      </AnimatePresence>

      <LevelUpOverlay
        pending={pendingLevelUp}
        commonSkills={engineState?.player.commonSkillsAvailable ?? []}
        aaOffer={engineState?.offers.advancedActions ?? []}
        dummyHeroName={engineState?.dummyPlayer.heroName}
        onResolve={handleResolveLevelUp}
      />

      {pendingReward && (
        <RewardOverlay
          reward={pendingReward}
          spellOffer={engineState?.offers.spells ?? []}
          onClaim={handleClaimReward}
        />
      )}

      <InteractiveTutorial
        chapter={chapter}
        snapshot={tutorialSnapshot}
        onComplete={() => navigate('main_menu')}
        onChapterComplete={(chapterId) => markChapterComplete(chapterId)}
      />

      {!isTutorialMode && (
        <GameTips
          phase={phase}
          isFirstCombat={isFirstCombat}
          isLevelUp={pendingLevelUp !== null}
        />
      )}
    </div>
  )
}
