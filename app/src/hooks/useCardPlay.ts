import { useState, useCallback, useMemo } from 'react'
import { useGameEngine } from '@/hooks/useGameEngine'
import { useUIStore } from '@/store/uiStore'
import type { AnyCard, DeedCard, CardEffect, SpellCard } from '@/engine/types'

// ── Effect shapes ────────────────────────────
interface DeedCardEffects {
  basicEffect: CardEffect
  strongEffect: CardEffect
}

interface SpellCardEffects {
  basicSpell: CardEffect & { name: string }
  strongSpell: CardEffect & { name: string }
}

type CardEffects = DeedCardEffects | SpellCardEffects

// ── Type guards ──────────────────────────────
function isSpellCard(card: DeedCard): card is SpellCard {
  return card.type === 'spell'
}

// ── Hook ─────────────────────────────────────
export function useCardPlay() {
  const engine = useGameEngine()
  const selectCardInUI = useUIStore((s) => s.selectCard)

  // ── Local UI state ──
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [isPlayingCard, setIsPlayingCard] = useState(false)

  // ── Derived state from engine ──
  const handCards: AnyCard[] = useMemo(() => {
    if (!engine.gameState) return []
    return engine.gameState.player.deck.hand
  }, [engine.gameState])

  const playAreaCards: AnyCard[] = useMemo(() => {
    if (!engine.gameState) return []
    return engine.gameState.player.deck.playArea
  }, [engine.gameState])

  // ── selectCard ──
  const selectCard = useCallback(
    (index: number) => {
      setSelectedCardIndex(index)
      const card = handCards[index]
      if (card && card.type !== 'wound') {
        selectCardInUI(card.id as number)
      } else if (card && card.type === 'wound') {
        selectCardInUI(null)
      }
    },
    [handCards, selectCardInUI],
  )

  // ── deselectCard ──
  const deselectCard = useCallback(() => {
    setSelectedCardIndex(null)
    selectCardInUI(null)
  }, [selectCardInUI])

  // ── playSelectedCard ──
  const playSelectedCard = useCallback(() => {
    if (selectedCardIndex === null) return
    setIsPlayingCard(true)
    engine.playCard(selectedCardIndex)
    setSelectedCardIndex(null)
    selectCardInUI(null)
    setIsPlayingCard(false)
  }, [selectedCardIndex, engine, selectCardInUI])

  // ── discardSelectedCard ──
  const discardSelectedCard = useCallback(() => {
    if (selectedCardIndex === null) return
    engine.discardCard(selectedCardIndex)
    setSelectedCardIndex(null)
    selectCardInUI(null)
  }, [selectedCardIndex, engine, selectCardInUI])

  // ── playSideways ──
  const playSideways = useCallback(
    (index: number) => {
      engine.playCard(index)
      setSelectedCardIndex(null)
      selectCardInUI(null)
    },
    [engine, selectCardInUI],
  )

  // ── getCardEffects ──
  const getCardEffects = useCallback((card: DeedCard): CardEffects => {
    if (isSpellCard(card)) {
      return {
        basicSpell: card.basicSpell,
        strongSpell: card.strongSpell,
      }
    }
    return {
      basicEffect: card.basicEffect,
      strongEffect: card.strongEffect,
    }
  }, [])

  // ── canPlayCard ──
  const canPlayCard = useCallback(
    (index: number): boolean => {
      const card = handCards[index]
      if (!card) return false
      if (card.type === 'wound') return false
      return true
    },
    [handCards],
  )

  return {
    // State
    selectedCardIndex,
    isPlayingCard,
    playAreaCards,
    handCards,

    // Actions
    selectCard,
    deselectCard,
    playSelectedCard,
    discardSelectedCard,
    playSideways,
    getCardEffects,
    canPlayCard,
  }
}
