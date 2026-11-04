/** @type {import('tailwindcss').Config} */
// Design tokens (dark-first, brand-neutral). Keep in sync with src/theme/theme.ts.
//
// PLACEHOLDER: `accent` is the single coral/salmon primary used for CTAs and active
// states. It is intentionally one token so it can be swapped in one place when the
// brand is finalized. See src/theme/theme.ts for the canonical documentation.
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: '#121011', // app background — near-black, slightly warm
        surface: '#1C1A1B', // cards — one step lighter
        surfaceAlt: '#262324', // inputs / bottom sheets
        border: '#332F30', // subtle hairline

        // Text
        text: '#FFFFFF',
        textMuted: '#A8A2A4',
        textFaint: '#6E6769',

        // Accent — SINGLE coral/salmon primary. PLACEHOLDER pending brand.
        accent: '#FF6F61',
        accentText: '#1A0F0E', // on-accent foreground (dark text on coral)
        accentMuted: '#FF6F6133', // 20% — outline/active-tint variant
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};
