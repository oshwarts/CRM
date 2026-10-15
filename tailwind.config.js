/** @type {import('tailwindcss').Config} */
// The look follows the brand of A.M.I. Technologies (ami.co.il): navy #00326D and bright blue #1863DC, a light
// Noto Sans Hebrew, airy white surfaces, round (pill) buttons. The colour scales are CSS variables (src/theme.css)
// so that the same classes work in the light and in the dark theme.
import defaultTheme from 'tailwindcss/defaultTheme'

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]
const scale = (name) => Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]))

const brand = scale('brand')
const amber = scale('amber')
const red = scale('red')
const emerald = scale('emerald')

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand,
        accent: '#cc3366',
        // one calm colour language: blue = information and navigation, amber = needs attention,
        // red = urgent / late, green = done / fine. The other hues of the default palette point at these.
        sky: brand,
        blue: brand,
        violet: brand,
        indigo: brand,
        purple: brand,
        amber,
        fuchsia: amber,
        orange: amber,
        yellow: amber,
        red,
        pink: red,
        rose: red,
        emerald,
        green: emerald,
        slate: scale('slate'),
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
