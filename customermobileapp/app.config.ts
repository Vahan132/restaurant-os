import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * App config.
 *
 * NOTE (placeholders): `name`, `slug`, and the iOS/Android bundle identifiers below
 * are PLACEHOLDERS. Replace them with the real brand identifiers once the brand is
 * finalized. See README "Placeholders".
 *
 * `EXPO_PUBLIC_API_BASE_URL` is read from the environment and surfaced to runtime code
 * via `expo-constants` (`Constants.expoConfig.extra.apiBaseUrl`). It is also directly
 * readable as `process.env.EXPO_PUBLIC_API_BASE_URL` because of the EXPO_PUBLIC_ prefix;
 * exposing it through `extra` as well gives a single typed accessor (see src/config.ts).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Consumer App', // PLACEHOLDER brand name
  slug: 'consumer-app', // PLACEHOLDER slug
  scheme: 'consumerapp', // PLACEHOLDER deep-link scheme
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.example.consumerapp', // PLACEHOLDER
    usesAppleSignIn: true, // CX-APP-2: Apple sign-in entitlement (dev build)
  },
  android: {
    package: 'com.example.consumerapp', // PLACEHOLDER
    edgeToEdgeEnabled: true,
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    'expo-web-browser',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Single typed source of the API base URL for runtime (see src/config.ts).
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    // Google OAuth client IDs (expo-auth-session). Set the EXPO_PUBLIC_GOOGLE_* env
    // vars from your Google Cloud OAuth credentials; blank → the Google button errors
    // gracefully (OTP/Apple still work). See README.
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  },
});
