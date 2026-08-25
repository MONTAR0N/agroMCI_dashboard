import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        tierra: {
          DEFAULT: '#22261F',
          50: '#f5f6f4',
          100: '#e8eae5',
          200: '#d1d5cc',
          300: '#adb4a4',
          400: '#858e7a',
          500: '#66705b',
          600: '#4f5847',
          700: '#3e4539',
          800: '#33382f',
          900: '#22261F',
        },
        paja: {
          DEFAULT: '#E8E2D0',
          50: '#faf9f5',
          100: '#f3f1e8',
          200: '#E8E2D0',
          300: '#d5ccb0',
          400: '#c2b48e',
          500: '#b3a175',
          600: '#a68f63',
          700: '#8a7553',
          800: '#716047',
          900: '#5d4f3c',
        },
        verde: {
          DEFAULT: '#37634A',
          50: '#f2f7f4',
          100: '#e0ede4',
          200: '#c2dbcb',
          300: '#96c0a6',
          400: '#66a07c',
          500: '#458460',
          600: '#37634A',
          700: '#2b5640',
          800: '#254536',
          900: '#1f392d',
        },
        trigo: {
          DEFAULT: '#C89A3C',
          50: '#fbf7eb',
          100: '#f5eacc',
          200: '#ecd49a',
          300: '#e1b960',
          400: '#C89A3C',
          500: '#c08a2c',
          600: '#a96c24',
          700: '#8c5120',
          800: '#744220',
          900: '#62371f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
