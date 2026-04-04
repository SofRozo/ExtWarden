import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './popup.html', './options.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        surface: {
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
        },
        risk: {
          criticalBg:   '#fef2f2',
          criticalText: '#991b1b',
          warningBg:    '#fffbeb',
          warningText:  '#92400e',
          safeBg:       '#ecfdf5',
          safeText:     '#065f46',
        },
      },
      fontFamily: {
        sans: ["'Inter'", '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
