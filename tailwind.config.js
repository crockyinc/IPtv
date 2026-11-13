/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        yt: {
          bg: '#0f0f0f',
          surface: '#181818',
          raised: '#212121',
          chip: '#272727',
          chipHover: '#3f3f3f',
          border: '#303030',
          text: '#f1f1f1',
          muted: '#aaaaaa',
          dim: '#717171',
          live: '#ff0000',
          liveDim: '#cc0000',
        },
      },
      fontFamily: {
        sans: [
          '"Roboto"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      height: {
        navbar: '56px',
      },
      width: {
        sidebar: '240px',
        rail: '72px',
      },
      spacing: {
        navbar: '56px',
        sidebar: '240px',
        rail: '72px',
      },
      zIndex: {
        navbar: '60',
        sidebar: '70',
        modal: '90',
        toast: '100',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-live': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'modal-in': 'modal-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-live': 'pulse-live 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'slide-in-left': 'slide-in-left 200ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      boxShadow: {
        nav: '0 1px 0 0 rgba(255,255,255,0.06)',
        card: '0 8px 24px -12px rgba(0,0,0,0.9)',
        pop: '0 16px 48px -12px rgba(0,0,0,0.85)',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
