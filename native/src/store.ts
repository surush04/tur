import * as SecureStore from 'expo-secure-store';

const memory = new Map<string, string>();

export async function readStore(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function writeStore(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* Expo web and some simulators keep the in-memory copy. */
  }
}

export async function removeStore(key: string): Promise<void> {
  memory.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* same fallback as writeStore */
  }
}
