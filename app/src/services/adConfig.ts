/**
 * AdMob configuration.
 *
 * By default the official Google TEST ad unit IDs are used, so development
 * and review builds never serve (or click-fraud) real ads.
 *
 * To go live, create a `.env.production` (or `.env.local`) with your real
 * AdMob IDs — no code change needed:
 *
 *   VITE_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
 *   VITE_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/BBBBBBBBBB
 *   VITE_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/IIIIIIIIII
 *   VITE_ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXXXXXXXXXX/RRRRRRRRRR
 *
 * The Android APPLICATION_ID lives in android/app/src/main/AndroidManifest.xml
 * (com.google.android.gms.ads.APPLICATION_ID) — replace it there for release.
 */

// Google's official test ad unit IDs (safe to click, always fill)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'

const env = import.meta.env as Record<string, string | undefined>

export const AD_CONFIG = {
  bannerId: env.VITE_ADMOB_BANNER_ID ?? TEST_BANNER_ID,
  interstitialId: env.VITE_ADMOB_INTERSTITIAL_ID ?? TEST_INTERSTITIAL_ID,
  rewardedId: env.VITE_ADMOB_REWARDED_ID ?? TEST_REWARDED_ID,
  /** true while running on Google's test ad units */
  isTesting: !env.VITE_ADMOB_BANNER_ID,
} as const
