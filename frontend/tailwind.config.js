/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          dark: '#1d4ed8',
          light: '#3b82f6',
        },
        secondary: {
          DEFAULT: '#0EA5E9',
          dark: '#0369a1',
          light: '#38bdf8',
        },
        accent: {
          DEFAULT: '#14B8A6',
          dark: '#0f766e',
          light: '#2dd4bf',
        },
        dark: {
          bg: '#020617',
          panel: '#0f172a',
          border: 'rgba(255, 255, 255, 0.08)',
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
