import { create } from 'zustand'
import i18n from '@/i18n/config'

const STORAGE_KEY = 'mageknightAudioSettings'

interface AudioSettings {
  masterVolume: number
  sfxVolume: number
  musicVolume: number
  isMuted: boolean
}

function loadAudioSettings(): AudioSettings {
  const defaults: AudioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    isMuted: false,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      masterVolume: typeof parsed.masterVolume === 'number' ? parsed.masterVolume : defaults.masterVolume,
      sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : defaults.sfxVolume,
      musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : defaults.musicVolume,
      isMuted: typeof parsed.isMuted === 'boolean' ? parsed.isMuted : defaults.isMuted,
    }
  } catch {
    return defaults
  }
}

function persistAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* localStorage unavailable */
  }
}

type Theme = 'dark' | 'light'

interface SettingsState {
  language: string
  theme: Theme
  soundEnabled: boolean
  musicEnabled: boolean
  animationsEnabled: boolean
  masterVolume: number
  sfxVolume: number
  musicVolume: number
  isMuted: boolean
  setLanguage: (lang: string) => void
  setTheme: (theme: Theme) => void
  toggleSound: () => void
  toggleMusic: () => void
  toggleAnimations: () => void
  setMasterVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  setMusicVolume: (volume: number) => void
  toggleMute: () => void
}

const initialAudio = loadAudioSettings()

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: localStorage.getItem('mageknightLang') || 'en',
  theme: (localStorage.getItem('mageknightTheme') as Theme) || 'dark',
  soundEnabled: true,
  musicEnabled: true,
  animationsEnabled: true,
  masterVolume: initialAudio.masterVolume,
  sfxVolume: initialAudio.sfxVolume,
  musicVolume: initialAudio.musicVolume,
  isMuted: initialAudio.isMuted,

  setLanguage: (lang: string) => {
    localStorage.setItem('mageknightLang', lang)
    void i18n.changeLanguage(lang)
    set({ language: lang })
  },

  setTheme: (theme: Theme) => {
    localStorage.setItem('mageknightTheme', theme)
    set({ theme })
  },

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleMusic: () => set((s) => ({ musicEnabled: !s.musicEnabled })),
  toggleAnimations: () =>
    set((s) => ({ animationsEnabled: !s.animationsEnabled })),

  setMasterVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ masterVolume: clamped })
    const s = get()
    persistAudioSettings({ masterVolume: clamped, sfxVolume: s.sfxVolume, musicVolume: s.musicVolume, isMuted: s.isMuted })
  },

  setSfxVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ sfxVolume: clamped })
    const s = get()
    persistAudioSettings({ masterVolume: s.masterVolume, sfxVolume: clamped, musicVolume: s.musicVolume, isMuted: s.isMuted })
  },

  setMusicVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ musicVolume: clamped })
    const s = get()
    persistAudioSettings({ masterVolume: s.masterVolume, sfxVolume: s.sfxVolume, musicVolume: clamped, isMuted: s.isMuted })
  },

  toggleMute: () => {
    const newMuted = !get().isMuted
    set({ isMuted: newMuted })
    const s = get()
    persistAudioSettings({ masterVolume: s.masterVolume, sfxVolume: s.sfxVolume, musicVolume: s.musicVolume, isMuted: newMuted })
  },
}))
