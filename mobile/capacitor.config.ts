import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tj.rohi.travel',
  appName: 'Rohi Travel',
  webDir: 'dist/mobile/browser',
  // По умолчанию console.log попадает в Logcat только в debug-сборке.
  loggingBehavior: 'production',
  server: {
    androidScheme: 'https',
  },
  android: {
    // Страница открыта как https://localhost, а API пока на http://162.35.185.15:3010.
    // Без этого WebView блокирует такие запросы. Убрать, когда API будет на https.
    allowMixedContent: true,
  },
};

export default config;
