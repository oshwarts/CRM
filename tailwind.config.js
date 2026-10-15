/** @type {import('tailwindcss').Config} */
// The look follows the brand of A.M.I. Technologies (ami.co.il): navy #00326D and bright blue #1863DC, a light
// Noto Sans Hebrew, airy white surfaces, round (pill) buttons. The slate greys are shifted a step darker (and tinted
// towards the navy) so that hints and labels stay readable.
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dbeafe',
          200: '#b9d3fb',
          300: '#8bb4f6',
          400: '#4f8aea',
          500: '#1863dc',
          600: '#1352b8',
          700: '#0d4090',
          800: '#00326d',
          900: '#00224b',
        },
        slate: {
          ...defaultTheme.colors.slate,
          // text greys: one step darker than the defaults (better contrast), the dark ones tinted navy
          400: '#64748b',
          500: '#4a5a72',
          600: '#364a66',
          700: '#243a5a',
          800: '#0f2a4d',
          900: '#00224b',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans Hebrew"', 'Rubik', 'Assistant', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 50, 109, 0.05), 0 4px 14px rgba(0, 50, 109, 0.05)',
        pop: '0 10px 30px rgba(0, 50, 109, 0.18)',
      },
    },
  },
  plugins: [],
}
