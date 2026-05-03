export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red:         'rgb(var(--brand-primary-rgb) / <alpha-value>)',
          'red-dark':  'rgb(var(--brand-primary-dark-rgb) / <alpha-value>)',
          gold:        'rgb(var(--brand-accent-rgb) / <alpha-value>)',
          'gold-lt':   'rgb(var(--brand-accent-lt-rgb) / <alpha-value>)',
          bg:          'rgb(var(--brand-bg-rgb) / <alpha-value>)',
          surface:     'rgb(var(--brand-surface-rgb) / <alpha-value>)',
          'surface-2': 'rgb(var(--brand-surface-2-rgb) / <alpha-value>)',
          border:      'rgb(var(--brand-border-rgb) / <alpha-value>)',
          muted:       'rgb(var(--brand-muted-rgb) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      keyframes: {
        // translate3d / scale3d → GPU compositor, no layout recalc
        slideUp: {
          '0%':   { opacity: '0', transform: 'translate3d(0, 12px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        slideUpFar: {
          '0%':   { opacity: '0', transform: 'translate3d(0, 26px, 0)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Removed scale(0.4)→1.1 overshoot — start closer, no bounce
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale3d(0.82, 0.82, 1)' },
          '60%':  { opacity: '1' },
          '100%': { opacity: '1', transform: 'scale3d(1, 1, 1)' },
        },
        // Replaced expensive perspective/rotateX with simple translate+scale
        cardReveal: {
          '0%':   { opacity: '0', transform: 'translate3d(0, 22px, 0) scale3d(0.97, 0.97, 1)' },
          '100%': { opacity: '1', transform: 'translate3d(0, 0, 0)  scale3d(1, 1, 1)' },
        },
        shieldGlow: {
          '0%, 100%': { filter: 'invert(1) drop-shadow(0 0 0px rgba(204,34,34,0))' },
          '50%':      { filter: 'invert(1) drop-shadow(0 0 12px rgba(204,34,34,0.5))' },
        },
        shieldGlowGold: {
          '0%, 100%': { filter: 'invert(1) sepia(1) saturate(2) hue-rotate(3deg) brightness(1.1)  drop-shadow(0 0 0px  rgba(201,168,76,0))' },
          '50%':      { filter: 'invert(1) sepia(1) saturate(2) hue-rotate(3deg) brightness(1.22) drop-shadow(0 0 14px rgba(201,168,76,0.6))' },
        },
        shieldGlowWhite: {
          '0%, 100%': { filter: 'invert(1) drop-shadow(0 0 0px  rgba(255,255,255,0))' },
          '50%':      { filter: 'invert(1) drop-shadow(0 0 16px rgba(255,255,255,0.5))' },
        },
        // letterSpacing forces layout recalc every frame — opacity only
        goldShimmer: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.55' },
        },
        redFlash: {
          '0%':   { backgroundColor: 'rgba(204,34,34,0.25)', borderColor: 'rgba(204,34,34,0.7)' },
          '100%': { backgroundColor: 'transparent',          borderColor: 'rgba(44,44,44,1)' },
        },
        goldFlash: {
          '0%':   { backgroundColor: 'rgba(201,168,76,0.2)', borderColor: 'rgba(201,168,76,0.6)' },
          '100%': { backgroundColor: 'transparent',          borderColor: 'rgba(44,44,44,1)' },
        },
        diagonalIn: {
          '0%':   { clipPath: 'polygon(100% 0, 100% 0, 100% 0, 100% 0)' },
          '100%': { clipPath: 'polygon(0 0, 100% 0, 100% 72%, 0 100%)' },
        },
        scanLine: {
          '0%':   { transform: 'translate3d(0, -100%, 0)', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { transform: 'translate3d(0, 400%, 0)',  opacity: '0' },
        },
        numberPop: {
          '0%':   { transform: 'scale3d(1, 1, 1)' },
          '40%':  { transform: 'scale3d(1.14, 1.14, 1)', color: '#CC2222' },
          '100%': { transform: 'scale3d(1, 1, 1)' },
        },
      },
      animation: {
        // cubic-bezier(0.22, 1, 0.36, 1): smooth deceleration, less aggressive than 0.16
        'slide-up':          'slideUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up-d1':       'slideUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) 0.06s both',
        'slide-up-d2':       'slideUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both',
        'slide-up-d3':       'slideUp 0.42s cubic-bezier(0.22, 1, 0.36, 1) 0.18s both',
        'slide-up-far':      'slideUpFar 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in':           'fadeIn 0.3s ease both',
        'scale-in':          'scaleIn 0.45s cubic-bezier(0.34, 1.2, 0.64, 1) both',
        'card-reveal':       'cardReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'shield-glow':       'shieldGlow 3s ease-in-out infinite',
        'shield-glow-gold':  'shieldGlowGold 3s ease-in-out infinite',
        'shield-glow-white': 'shieldGlowWhite 3s ease-in-out infinite',
        'gold-shimmer':      'goldShimmer 2.6s ease-in-out infinite',
        'red-flash':         'redFlash 0.8s ease-out forwards',
        'gold-flash':        'goldFlash 1s ease-out forwards',
        'diagonal-in':       'diagonalIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scan-line':         'scanLine 2s ease-in-out infinite',
        'number-pop':        'numberPop 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
