/**
 * Theme tokens — dark, tokenized, brand-neutral.
 *
 * ┌─ PLACEHOLDERS ──────────────────────────────────────────────────────────────┐
 * │ The `accent` color and the app name (see app.config.ts) are PLACEHOLDERS.    │
 * │ `accent` is a single coral/salmon token used for every CTA and active state. │
 * │ When the brand is finalized, swap `accent` / `accentText` here AND in        │
 * │ tailwind.config.js (the two must stay in sync) — that is the only change.    │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * These constants mirror tailwind.config.js so non-className code (status bar,
 * navigator options, vector icons) can reference the same values. Prefer NativeWind
 * classNames in components; use this object where a raw color string is required.
 */
export const colors = {
  // Surfaces
  bg: '#121011',
  surface: '#1C1A1B',
  surfaceAlt: '#262324',
  border: '#332F30',

  // Text
  text: '#FFFFFF',
  textMuted: '#A8A2A4',
  textFaint: '#6E6769',

  // Accent — SINGLE primary. PLACEHOLDER pending brand decision.
  accent: '#FF6F61',
  accentText: '#1A0F0E',
  accentMuted: '#FF6F6133',
} as const;

export const radii = {
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

/** Status bar is light-on-dark across the app. */
export const statusBarStyle = 'light' as const;

export type ThemeColors = typeof colors;
