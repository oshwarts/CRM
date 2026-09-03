/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3ff',
          100: '#dbe5ff',
          200: '#bcd0ff',
          300: '#8fb0ff',
          400: '#5f8bfb',
          500: '#4f7cf7',
          600: '#3a5fe0',
          700: '#2f4bb8',
          800: '#2a4193',
          900: '#283b76',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'Assistant', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
