/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          faint: 'rgba(59, 130, 246, 0.15)',
          glow: 'rgba(59, 130, 246, 0.3)',
        },
        background: {
          base:     'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          surface:  'var(--bg-surface)',
          hover:    'var(--bg-hover)',
          active:   'var(--bg-active)',
          tertiary: 'var(--bg-surface)',
          secondary:'var(--bg-elevated)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle:  'var(--border-subtle)',
          default: 'var(--border-default)',
          strong:  'var(--border-strong)',
          muted:   'var(--border-muted)',
          focus:   'rgba(59, 130, 246, 0.5)',
          input:   'var(--border-default)',
          ring:    'rgba(59, 130, 246, 0.3)',
        },
        text: {
          DEFAULT:   'var(--text-primary)',
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          muted:     'var(--text-muted)',
        },
        // shadcn/ui compatible token aliases
        card: {
          DEFAULT: 'var(--bg-elevated)',
          foreground: 'var(--text-primary)',
        },
        foreground: 'var(--text-primary)',
        muted: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-tertiary)',
        },
        accent: {
          DEFAULT: 'var(--bg-hover)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: '#F87171',
          foreground: '#FFFFFF',
        },
        input: 'var(--bg-surface)',
        ring: '#3B82F6',
        success: {
          DEFAULT: '#34D399',
          faint: 'rgba(52, 211, 153, 0.15)',
        },
        warning: {
          DEFAULT: '#FBBF24',
          faint: 'rgba(251, 191, 36, 0.15)',
        },
        danger: {
          DEFAULT: '#F87171',
          hover: '#EF4444',
          faint: 'rgba(248, 113, 113, 0.15)',
        },
        info: {
          DEFAULT: '#60A5FA',
          faint: 'rgba(96, 165, 250, 0.15)',
        },
      },
      boxShadow: {
        'soft':       '0 4px 12px rgba(0, 0, 0, 0.15)',
        'medium':     '0 8px 24px rgba(0, 0, 0, 0.2)',
        'glow':       '0 0 24px rgba(59, 130, 246, 0.15)',
        'glow-lg':    '0 0 48px rgba(59, 130, 246, 0.1)',
        'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
        'xs':         '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      spacing: {
        '18': '4.5rem',
        '19': '4.75rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'shake-once': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        'flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'shake-once': 'shake-once 0.5s ease-in-out',
        'flow': 'flow 3s ease infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
