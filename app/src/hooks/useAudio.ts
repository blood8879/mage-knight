import { useEffect, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { audioService } from '@/services/audioService'
import type { SfxName, MusicName } from '@/services/audioService'

export function useAudio() {
  const masterVolume = useSettingsStore((s) => s.masterVolume)
  const sfxVolume = useSettingsStore((s) => s.sfxVolume)
  const musicVolume = useSettingsStore((s) => s.musicVolume)
  const isMuted = useSettingsStore((s) => s.isMuted)

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current) {
      audioService.init()
      initializedRef.current = true
    }
  }, [])

  useEffect(() => {
    audioService.setMasterVolume(masterVolume)
  }, [masterVolume])

  useEffect(() => {
    audioService.setSfxVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    audioService.setMusicVolume(musicVolume)
  }, [musicVolume])

  useEffect(() => {
    if (isMuted !== audioService.isMuted()) {
      audioService.toggleMute()
    }
  }, [isMuted])

  const playSfx = useCallback((name: SfxName) => {
    void audioService.playSfx(name)
  }, [])

  const playMusic = useCallback((name: MusicName) => {
    void audioService.playMusic(name)
  }, [])

  const stopMusic = useCallback(() => {
    audioService.stopMusic()
  }, [])

  return { playSfx, playMusic, stopMusic }
}
