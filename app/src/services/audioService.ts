// ═══════════════════════════════════════════
// Audio Service — procedural WebAudio synthesis
// No asset files: every sound and music track is synthesized at runtime,
// so audio works fully offline and adds zero download weight.
// ═══════════════════════════════════════════

export type SfxName =
  | 'card_play'
  | 'card_draw'
  | 'card_discard'
  | 'combat_start'
  | 'combat_hit'
  | 'combat_block'
  | 'level_up'
  | 'round_start'
  | 'turn_start'
  | 'move'
  | 'button_click'
  | 'victory'
  | 'defeat'
  | 'coin'
  | 'crystal'
  | 'wound'
  | 'heal'

export type MusicName = 'menu' | 'game_day' | 'game_night' | 'combat' | 'score'

// ── Music track definitions ────────────────
// Each track is a looping chord progression rendered as a soft pad, plus an
// optional sparse melody (pentatonic plucks) and combat percussion.

interface TrackDef {
  tempo: number // beats per minute (1 chord = 4 beats)
  chords: number[][] // chord frequencies (Hz) — low register
  scale: number[] // melody note pool (Hz)
  melodyChance: number // probability of a melody note per beat
  brightness: number // lowpass cutoff for pads
  percussion: boolean
  padGain: number
}

const A2 = 110
const semi = (base: number, n: number) => base * Math.pow(2, n / 12)
const chord = (root: number, intervals: number[]) => intervals.map((i) => semi(root, i))
const MIN = [0, 3, 7, 12]
const MAJ = [0, 4, 7, 12]

const TRACKS: Record<MusicName, TrackDef> = {
  menu: {
    tempo: 50,
    chords: [chord(A2, MIN), chord(semi(A2, -4), MAJ), chord(semi(A2, 3), MAJ), chord(semi(A2, -2), MAJ)], // Am F C G
    scale: [semi(A2, 24), semi(A2, 27), semi(A2, 31), semi(A2, 36), semi(A2, 39)],
    melodyChance: 0.18,
    brightness: 900,
    percussion: false,
    padGain: 0.5,
  },
  game_day: {
    tempo: 58,
    chords: [chord(semi(A2, 3), MAJ), chord(semi(A2, -2), MAJ), chord(A2, MIN), chord(semi(A2, -4), MAJ)], // C G Am F
    scale: [semi(A2, 27), semi(A2, 29), semi(A2, 31), semi(A2, 34), semi(A2, 36), semi(A2, 39)],
    melodyChance: 0.22,
    brightness: 1400,
    percussion: false,
    padGain: 0.42,
  },
  game_night: {
    tempo: 44,
    chords: [chord(A2, MIN), chord(semi(A2, 7), MIN), chord(semi(A2, -4), MAJ), chord(semi(A2, 7), MIN)], // Am Em F Em
    scale: [semi(A2, 24), semi(A2, 27), semi(A2, 31), semi(A2, 34)],
    melodyChance: 0.1,
    brightness: 700,
    percussion: false,
    padGain: 0.48,
  },
  combat: {
    tempo: 96,
    chords: [chord(semi(A2, 5), MIN), chord(semi(A2, 5), MIN), chord(semi(A2, 1), MAJ), chord(semi(A2, 3), MIN)], // Dm Dm Bb Cm
    scale: [semi(A2, 17), semi(A2, 20), semi(A2, 24), semi(A2, 27)],
    melodyChance: 0.12,
    brightness: 1100,
    percussion: true,
    padGain: 0.4,
  },
  score: {
    tempo: 54,
    chords: [chord(semi(A2, 3), MAJ), chord(semi(A2, -4), MAJ), chord(semi(A2, -2), MAJ), chord(semi(A2, 3), MAJ)], // C F G C
    scale: [semi(A2, 27), semi(A2, 31), semi(A2, 34), semi(A2, 39)],
    melodyChance: 0.25,
    brightness: 1600,
    percussion: false,
    padGain: 0.45,
  },
}

class AudioService {
  #ctx: AudioContext | null = null
  #masterGain: GainNode | null = null
  #musicGain: GainNode | null = null
  #sfxGain: GainNode | null = null

  #masterVolume = 0.7
  #sfxVolume = 0.8
  #musicVolume = 0.5
  #muted = false
  #soundEnabled = true
  #musicEnabled = true

  #currentTrack: MusicName | null = null
  #schedulerId: ReturnType<typeof setInterval> | null = null
  #nextChordTime = 0
  #chordIndex = 0
  #noiseBuffer: AudioBuffer | null = null

  // ── Lifecycle ─────────────────────────────

