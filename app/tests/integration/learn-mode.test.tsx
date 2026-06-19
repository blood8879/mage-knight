import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameEngine, resetEngine } from '@/hooks/useGameEngine'
import { useGameStore } from '@/store/gameStore'

/**
 * Learn-by-Playing initialises the REAL engine with the First Reconnaissance
 * config (3 rounds), so it is rulebook-compliant by construction. A normal game
 * stays Solo Conquest (6 rounds).
 */
describe('Learn-by-Playing engine init', () => {
  it('initializeGame({ learn: true }) sets up a 3-round First Reconnaissance game', () => {
    resetEngine()
    const { result } = renderHook(() => useGameEngine())
    act(() => { result.current.initializeGame('Tovak', { learn: true }) })
    const s = useGameStore.getState().engineState!
    expect(s.totalRounds).toBe(3)
    expect(s.round).toBe(1)
    expect(s.roundPattern).toEqual(['day', 'night', 'day'])
  })

  it('a normal game stays the 6-round Solo Conquest', () => {
    resetEngine()
    const { result } = renderHook(() => useGameEngine())
    act(() => { result.current.initializeGame('Tovak') })
    const s = useGameStore.getState().engineState!
    expect(s.totalRounds).toBe(6)
  })

  it('startLearnGame store action flags learnMode without tutorial', () => {
    useGameStore.getState().startLearnGame('Goldyx')
    const g = useGameStore.getState()
    expect(g.learnMode).toBe(true)
    expect(g.isTutorialMode).toBe(false)
    expect(g.selectedHero).toBe('Goldyx')
    expect(g.totalRounds).toBe(3)
    useGameStore.getState().reset()
  })
})
