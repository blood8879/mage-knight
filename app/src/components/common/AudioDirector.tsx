import { useEffect, useRef } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { audioService } from '@/services/audioService'
import type { MusicName, SfxName } from '@/services/audioService'
import type { GameLogType } from '@/engine/GameState'

/**
 * Invisible component that drives all audio:
 *  - picks the music track from the current screen / day-night / combat state
 *  - fires SFX from new engine log entries (same pattern as EventToasts)
 *  - unlocks the AudioContext on the first user gesture and plays UI clicks
 */

const LOG_SFX: Partial<Record<GameLogType, SfxName>> = {
  card_play: 'card_play',
  card_draw: 'card_draw',
  movement: 'move',
  turn_start: 'turn_start',
  round_start: 'round_start',
  combat_start: 'combat_start',
  crystal_gain: 'crystal',
  fame_gain: 'coin',
  unit_recruit: 'coin',
  card_acquire: 'card_draw',
  wound_gain: 'wound',
  wound_heal: 'heal',
  level_up: 'level_up',
  skill_gain: 'level_up',
  site_conquer: 'victory',
}

// Under Playwright/automation, synthesizing audio in headless Chromium wastes
// CPU and makes timing-sensitive tests flaky — disable audio entirely there.
const IS_AUTOMATED = typeof navigator !== 'undefined' && navigator.webdriver === true

export default function AudioDirector() {
  const currentScreen = useUIStore((s) => s.currentScreen)
  const dayNight = useGameStore((s) => s.dayNight)
  const combatActive = useGameStore((s) => s.engineState?.combat.isActive ?? false)
  const log = useGameStore((s) => s.engineState?.log)

  const masterVolume = useSettingsStore((s) => s.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.sfxVolume)
  const musicVolume = useSettingsStore((s) => s.musicVolume)
  const isMuted = useSettingsStore((s) => s.isMuted)
  const soundEnabled = useSettingsStore((s) => s.soundEnabled)
  const musicEnabled = useSettingsStore((s) => s.musicEnabled)

  const seenLogCountRef = useRef<number | null>(null)
  const lastSfxAtRef = useRef(0)

  // ── Settings → service ────────────────────
  useEffect(() => { audioService.setMasterVolume(masterVolume) }, [masterVolume])
  useEffect(() => { audioService.setSfxVolume(sfxVolume) }, [sfxVolume])
  useEffect(() => { audioService.setMusicVolume(musicVolume) }, [musicVolume])
  useEffect(() => { audioService.setSoundEnabled(soundEnabled) }, [soundEnabled])
  useEffect(() => { audioService.setMusicEnabled(musicEnabled) }, [musicEnabled])
  useEffect(() => {
    if (isMuted !== audioService.isMuted()) audioService.toggleMute()
  }, [isMuted])

  // ── First-gesture unlock + UI click sounds ─
  useEffect(() => {
    if (IS_AUTOMATED) return
    const onPointerDown = (e: PointerEvent) => {
      audioService.unlock()
      const target = e.target as HTMLElement | null
      if (target?.closest('button')) {
        audioService.playSfx('button_click')
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  // ── Music selection ───────────────────────
  useEffect(() => {
    if (IS_AUTOMATED) return
    if (!musicEnabled || isMuted) {
      audioService.stopMusic()
      return
    }
    let track: MusicName
    switch (currentScreen) {
      case 'game':
        track = combatActive ? 'combat' : dayNight === 'night' ? 'game_night' : 'game_day'
        break
      case 'score':
        track = 'score'
        break
      default:
        track = 'menu'
    }
    audioService.playMusic(track)
  }, [currentScreen, dayNight, combatActive, musicEnabled, isMuted])

  // Stop everything on unmount
  useEffect(() => () => audioService.stopMusic(), [])

  // ── Log → SFX ─────────────────────────────
  useEffect(() => {
    if (IS_AUTOMATED || !log) return
    if (seenLogCountRef.current === null || log.length < seenLogCountRef.current) {
      seenLogCountRef.current = log.length
      return
    }
    const fresh = log.slice(seenLogCountRef.current)
    seenLogCountRef.current = log.length

    // Rate-limit: at most one log SFX per 90ms so batched updates don't stack
    for (const entry of fresh) {
      const sfx = LOG_SFX[entry.type]
      if (!sfx) continue
      const now = performance.now()
      if (now - lastSfxAtRef.current < 90) continue
      lastSfxAtRef.current = now
      audioService.playSfx(sfx)
    }
  }, [log])

  return null
}
