import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { adService } from '@/services/adService'

interface AdBannerProps {
  slotId?: string
  className?: string
}

const DEFAULT_SLOT_ID = 'mk-banner-default'

export default function AdBanner({ slotId, className = '' }: AdBannerProps) {
  const { t } = useTranslation('ui')
  const [online, setOnline] = useState(() => adService.isOnline())
  const [adLoaded, setAdLoaded] = useState(false)

  useEffect(() => {
    adService.init()

    const checkOnline = () => setOnline(adService.isOnline())
    window.addEventListener('online', checkOnline)
    window.addEventListener('offline', checkOnline)

    return () => {
      window.removeEventListener('online', checkOnline)
      window.removeEventListener('offline', checkOnline)
    }
  }, [])

  useEffect(() => {
    if (!online) {
      setAdLoaded(false)
      return
    }

    const resolvedSlot = slotId ?? DEFAULT_SLOT_ID
    adService.loadBanner(resolvedSlot).then(() => {
      setAdLoaded(adService.isAdReady('banner'))
    })

    // Native AdMob banners are system overlays — remove when this screen
    // unmounts so they never cover gameplay
    return () => {
      if (Capacitor.isNativePlatform()) {
        void adService.hideBanner()
      }
    }
  }, [online, slotId])

  if (!online) return null

  // On native the banner floats over the WebView at the bottom of the screen;
  // rendering the DOM placeholder too would just double it up
  if (Capacitor.isNativePlatform()) return null

  // No ad loaded → render nothing instead of an empty grey box
  if (!adLoaded) return null

  return (
    <div
      className={[
        'flex items-center justify-center',
        'w-full max-w-[320px] h-[50px] mx-auto',
        'rounded-md overflow-hidden',
        'bg-slate-800 border border-slate-700/40',
        className,
      ].join(' ')}
      role="complementary"
      aria-label={t('ad.banner', 'Advertisement')}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        data-ad-slot={slotId ?? DEFAULT_SLOT_ID}
      />
    </div>
  )
}
