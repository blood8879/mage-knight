import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mageknightgame.app',
  appName: 'Mage Knight',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {},
}

export default config
