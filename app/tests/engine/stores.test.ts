import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  it('initializes with game inactive', () => {
    const state = useGameStore.getState()
    expect(state.isGameActive).toBe(false)
    expect(state.round).toBe(1)
    expect(state.fame).toBe(0)
  })

  it('startNewGame activates the game', () => {
    useGameStore.getState().startNewGame()
    const state = useGameStore.getState()
    expect(state.isGameActive).toBe(true)
    expect(state.phase).toBe('setup')
  })

  it('endGame sets game over', () => {
    useGameStore.getState().startNewGame()
    useGameStore.getState().endGame()
    const state = useGameStore.getState()
    expect(state.isGameActive).toBe(false)
    expect(state.phase).toBe('game_over')
  })

  it('reset restores initial state', () => {
    useGameStore.getState().startNewGame()
    useGameStore.getState().reset()
    const state = useGameStore.getState()
    expect(state.isGameActive).toBe(false)
    expect(state.round).toBe(1)
  })
})

describe('uiStore', () => {
  it('navigates between screens', () => {
    useUIStore.getState().navigate('game')
    expect(useUIStore.getState().currentScreen).toBe('game')

    useUIStore.getState().navigate('main_menu')
    expect(useUIStore.getState().currentScreen).toBe('main_menu')
  })

  it('manages modal state', () => {
    useUIStore.getState().openModal('card_detail')
    expect(useUIStore.getState().modalOpen).toBe('card_detail')

    useUIStore.getState().closeModal()
    expect(useUIStore.getState().modalOpen).toBeNull()
  })
})
