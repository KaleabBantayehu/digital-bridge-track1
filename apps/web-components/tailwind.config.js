// apps/web-components/tailwind.config.js
// Warm Ethiopian palette. Contrast (checked with the WCAG formula):
//   ink #1C1917 on parchment #FAF7F2 = 16.4:1 · terracotta #9E3B24 on parchment = 6.3:1 · white on terracotta = 6.8:1
//   terracotta-dark #7A2B18 on parchment = 9.0:1, on terracotta-tint #F6E7E1 = 8.0:1 · lagoon #0C4243 on lagoon-light #E3EFEE = 9.5:1
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#FAF7F2',
        sand: { DEFAULT: '#D6CFC2', light: '#EFE9DF' },
        terracotta: { DEFAULT: '#9E3B24', dark: '#7A2B18', darker: '#5B1D13', tint: '#F6E7E1' },
        lagoon: { DEFAULT: '#0C4243', light: '#E3EFEE' },
        ink: '#1C1917',
      },
      fontFamily: {
        // --db-font follows the host's Bootstrap font when it has one (see styles/index.css).
        sans: ['var(--db-font)'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.06), 0 4px 16px rgba(28, 25, 23, 0.06)',
      },
    },
  },
  plugins: [],
};
