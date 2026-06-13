import { useRef, useCallback, useState } from 'react'
import type { GameState } from '@/engine/GameState'

const MAX_UNDO_STACK_SIZE = 20

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
  const stackRef = useRef<GameState[]>([])
  const [canUndo, setCanUndo] = useState(false)

  const pushState = useCallback((state: GameState) => {
    const snapshot = cloneGameState(state)
    const stack = stackRef.current
    stack.push(snapshot)
    if (stack.length > MAX_UNDO_STACK_SIZE) {
      stack.shift()
    }
    setCanUndo(true)
  }, [])

  const undo = useCallback((): GameState | null => {
    const stack = stackRef.current
    if (stack.length === 0) return null
    const previous = stack.pop()!
    setCanUndo(stack.length > 0)
    return previous
  }, [])

  const clearStack = useCallback(() => {
    stackRef.current = []
    setCanUndo(false)
  }, [])

  return {
    pushState,
    undo,
    canUndo,
    clearStack,
  }
}
