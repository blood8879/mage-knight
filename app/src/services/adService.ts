import { Capacitor } from '@capacitor/core'
import { AD_CONFIG } from './adConfig'

// ── Ad Types ────────────────────────────────

export type AdType = 'banner' | 'interstitial' | 'rewarded'
export type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'error'
export interface AdReward {
  type: 'retry' | 'hint'
  amount: number
}

// ── Window augmentation for AdSense (web) ───

interface AdsByGoogle {
  push(params: Record<string, unknown>): void
}

declare global {
  interface Window {
    adsbygoogle?: AdsByGoogle
  }
}

/** Lazy native plugin accessor — keeps the web bundle free of the plugin */
async function admob() {
  const mod = await import('@capacitor-community/admob')
  return mod
}

/**
 * Platform-aware ad service.
 *
 * Native (Android via Capacitor): Google AdMob through
 * @capacitor-community/admob — test ad units by default (see adConfig.ts).
 *
 * Web: AdSense placeholder behaviour (graceful no-op without a publisher
 * script); the game must never depend on an ad actually showing.
 */
class AdService {
  #online = typeof navigator !== 'undefined' ? navigator.onLine : true
  #states: Record<AdType, AdState> = {
    banner: 'idle',
    interstitial: 'idle',
    rewarded: 'idle',
  }
  #initialized = false
  #nativeReady = false
  #initPromise: Promise<void> | null = null
  #handleOnline: (() => void) | null = null
  #handleOffline: (() => void) | null = null

  onRewardEarned: ((reward: AdReward) => void) | null = null

  get #isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  // ── Initialization ──────────────────────

  init(): void {
    if (this.#initialized) return
    this.#initialized = true

    this.#handleOnline = () => {
      this.#online = true
    }
    this.#handleOffline = () => {
      this.#online = false
    }

    window.addEventListener('online', this.#handleOnline)
    window.addEventListener('offline', this.#handleOffline)

    if (this.#isNative) {
      this.#initPromise = this.#initNative()
    }
  }

  /** Wait for native AdMob initialization; false on web or init failure */
  async #ensureNative(): Promise<boolean> {
    if (!this.#isNative) return false
    if (this.#initPromise) await this.#initPromise
    return this.#nativeReady
  }

  async #initNative(): Promise<void> {
    try {
      const { AdMob } = await admob()
      await AdMob.initialize({ initializeForTesting: AD_CONFIG.isTesting })
      this.#nativeReady = true
      // Preload fullscreen formats so round transitions don't wait on network
      void this.preloadInterstitial()
      void this.preloadRewarded()
    } catch (error) {
      console.error('AdMob initialization failed:', error)
      this.#nativeReady = false
    }
  }

  // ── Network detection ───────────────────

  isOnline(): boolean {
    return this.#online
  }

  // ── State queries ───────────────────────

  isAdReady(type: AdType): boolean {
    return this.#states[type] === 'ready'
  }

  getState(type: AdType): AdState {
    return this.#states[type]
  }

  // ── Banner ──────────────────────────────

  async loadBanner(slotId: string): Promise<void> {
    if (!this.#online) return
    this.#states.banner = 'loading'

    try {
      if (await this.#ensureNative()) {
        const { AdMob, BannerAdSize, BannerAdPosition } = await admob()
        await AdMob.showBanner({
          adId: AD_CONFIG.bannerId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          isTesting: AD_CONFIG.isTesting,
        })
      } else if (window.adsbygoogle) {
        // Web: AdSense slot fill
        window.adsbygoogle.push({ slotId })
      }
      this.#states.banner = 'ready'
    } catch {
      this.#states.banner = 'error'
    }
  }

  async hideBanner(): Promise<void> {
    if (this.#isNative && this.#nativeReady) {
      try {
        const { AdMob } = await admob()
        await AdMob.removeBanner()
      } catch {
        // banner may not be shown — ignore
      }
    }
    this.#states.banner = 'idle'
  }

  // ── Interstitial ────────────────────────

  async preloadInterstitial(): Promise<void> {
    if (!this.#online) return
    this.#states.interstitial = 'loading'

    try {
      if (await this.#ensureNative()) {
        const { AdMob } = await admob()
        await AdMob.prepareInterstitial({
          adId: AD_CONFIG.interstitialId,
          isTesting: AD_CONFIG.isTesting,
        })
      } else {
        await this.#simulateAdLoad()
      }
      this.#states.interstitial = 'ready'
    } catch {
      this.#states.interstitial = 'error'
    }
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.#online) return false
    if (!this.isAdReady('interstitial')) {
      await this.preloadInterstitial()
      if (!this.isAdReady('interstitial')) return false
    }

    try {
      this.#states.interstitial = 'showing'
      if (await this.#ensureNative()) {
        const { AdMob } = await admob()
        await AdMob.showInterstitial()
        // Prepare the next one in the background
        void this.preloadInterstitial()
      } else {
        await this.#simulateAdDisplay()
      }
      this.#states.interstitial = 'idle'
      return true
    } catch {
      this.#states.interstitial = 'error'
      return false
    }
  }

  // ── Rewarded ────────────────────────────

  async preloadRewarded(): Promise<void> {
    if (!this.#online) return
    this.#states.rewarded = 'loading'

    try {
      if (await this.#ensureNative()) {
        const { AdMob } = await admob()
        await AdMob.prepareRewardVideoAd({
          adId: AD_CONFIG.rewardedId,
          isTesting: AD_CONFIG.isTesting,
        })
      } else {
        await this.#simulateAdLoad()
      }
      this.#states.rewarded = 'ready'
    } catch {
      this.#states.rewarded = 'error'
    }
  }

  async showRewarded(): Promise<boolean> {
    if (!this.#online) return false
    if (!this.isAdReady('rewarded')) {
      await this.preloadRewarded()
      if (!this.isAdReady('rewarded')) return false
    }

    try {
      this.#states.rewarded = 'showing'
      if (await this.#ensureNative()) {
        const { AdMob } = await admob()
        const result = await AdMob.showRewardVideoAd()
        // result is the AdMobRewardItem when the user earned the reward
        if (result && this.onRewardEarned) {
          this.onRewardEarned({ type: 'retry', amount: result.amount ?? 1 })
        }
        void this.preloadRewarded()
      } else {
        await this.#simulateAdDisplay()
      }
      this.#states.rewarded = 'idle'
      return true
    } catch {
      this.#states.rewarded = 'error'
      return false
    }
  }

  // ── Cleanup ─────────────────────────────

  destroy(): void {
    if (this.#handleOnline) {
      window.removeEventListener('online', this.#handleOnline)
    }
    if (this.#handleOffline) {
      window.removeEventListener('offline', this.#handleOffline)
    }
    this.#handleOnline = null
    this.#handleOffline = null
    this.#initialized = false
    this.onRewardEarned = null
    this.#states = { banner: 'idle', interstitial: 'idle', rewarded: 'idle' }
  }

  // ── Web simulation helpers ──────────────

  #simulateAdLoad(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 300)
    })
  }

  #simulateAdDisplay(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 500)
    })
  }
}

export const adService = new AdService()
