// apps/web-components/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#FAF6F0',
        terracotta: { DEFAULT: '#9E3B24', dark: '#7A2B18' }, // >= 4.5:1 contrast on parchment
        ink: '#1C1917',
      },
      fontFamily: {
        sans: ['Manrope', 'Noto Sans Ethiopic', 'Nyala', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};