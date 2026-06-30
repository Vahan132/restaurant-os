import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper around expo-secure-store (WIRED BUT UNUSED until CX-2).
 *
 * CX-2 will persist the consumer's refresh token here and hydrate `useAuthStore` on
 * launch. Kept tiny and dependency-free so CX-2 can build on it directly.
 *
 * Note: expo-secure-store is a native module. It works in a dev build; under Expo Go
 * it is available on SDK 53 for basic get/set. Not exercised in CX-APP-0.
 */
const KEYS = {
  refreshToken: 'consumer.refreshToken',
} as const;

export type SecureKey = (typeof KEYS)[keyof typeof KEYS];

export const secureStore = {
  keys: KEYS,

  async get(key: SecureKey): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async set(key: SecureKey, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async remove(key: SecureKey): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
