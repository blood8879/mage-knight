import { create } from 'zustand'
import type { DayNight, GamePhase, CombatState, FinalScore } from '@/engine/types'
import { INITIAL_COMBAT_STATE } from '@/engine/GameState'
import { resetEngine } from '@/hooks/useGameEngine'
import type { GameState as FullGameState, GameLogEntry } from '@/engine/GameState'

interface GameStoreState {
  isGameActive: boolean
  isTutorialMode: boolean
  tutorialChapter: number | null
  round: number
  totalRounds: number
  turn: number
  dayNight: DayNight
  phase: GamePhase
  roundPattern: DayNight[]

  fame: number
  reputation: number
  level: number
  armor: number
  handLimit: number
  unitLimit: number

  combat: CombatState
  isGameOver: boolean
  finalScore: FinalScore | null
  log: GameLogEntry[]

  engineState: FullGameState | null

  /** Shared undo availability (the undo stack is module-global in useUndo) */
  canUndo: boolean

  /** Hero the player chose for the current game */
  selectedHero: string

  startNewGame: (hero?: string) => void
  startTutorial: () => void
  startTutorialChapter: (chapter: number) => void
  endGame: (score?: FinalScore) => void
  reset: () => void
  setPhase: (phase: GamePhase) => void
  setEngineState: (state: FullGameState) => void
  setCanUndo: (v: boolean) => void
  addLogEntry: (entry: GameLogEntry) => void
  syncFromEngine: (state: FullGameState) => void
}

const initialState = {
  isGameActive: false,
  isTutorialMode: false,
  tutorialChapter: null as number | null,
  round: 1,
  totalRounds: 3,
  turn: 1,
  dayNight: 'day' as DayNight,
  phase: 'setup' as GamePhase,
  roundPattern: ['day', 'night', 'day'] as DayNight[],
  fame: 0,
  reputation: 0,
  level: 1,
  armor: 2,
  handLimit: 5,
  unitLimit: 1,
  combat: { ...INITIAL_COMBAT_STATE },
  isGameOver: false,
  finalScore: null as FinalScore | null,
  log: [] as GameLogEntry[],
  engineState: null as FullGameState | null,
  canUndo: false,
  selectedHero: 'Arythea',
}

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  startNewGame: (hero = 'Arythea') =>
    set({
      ...initialState,
      selectedHero: hero,
      isGameActive: true,
      isTutorialMode: false,
      tutorialChapter: null,
      phase: 'setup',
      log: [],
    }),

  startTutorial: () =>
    set({
      ...initialState,
      isGameActive: true,
      isTutorialMode: true,
      tutorialChapter: 1,
      phase: 'setup',
      log: [],
    }),

  startTutorialChapter: (chapter: number) =>
    set({
      ...initialState,
      isGameActive: true,
      isTutorialMode: true,
      tutorialChapter: chapter,
      phase: 'setup',
      log: [],
    }),

  endGame: (score) =>
    set({
      isGameActive: false,
      isGameOver: true,
      phase: 'game_over',
      finalScore: score ?? null,
    }),

  reset: () => {
    resetEngine()
    set({ ...initialState, log: [] })
  },

  setPhase: (phase) => set({ phase }),

  setEngineState: (state) => set({ engineState: state }),
  setCanUndo: (v) => set({ canUndo: v }),

  addLogEntry: (entry) =>
    set((prev) => ({ log: [...prev.log, entry] })),

  syncFromEngine: (state) =>
    set({
      round: state.round,
      totalRounds: state.totalRounds,
      dayNight: state.dayNight,
      phase: state.phase,
      fame: state.player.fame,
      reputation: state.player.reputation,
      level: state.player.level,
      armor: state.player.armor,
      handLimit: state.player.handLimit,
      unitLimit: state.player.unitLimit,
      combat: state.combat,
      isGameOver: state.isGameOver,
      finalScore: state.finalScore,
      engineState: state,
      turn: state.turnCount,
      log: state.log,
      isGameActive: true,
    }),
}))
