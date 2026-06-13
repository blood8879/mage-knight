import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/i18n/config'
import App from './App.tsx'
import { adService } from '@/services/adService'

// Initialize ads early so fullscreen formats are preloaded before the first
// round transition (native AdMob on Android, graceful no-op on the web)
adService.init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
