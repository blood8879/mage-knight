import { useCallback } from 'react'
import type { GameState } from '@/engine/GameState'
import { useGameStore } from '@/store/gameStore'

const MAX_UNDO_STACK_SIZE = 20

/**
 * Module-global undo stack — shared across ALL useGameEngine instances.
 * Previously each hook instance kept its own stackRef/canUndo, so an action
 * pushed by one instance (card play in GameScreen) and a clearStack from another
 * (exploreTile via useMovement's own instance) hit different stacks — letting
 * revealed map tiles be undone (rule violation). A single global stack plus a
 * store-backed canUndo keeps every instance consistent.
 */
let undoStack: GameState[] = []

function cloneGameState(state: GameState): GameState {
  const cloned: GameState = {
    ...state,
    player: {
      ...state.player,
      position: { ...state.player.position },
      deck: {
        drawPile: [...state.player.deck.drawPile],
        hand: [...state.player.deck.hand],
        playArea: [...state.player.deck.playArea],
        discardPile: [...state.player.deck.discardPile],
      },
      mana: {
        dice: [...state.player.mana.dice],
        playerMana: [...state.player.mana.playerMana],
        crystals: { ...state.player.mana.crystals },
        sourceDieTakenThisTurn: state.player.mana.sourceDieTakenThisTurn,
      },
      turn: { ...state.player.turn, cardsPlayedThisTurn: [...state.player.turn.cardsPlayedThisTurn], unitsActivatedThisTurn: [...state.player.turn.unitsActivatedThisTurn] },
      units: state.player.units.map((u) => ({ ...u })),
      conqueredSites: state.player.conqueredSites.map((s) => ({ ...s })),
      skills: [...state.player.skills],
    },
    dummyPlayer: {
      ...state.dummyPlayer,
    },
    map: {
      tiles: state.map.tiles.map((t) => ({ ...t })),
      tileDeck: [...state.map.tileDeck],
      hexGrid: new Map(state.map.hexGrid),
    },
    offers: { ...state.offers },
    combat: {
      ...state.combat,
      enemies: [...state.combat.enemies],
      attacks: [...state.combat.attacks],
      blocks: [...state.combat.blocks],
      damageAssignments: [...state.combat.damageAssignments],
      rewards: [...state.combat.rewards],
    },
    availableTactics: [...state.availableTactics],
    usedTactics: [...state.usedTactics],
    enemyPools: { ...state.enemyPools },
    seed: state.seed,
    log: [...state.log],
  }
  return cloned
}

export interface UseUndoReturn {
  pushState: (state: GameState) => void
  undo: () => GameState | null
  canUndo: boolean
  clearStack: () => void
}

export function useUndo(): UseUndoReturn {
  const canUndo = useGameStore((s) => s.canUndo)
  const setCanUndo = useGameStore((s) => s.setCanUndo)

  const pushState = useCallback((state: GameState) => {
    undoStack.push(cloneGameState(state))
    if (undoStack.length > MAX_UNDO_STACK_SIZE) undoStack.shift()
    setCanUndo(true)
  }, [setCanUndo])

  const undo = useCallback((): GameState | null => {
    if (undoStack.length === 0) return null
    const previous = undoStack.pop()!
    setCanUndo(undoStack.length > 0)
    return previous
  }, [setCanUndo])

  const clearStack = useCallback(() => {
    undoStack = []
    setCanUndo(false)
  }, [setCanUndo])

  return {
    pushState,
    undo,
    canUndo,
    clearStack,
  }
}
