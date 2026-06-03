import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kiosk palette: dark, high-contrast.
        kiosk: {
          bg: '#0a0e14',
          panel: '#141a24',
          border: '#26303f',
          text: '#f4f7fb',
          muted: '#9bb0c9',
        },
        status: {
          sent: '#3b82f6',
          preparing: '#f59e0b',
          ready: '#22c55e',
          delayed: '#ef4444',
        },
      },
      fontSize: {
        // Large type readable across a kitchen.
        kiosk: ['1.5rem', { lineHeight: '2rem' }],
        'kiosk-lg': ['2.25rem', { lineHeight: '2.75rem' }],
        'kiosk-xl': ['3rem', { lineHeight: '3.25rem' }],
      },
    },
  },
  plugins: [],
};

export default config;
