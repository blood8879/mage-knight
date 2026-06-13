import { create } from 'zustand'
import type { Screen } from '@/engine/types'

interface UIState {
  currentScreen: Screen
  modalOpen: string | null
  selectedCardId: number | null
  navigate: (screen: Screen) => void
  openModal: (modalId: string) => void
  closeModal: () => void
  selectCard: (cardId: number | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  currentScreen: 'main_menu',
  modalOpen: null,
  selectedCardId: null,

  navigate: (screen: Screen) => set({ currentScreen: screen }),
  openModal: (modalId: string) => set({ modalOpen: modalId }),
  closeModal: () => set({ modalOpen: null }),
  selectCard: (cardId: number | null) => set({ selectedCardId: cardId }),
}))
