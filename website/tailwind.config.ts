import type { Config } from "tailwindcss";

/**
 * Restaurant OS — Tailwind theme.
 *
 * The single source of truth for raw values is `src/styles/tokens.css`
 * (CSS custom properties). This config maps those tokens onto Tailwind's
 * utility namespace so the whole UI is built from the same vocabulary.
 * Changing a brand value should mean editing tokens.css, not this file.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}", "./mdx-components.tsx"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        sand: "rgb(var(--color-sand) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--color-ink-soft) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        terracotta: {
          DEFAULT: "rgb(var(--color-terracotta) / <alpha-value>)",
          ink: "rgb(var(--color-terracotta-ink) / <alpha-value>)",
          soft: "rgb(var(--color-terracotta-soft) / <alpha-value>)",
        },
        saffron: "rgb(var(--color-saffron) / <alpha-value>)",
        sage: {
          DEFAULT: "rgb(var(--color-sage) / <alpha-value>)",
          deep: "rgb(var(--color-sage-deep) / <alpha-value>)",
          soft: "rgb(var(--color-sage-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // airy, editorial scale
        "2xs": ["0.75rem", { lineHeight: "1.1rem", letterSpacing: "0.04em" }],
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.55rem" }],
        base: ["1.0625rem", { lineHeight: "1.7rem" }],
        lg: ["1.1875rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.8rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.1rem", letterSpacing: "-0.01em" }],
        "3xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
        "4xl": ["3rem", { lineHeight: "3.1rem", letterSpacing: "-0.025em" }],
        "5xl": ["3.75rem", { lineHeight: "3.85rem", letterSpacing: "-0.03em" }],
        "6xl": ["4.75rem", { lineHeight: "4.85rem", letterSpacing: "-0.035em" }],
        "7xl": ["6rem", { lineHeight: "1", letterSpacing: "-0.04em" }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        glow: "var(--shadow-glow)",
      },
      maxWidth: {
        prose: "68ch",
        container: "1200px",
        wide: "1320px",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out-expo)",
        "out-soft": "var(--ease-out-soft)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      letterSpacing: {
        tightest: "-0.04em",
        eyebrow: "0.18em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "subtle-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-up": "fade-up var(--dur-slow) var(--ease-out-expo) both",
        "subtle-float": "subtle-float 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
