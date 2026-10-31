import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tj.rohi.travel',
  appName: 'Rohi Travel',
  webDir: 'dist/mobile/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