  init(): void {
    if (this.#ctx) return
    try {
      this.#ctx = new AudioContext()
      this.#masterGain = this.#ctx.createGain()
      this.#masterGain.connect(this.#ctx.destination)
      this.#musicGain = this.#ctx.createGain()
      this.#musicGain.connect(this.#masterGain)
      this.#sfxGain = this.#ctx.createGain()
      this.#sfxGain.connect(this.#masterGain)
      this.#applyVolumes()
    } catch {
      /* graceful degradation */
    }
  }

  /** Browsers start AudioContext suspended until a user gesture. */
  unlock(): void {
    this.init()
    if (this.#ctx && this.#ctx.state === 'suspended') {
      void this.#ctx.resume()
    }
  }

  #applyVolumes(): void {
    if (!this.#ctx) return
    const t = this.#ctx.currentTime
    this.#masterGain?.gain.setTargetAtTime(this.#muted ? 0 : this.#masterVolume, t, 0.05)
    this.#musicGain?.gain.setTargetAtTime(this.#musicEnabled ? this.#musicVolume : 0, t, 0.1)
    this.#sfxGain?.gain.setTargetAtTime(this.#soundEnabled ? this.#sfxVolume : 0, t, 0.05)
  }

  #noise(): AudioBuffer | null {
    if (!this.#ctx) return null
    if (this.#noiseBuffer) return this.#noiseBuffer
    const len = this.#ctx.sampleRate
    const buf = this.#ctx.createBuffer(1, len, this.#ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.#noiseBuffer = buf
    return buf
  }

  // ── Low-level synth helpers ───────────────

  #tone(opts: {
    freq: number
    type?: OscillatorType
    start?: number
    attack?: number
    hold?: number
    release?: number
    gain?: number
    detune?: number
    glideTo?: number
    filterFreq?: number
    out?: AudioNode | null
  }): void {
    const ctx = this.#ctx
    const out = opts.out ?? this.#sfxGain
    if (!ctx || !out) return
    const t0 = ctx.currentTime + (opts.start ?? 0)
    const attack = opts.attack ?? 0.005
    const hold = opts.hold ?? 0.05
    const release = opts.release ?? 0.08
    const peak = opts.gain ?? 0.3

    const osc = ctx.createOscillator()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(opts.freq, t0)
    if (opts.detune) osc.detune.value = opts.detune
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + attack + hold + release)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(peak, t0 + attack)
    env.gain.setValueAtTime(peak, t0 + attack + hold)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release)

    let head: AudioNode = env
    if (opts.filterFreq) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = opts.filterFreq
      env.connect(filter)
      head = filter
    }
    osc.connect(env)
    head.connect(out)
    osc.start(t0)
    osc.stop(t0 + attack + hold + release + 0.05)
  }

  #noiseHit(opts: {
    start?: number
    duration?: number
    gain?: number
    filterFreq?: number
    filterType?: BiquadFilterType
    out?: AudioNode | null
  }): void {
    const ctx = this.#ctx
    const out = opts.out ?? this.#sfxGain
    const buf = this.#noise()
    if (!ctx || !out || !buf) return
    const t0 = ctx.currentTime + (opts.start ?? 0)
    const dur = opts.duration ?? 0.12

    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = opts.filterType ?? 'bandpass'
    filter.frequency.value = opts.filterFreq ?? 1800
    const env = ctx.createGain()
    env.gain.setValueAtTime(opts.gain ?? 0.25, t0)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(env)
    env.connect(out)
    src.start(t0)
    src.stop(t0 + dur + 0.05)
  }

  // ── SFX ───────────────────────────────────

  playSfx(name: SfxName): void {
    if (this.#muted || !this.#soundEnabled) return
    this.unlock()
    if (!this.#ctx) return

    switch (name) {
      case 'button_click':
        this.#tone({ freq: 720, type: 'triangle', hold: 0.012, release: 0.05, gain: 0.12 })
        break
      case 'card_draw':
        this.#noiseHit({ duration: 0.1, gain: 0.14, filterFreq: 2600 })
        this.#tone({ freq: 520, type: 'sine', start: 0.02, hold: 0.02, release: 0.07, gain: 0.08 })
        break
      case 'card_play':
        this.#noiseHit({ duration: 0.14, gain: 0.16, filterFreq: 2000 })
        this.#tone({ freq: 440, type: 'triangle', hold: 0.03, release: 0.12, gain: 0.14 })
        this.#tone({ freq: 660, type: 'triangle', start: 0.05, hold: 0.03, release: 0.14, gain: 0.1 })
        break
      case 'card_discard':
        this.#noiseHit({ duration: 0.16, gain: 0.12, filterFreq: 1200 })
        this.#tone({ freq: 300, type: 'sine', glideTo: 180, hold: 0.04, release: 0.12, gain: 0.1 })
        break
      case 'move':
        this.#tone({ freq: 200, type: 'sine', glideTo: 130, hold: 0.03, release: 0.1, gain: 0.16 })
        this.#noiseHit({ duration: 0.07, gain: 0.06, filterFreq: 600, filterType: 'lowpass' })
        break
      case 'turn_start':
        this.#tone({ freq: 587, type: 'sine', hold: 0.04, release: 0.25, gain: 0.12 })
        this.#tone({ freq: 880, type: 'sine', start: 0.1, hold: 0.04, release: 0.3, gain: 0.1 })
        break
      case 'round_start':
        this.#tone({ freq: 392, type: 'triangle', hold: 0.08, release: 0.3, gain: 0.16 })
        this.#tone({ freq: 523, type: 'triangle', start: 0.14, hold: 0.08, release: 0.35, gain: 0.14 })
        this.#tone({ freq: 784, type: 'triangle', start: 0.28, hold: 0.1, release: 0.5, gain: 0.12 })
        break
      case 'combat_start':
        this.#tone({ freq: 98, type: 'sawtooth', hold: 0.12, release: 0.4, gain: 0.22, filterFreq: 400 })
        this.#tone({ freq: 110, type: 'sawtooth', start: 0.02, detune: 12, hold: 0.12, release: 0.4, gain: 0.18, filterFreq: 380 })
        this.#noiseHit({ duration: 0.35, gain: 0.2, filterFreq: 250, filterType: 'lowpass' })
        break
      case 'combat_hit':
        this.#noiseHit({ duration: 0.12, gain: 0.3, filterFreq: 900 })
        this.#tone({ freq: 150, type: 'square', glideTo: 70, hold: 0.03, release: 0.12, gain: 0.22, filterFreq: 800 })
        break
      case 'combat_block':
        this.#tone({ freq: 1180, type: 'square', hold: 0.015, release: 0.16, gain: 0.12, filterFreq: 3200 })
        this.#tone({ freq: 1750, type: 'square', start: 0.012, hold: 0.012, release: 0.12, gain: 0.08, filterFreq: 4000 })
        this.#noiseHit({ duration: 0.08, gain: 0.1, filterFreq: 3500 })
        break
      case 'level_up':
        ;[523, 659, 784, 1046].forEach((f, i) =>
          this.#tone({ freq: f, type: 'triangle', start: i * 0.09, hold: 0.06, release: 0.3, gain: 0.14 }),
        )
        break
      case 'coin':
        this.#tone({ freq: 988, type: 'square', hold: 0.02, release: 0.1, gain: 0.08, filterFreq: 4200 })
        this.#tone({ freq: 1319, type: 'square', start: 0.06, hold: 0.03, release: 0.18, gain: 0.08, filterFreq: 4200 })
        break
      case 'crystal':
        this.#tone({ freq: 1567, type: 'sine', hold: 0.02, release: 0.4, gain: 0.1 })
        this.#tone({ freq: 2093, type: 'sine', start: 0.05, hold: 0.02, release: 0.5, gain: 0.08 })
        break
      case 'wound':
        this.#tone({ freq: 220, type: 'sawtooth', glideTo: 110, hold: 0.06, release: 0.25, gain: 0.16, filterFreq: 900 })
        this.#noiseHit({ duration: 0.18, gain: 0.12, filterFreq: 500, filterType: 'lowpass' })
        break
      case 'heal':
        this.#tone({ freq: 660, type: 'sine', hold: 0.05, release: 0.35, gain: 0.1 })
        this.#tone({ freq: 990, type: 'sine', start: 0.09, hold: 0.05, release: 0.4, gain: 0.08 })
        break
      case 'victory':
        ;[523, 659, 784, 1046, 1319].forEach((f, i) =>
          this.#tone({ freq: f, type: 'triangle', start: i * 0.13, hold: 0.1, release: 0.45, gain: 0.15 }),
        )
        break
      case 'defeat':
        ;[392, 370, 330, 262].forEach((f, i) =>
          this.#tone({ freq: f, type: 'triangle', start: i * 0.22, hold: 0.14, release: 0.5, gain: 0.14 }),
        )
        break
    }
  }

  // ── Generative music ──────────────────────

  playMusic(name: MusicName): void {
    if (this.#currentTrack === name) return
    this.stopMusic()
    this.#currentTrack = name
    this.unlock()
    if (!this.#ctx || !this.#musicGain) return

    this.#chordIndex = 0
    this.#nextChordTime = this.#ctx.currentTime + 0.1

    // Lookahead scheduler: keep ~1.2s of audio queued
    this.#schedulerId = setInterval(() => this.#scheduleAhead(), 250)
    this.#scheduleAhead()
  }

  #scheduleAhead(): void {
    const ctx = this.#ctx
    const track = this.#currentTrack ? TRACKS[this.#currentTrack] : null
    if (!ctx || !track || !this.#musicGain) return

    const chordDur = (60 / track.tempo) * 4
    while (this.#nextChordTime < ctx.currentTime + 1.2) {
      const t = this.#nextChordTime
      const freqs = track.chords[this.#chordIndex % track.chords.length]
      this.#schedulePad(freqs, t, chordDur, track)
      if (track.percussion) this.#schedulePercussion(t, chordDur)
      this.#scheduleMelody(t, chordDur, track)
      this.#chordIndex++
      this.#nextChordTime += chordDur
    }
  }

  #schedulePad(freqs: number[], t: number, dur: number, track: TrackDef): void {
    const ctx = this.#ctx
    if (!ctx || !this.#musicGain) return
    const overlap = 0.8 // pads crossfade into the next chord

    for (const f of freqs) {
      for (const detune of [-5, 4]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        osc.detune.value = detune

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = track.brightness

        const env = ctx.createGain()
        const peak = (track.padGain / freqs.length) * 0.5
        env.gain.setValueAtTime(0.0001, t)
        env.gain.linearRampToValueAtTime(peak, t + dur * 0.35)
        env.gain.setValueAtTime(peak, t + dur * 0.7)
        env.gain.linearRampToValueAtTime(0.0001, t + dur + overlap)

        osc.connect(filter)
        filter.connect(env)
        env.connect(this.#musicGain)
        osc.start(t)
        osc.stop(t + dur + overlap + 0.1)
      }
    }
  }

  #scheduleMelody(t: number, dur: number, track: TrackDef): void {
    const ctx = this.#ctx
    if (!ctx || !this.#musicGain) return
    const beats = 4
    const beatDur = dur / beats
    for (let b = 0; b < beats; b++) {
      if (Math.random() > track.melodyChance) continue
      const freq = track.scale[Math.floor(Math.random() * track.scale.length)]
      const start = t + b * beatDur + Math.random() * beatDur * 0.3 - ctx.currentTime
      this.#tone({
        freq,
        type: 'sine',
        start: Math.max(0, start),
        attack: 0.01,
        hold: 0.08,
        release: 1.2,
        gain: 0.06,
        out: this.#musicGain,
      })
    }
  }

  #schedulePercussion(t: number, dur: number): void {
    const ctx = this.#ctx
    if (!ctx || !this.#musicGain) return
    const beats = 8
    const beatDur = dur / beats
    for (let b = 0; b < beats; b++) {
      const start = t + b * beatDur
      const isDownbeat = b % 2 === 0
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(isDownbeat ? 70 : 58, start)
      osc.frequency.exponentialRampToValueAtTime(38, start + 0.1)
      const env = ctx.createGain()
      env.gain.setValueAtTime(isDownbeat ? 0.3 : 0.16, start)
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      osc.connect(env)
      env.connect(this.#musicGain)
      osc.start(start)
      osc.stop(start + 0.25)
    }
  }

  stopMusic(): void {
    if (this.#schedulerId != null) {
      clearInterval(this.#schedulerId)
      this.#schedulerId = null
    }
    this.#currentTrack = null
    // Already-scheduled pads decay on their own envelopes; duck the bus so
    // the previous track does not bleed into the next one.
    if (this.#ctx && this.#musicGain) {
      const t = this.#ctx.currentTime
      this.#musicGain.gain.cancelScheduledValues(t)
      this.#musicGain.gain.setTargetAtTime(0, t, 0.15)
      this.#musicGain.gain.setTargetAtTime(this.#musicEnabled ? this.#musicVolume : 0, t + 0.6, 0.2)
    }
  }

  get currentTrack(): MusicName | null {
    return this.#currentTrack
  }

  // ── Settings ──────────────────────────────

  setMasterVolume(volume: number): void {
    this.#masterVolume = Math.max(0, Math.min(1, volume))
    this.#applyVolumes()
  }

  setSfxVolume(volume: number): void {
    this.#sfxVolume = Math.max(0, Math.min(1, volume))
    this.#applyVolumes()
  }

  setMusicVolume(volume: number): void {
    this.#musicVolume = Math.max(0, Math.min(1, volume))
    this.#applyVolumes()
  }

  setSoundEnabled(enabled: boolean): void {
    this.#soundEnabled = enabled
    this.#applyVolumes()
  }

  setMusicEnabled(enabled: boolean): void {
    this.#musicEnabled = enabled
    this.#applyVolumes()
  }

  isMuted(): boolean {
    return this.#muted
  }

  toggleMute(): void {
    this.#muted = !this.#muted
    this.#applyVolumes()
  }
}

export const audioService = new AudioService()
