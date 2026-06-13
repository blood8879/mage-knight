import { useState, useEffect, useCallback, useRef } from 'react'
import { saveService } from '@/services/saveService'
import type { SaveEntry } from '@/services/saveService'
import type { GameState } from '@/engine/GameState'

export interface UseSaveLoadOptions {
  gameState: GameState | null
  onLoadState: (state: GameState) => void
}

export function useSaveLoad(options: UseSaveLoadOptions) {
  const { gameState, onLoadState } = options
  const [saves, setSaves] = useState<SaveEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const prevTurnKeyRef = useRef<string | null>(null)

  const refreshSaves = useCallback(async () => {
    const list = await saveService.listSaves()
    setSaves(list)
  }, [])

  useEffect(() => {
    void refreshSaves()
  }, [refreshSaves])

  // Autosave whenever a new turn or round begins (a clean decision point, so
  // resuming never lands mid-action). Finished games are not autosaved.
  useEffect(() => {
    if (!gameState || gameState.isGameOver) return
    const turnKey = `${gameState.round}:${gameState.turnCount}`
    const prevKey = prevTurnKeyRef.current
    prevTurnKeyRef.current = turnKey
    if (prevKey !== null && prevKey !== turnKey) {
      void saveService.autoSave(gameState)
    }
  }, [gameState])

  const saveGame = useCallback(
    async (name: string) => {
      if (!gameState) return
      setIsLoading(true)
      try {
        await saveService.saveGame(name, gameState)
        await refreshSaves()
      } finally {
        setIsLoading(false)
      }
    },
    [gameState, refreshSaves],
  )

  const loadGame = useCallback(
    async (id: number) => {
      setIsLoading(true)
      try {
        const loaded = await saveService.loadGame(id)
        if (loaded) {
          onLoadState(loaded)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [onLoadState],
  )

  const deleteSave = useCallback(
    async (id: number) => {
      setIsLoading(true)
      try {
        await saveService.deleteSave(id)
        await refreshSaves()
      } finally {
        setIsLoading(false)
      }
    },
    [refreshSaves],
  )

  const loadAutoSave = useCallback(async () => {
    setIsLoading(true)
    try {
      const loaded = await saveService.loadAutoSave()
      if (loaded) {
        onLoadState(loaded)
      }
    } finally {
      setIsLoading(false)
    }
  }, [onLoadState])

  return {
    saves,
    saveGame,
    loadGame,
    deleteSave,
    loadAutoSave,
    isLoading,
  }
}
