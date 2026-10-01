import AsyncStorage from '@react-native-async-storage/async-storage';

// Thin JSON wrapper over AsyncStorage (localStorage on web). If storage is
// unavailable (e.g. blocked in a private window) we fall back to memory so the
// app still works for the current visit instead of crashing.

const memoryFallback = new Map<string, string>();

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    const raw = memoryFallback.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  memoryFallback.set(key, raw);
  try {
    await AsyncStorage.setItem(key, raw);
  } catch {
    // Memory copy above keeps the session usable.
  }
}

export async function removeKey(key: string): Promise<void> {
  memoryFallback.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing else to do; the memory copy is already gone.
  }
}
