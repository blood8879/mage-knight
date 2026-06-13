import { useState, useCallback, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useGameEngine } from '@/hooks/useGameEngine'
import type { HexCoord } from '@/engine/types'
import { getTileHexes, hexKey, hexNeighbors } from '@/utils/hexMath'

export function useMovement() {
  const engine = useGameEngine()
  const engineState = useGameStore((s) => s.engineState)
  const phase = useGameStore((s) => s.phase)

  const [selectedHex, setSelectedHex] = useState<HexCoord | null>(null)
  const [movePath, setMovePath] = useState<HexCoord[] | null>(null)

  const movePointsAvailable = engineState?.player.turn.movePointsAvailable ?? 0
  const movePointsSpent = engineState?.player.turn.movePointsSpent ?? 0
  const movePointsRemaining = movePointsAvailable - movePointsSpent
  const isMovementPhase = phase === 'movement'

  const reachableHexes = useMemo(() => {
    if (!isMovementPhase || movePointsRemaining <= 0) return null
    return engine.getReachableHexes(movePointsRemaining)
  }, [isMovementPhase, movePointsRemaining, engine])

  const selectHex = useCallback(
    (coord: HexCoord) => {
      if (!reachableHexes) {
        setSelectedHex(null)
        setMovePath(null)
        return
      }

      const key = `${coord.q},${coord.r}`
      if (reachableHexes.has(key)) {
        setSelectedHex(coord)
        setMovePath([coord])
      } else {
        setSelectedHex(null)
        setMovePath(null)
      }
    },
    [reachableHexes],
  )

  const confirmMove = useCallback(() => {
    if (selectedHex === null || movePath === null) return

    engine.movePlayer(selectedHex)

    setSelectedHex(null)
    setMovePath(null)
  }, [selectedHex, movePath, engine])

  const cancelMovement = useCallback(() => {
    setSelectedHex(null)
    setMovePath(null)
  }, [])

  const canExplore = useMemo(() => {
    if (!isMovementPhase || movePointsRemaining < 2) return false
    return engine.canExploreTile()
  }, [isMovementPhase, movePointsRemaining, engine])

  const validExplorePlacements = useMemo(() => {
    if (!canExplore) return null
    const playerPos = engineState?.player.position
    if (!playerPos) return null

    const allPlacements = engine.getExplorePlacements()
    if (allPlacements.length === 0) return null

    const neighborKeys = new Set(hexNeighbors(playerPos).map(hexKey))

    const adjacent = allPlacements.filter((center) =>
      getTileHexes(center).some((h) => neighborKeys.has(hexKey(h))),
    )

    return adjacent.length > 0 ? adjacent : null
  }, [canExplore, engine, engineState])

  const exploreAt = useCallback(
    (clickedCoord: HexCoord): boolean => {
      if (!validExplorePlacements) return false

      const clickedKey = hexKey(clickedCoord)
      for (const placementCenter of validExplorePlacements) {
        const tileHexes = getTileHexes(placementCenter)
        if (tileHexes.some((h) => hexKey(h) === clickedKey)) {
          engine.exploreTile(placementCenter)
          return true
        }
      }
      return false
    },
    [validExplorePlacements, engine],
  )

  return {
    isMovementPhase,
    reachableHexes,
    selectedHex,
    movePath,
    movePointsAvailable,
    movePointsSpent,
    movePointsRemaining,
    selectHex,
    confirmMove,
    cancelMovement,
    canExplore,
    validExplorePlacements,
    exploreAt,
  }
}
