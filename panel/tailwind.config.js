/** @type {import('tailwindcss').Config} */
// Les couleurs pointent vers des variables CSS (canaux RGB) définies dans
// index.css → permet un thème clair/sombre ET la conservation des utilitaires
// d'opacité Tailwind (bg-surface/40, text-accent/30, …).
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: withAlpha('--c-bg'),
        surface: withAlpha('--c-surface'),
        'surface-2': withAlpha('--c-surface-2'),
        border: withAlpha('--c-border'),
        ink: withAlpha('--c-ink'),
        muted: withAlpha('--c-muted'),
        accent: withAlpha('--c-accent'),
        'accent-2': withAlpha('--c-accent-2'),
        success: withAlpha('--c-success'),
        danger: withAlpha('--c-danger'),
        warning: withAlpha('--c-warning'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(245,52,42,0.55)',
        card: '0 8px 30px -12px rgba(0,0,0,0.45)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #ff4d2e 0%, #d90f18 100%)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.18s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
