import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function apiUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:3010/api`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:3010/api';
  return 'http://127.0.0.1:3010/api';
}

export function mediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${apiUrl().replace(/\/api$/, '')}${url}`;
}
