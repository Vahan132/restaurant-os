import Constants from 'expo-constants';

/**
 * Single typed accessor for runtime config.
 *
 * `EXPO_PUBLIC_API_BASE_URL` is injected at build time. We read it from
 * `expoConfig.extra.apiBaseUrl` (populated in app.config.ts) with a fallback to the
 * raw env var so it works in every Expo runtime (Go, dev build, web).
 *
 * No host is ever hardcoded — set EXPO_PUBLIC_API_BASE_URL in your environment / .env.
 */
const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

export const API_BASE_URL: string =
  fromExtra || process.env.EXPO_PUBLIC_API_BASE_URL || '';

if (!API_BASE_URL) {
  // Surfaced loudly in dev so a missing base URL isn't mistaken for a network error.
  console.warn(
    '[config] EXPO_PUBLIC_API_BASE_URL is not set. API calls will fail until you ' +
      'set it (see .env.example) and restart the dev server.',
  );
}
