import { useState, useCallback } from 'react'

const STORAGE_KEY = 'mageknightTutorialProgress'
const FIRST_VISIT_KEY = 'mageknightTutorialFirstVisit'
const TOTAL_CHAPTERS = 6

interface TutorialProgress {
  completedChapters: number[]
  isFirstVisit: boolean
  isChapterComplete: (chapter: number) => boolean
  markChapterComplete: (chapter: number) => void
  resetProgress: () => void
  markFirstVisitDone: () => void
  allChaptersComplete: boolean
}

function readCompleted(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
      return parsed as number[]
    }
    return []
  } catch {
    return []
  }
}

function writeCompleted(chapters: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters))
}

export function useTutorialProgress(): TutorialProgress {
  const [completedChapters, setCompleted] = useState<number[]>(readCompleted)
  const [isFirstVisit, setIsFirstVisit] = useState<boolean>(
    () => localStorage.getItem(FIRST_VISIT_KEY) !== '1',
  )

  const isChapterComplete = useCallback(
    (chapter: number) => completedChapters.includes(chapter),
    [completedChapters],
  )

  const markChapterComplete = useCallback((chapter: number) => {
    setCompleted((prev) => {
      if (prev.includes(chapter)) return prev
      const next = [...prev, chapter].sort((a, b) => a - b)
      writeCompleted(next)
      return next
    })
  }, [])

  const resetProgress = useCallback(() => {
    setCompleted([])
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(FIRST_VISIT_KEY)
    setIsFirstVisit(true)
  }, [])

  const markFirstVisitDone = useCallback(() => {
    localStorage.setItem(FIRST_VISIT_KEY, '1')
    setIsFirstVisit(false)
  }, [])

  return {
    completedChapters,
    isFirstVisit,
    isChapterComplete,
    markChapterComplete,
    resetProgress,
    markFirstVisitDone,
    allChaptersComplete: completedChapters.length >= TOTAL_CHAPTERS,
  }
}
