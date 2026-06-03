import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Table status palette (referenced by the floor-plan legend + tiles).
        status: {
          available: '#16a34a',
          occupied: '#dc2626',
          reserved: '#d97706',
          cleaning: '#2563eb',
          disabled: '#6b7280',
        },
      },
      minHeight: {
        tap: '56px', // minimum touch target
      },
      minWidth: {
        tap: '56px',
      },
      spacing: {
        tap: '56px',
      },
    },
  },
  plugins: [],
};

export default config;
