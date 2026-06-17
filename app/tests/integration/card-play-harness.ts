// ─────────────────────────────────────────────────────────────────────────────
// Card-play integration harness
//
// Drives the REAL play path (useGameEngine.playCard / combat / interaction) the
// way the UI does, so per-card tests catch hook-level bugs that isolated
// resolver tests miss. Built deliberately because resolver-only tests passed
// while hand-play had many bugs.
// ─────────────────────────────────────────────────────────────────────────────
import { renderHook, act } from '@testing-library/react'
import { useGameEngine, resetEngine, setSharedState } from '@/hooks/useGameEngine'
import { useGameStore } from '@/store/gameStore'
import type { GameState } from '@/engine/GameState'
import type { AnyCard, ManaToken, CrystalInventory } from '@/engine/types'

export type Engine = ReturnType<typeof useGameEngine>

export interface Harness {
  engine: Engine
  /** Current full game state (after the last action). */
  state: () => GameState
  /** Replace the shared game state the engine reads from. */
  setState: (mutate: (s: GameState) => GameState) => void
  /** Run an engine action inside act(). */
  run: (fn: (e: Engine) => void) => void
}

/** Spin up the engine with a real initialized game, then hand control to the test. */
export function createHarness(hero = 'Tovak'): Harness {
  resetEngine()
  const { result } = renderHook(() => useGameEngine())
  act(() => {
    result.current.initializeGame(hero)
  })

  const state = (): GameState => {
    const s = useGameStore.getState().engineState as GameState | null
    if (!s) throw new Error('no engine state')
    return s
  }
  const setState = (mutate: (s: GameState) => GameState) => {
    const next = mutate(state())
    act(() => {
      setSharedState(next)
      useGameStore.getState().syncFromEngine(next)
    })
  }
  const run = (fn: (e: Engine) => void) => {
    act(() => {
      fn(result.current)
    })
  }

  return { engine: result.current, state, setState, run }
}

/** Build a clean mana pool with the given tokens / crystals for deterministic cost tests. */
export function manaWith(opts: {
  tokens?: ManaToken[]
  crystals?: Partial<CrystalInventory>
  diceColors?: string[]
} = {}) {
  return (s: GameState): GameState => ({
    ...s,
    player: {
      ...s.player,
      mana: {
        ...s.player.mana,
        playerMana: opts.tokens ?? [],
        crystals: { red: 0, blue: 0, green: 0, white: 0, ...(opts.crystals ?? {}) },
        dice: opts.diceColors
          ? opts.diceColors.map((c, i) => ({ id: `d${i}`, color: c as ManaToken['color'], isInSource: true }))
          : s.player.mana.dice,
      },
    },
  })
}

/** Put exactly these cards in hand and open an interaction at a site (for influence). */
export function setupInteraction(
  cards: AnyCard[],
  opts: { siteType?: 'village' | 'monastery' | 'keep' | 'mageTower' | 'city'; dayNight?: 'day' | 'night' } = {},
) {
  return (s: GameState): GameState => ({
    ...s,
    phase: 'interaction',
    dayNight: opts.dayNight ?? 'day',
    combat: { ...s.combat, isActive: false },
    interaction: {
      isActive: true,
      siteType: opts.siteType ?? 'village',
      siteHex: { ...s.player.position },
      influencePool: 0,
      reputationModifierApplied: true,
      purchasesMade: [],
      shieldTokens: 0,
    },
    player: {
      ...s.player,
      deck: { ...s.player.deck, hand: [...cards], playArea: [] },
      turn: { ...s.player.turn, cardsPlayedThisTurn: [], sidewaysCardsPlayed: 0, hasPlunderedThisTurn: false },
    },
  })
}

/** Put exactly these cards in hand and set a fresh player-turn at day. */
export function setupTurn(cards: AnyCard[], opts: { dayNight?: 'day' | 'night' } = {}) {
  return (s: GameState): GameState => ({
    ...s,
    phase: 'player_turn_start',
    dayNight: opts.dayNight ?? 'day',
    combat: { ...s.combat, isActive: false },
    player: {
      ...s.player,
      deck: { ...s.player.deck, hand: [...cards], playArea: [] },
      turn: {
        ...s.player.turn,
        movePointsAvailable: 0,
        movePointsSpent: 0,
        cardsPlayedThisTurn: [],
        sidewaysCardsPlayed: 0,
        hasPlunderedThisTurn: false,
        healingAvailable: 0,
      },
    },
  })
}
