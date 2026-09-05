/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    {
      pattern: /(bg|text|border)-(cyan|green|purple|blue|orange|red|amber|yellow|slate)-(300|400|500|600|700|800|900|950)(\/([0-9]{1,2}))?/,
    },
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f6f8f7', 100: '#e8eeec', 200: '#cbd5d2', 300: '#aab9b5',
          400: '#84958f', 500: '#64736f', 600: '#4b5956', 700: '#34413f',
          800: '#202b2e', 850: '#182124', 900: '#111719', 950: '#090b0c',
        },
        cyan: {
          50: '#effdf9', 100: '#d7f9ef', 200: '#aff2df', 300: '#86e9ce',
          400: '#70e1c1', 450: '#55d6b2', 500: '#38c8a1', 600: '#259d7f',
          700: '#207c67', 800: '#1d6353', 900: '#194f44', 950: '#0b2d27',
        },
        blue: {
          300: '#a8d4ff', 400: '#6eb8ff', 500: '#3f9cf4', 600: '#287bd0',
          700: '#2462a6', 800: '#224f82', 900: '#203f67', 950: '#132741',
        },
        purple: {
          300: '#c9bdc8', 400: '#aa9aaa', 500: '#897789', 600: '#6c5b6d',
          700: '#514451', 800: '#372f38', 900: '#261f27', 950: '#171318',
        },
        emerald: {
          300: '#91e7bf', 400: '#65d59f', 500: '#3fbe82', 600: '#2b9767',
          700: '#287754', 800: '#245f47', 900: '#204e3c', 950: '#0e2c23',
        },
        brand: { DEFAULT: '#70e1c1', soft: '#9debd5', deep: '#239b7d' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Segoe UI"', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        elev: '0 24px 60px -28px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
};
