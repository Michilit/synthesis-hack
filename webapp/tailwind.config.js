/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        guardian: { 50: '#faf5ff', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 900: '#3b0764' },
        dpi: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
        treasury: { 50: '#fffbeb', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' }
      },
      animation: { 'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }
    }
  },
  plugins: []
}
