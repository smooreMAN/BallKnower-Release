/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      colors: {
        bk: {
          black: '#0A0A0A',
          white: '#F5F0E8',
          gold: '#F5A623',
          'gold-dark': '#C47D0E',
          blue: '#1B4FD8',
          'blue-light': '#3B6EF8',
          red: '#E53E3E',
          green: '#38A169',
          gray: '#2A2A2A',
          'gray-light': '#3D3D3D',
          'gray-muted': '#888888',
        },
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'timer-drain': 'timer-drain linear forwards',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(245, 166, 35, 0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.8)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'timer-drain': {
          from: { width: '100%' },
          to: { width: '0%' },
        },
      },
    },
  },
  plugins: [],
};
