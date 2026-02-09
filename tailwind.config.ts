/** @type {import('tailwindcss').Config} */
export default {
  content: ['./ui/**/*.{tsx,ts}', './shared/ui/**/*.{tsx,ts}', './extension/dist/ui/*.js'],
  theme: {
    extend: {
      /* ---------------------------------------------------------------
         COLORS — aligned with contentScript/tokens.css semantic palette
         --------------------------------------------------------------- */
      colors: {
        /* Brand */
        'lock-blue': '#2563eb',
        'lock-purple': '#7c3aed',

        /* Semantic surfaces */
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f9fafb',
          muted: '#f3f4f6',
        },

        /* Semantic text */
        'text-primary': '#111827',
        'text-strong': '#1f2937',
        'text-body': '#374151',
        'text-secondary': '#6b7280',
        'text-muted': '#9ca3af',

        /* Accent / Indigo */
        accent: {
          DEFAULT: '#6366f1',
          soft: '#667eea',
          strong: '#4f46e5',
          stronger: '#4338ca',
          border: '#c7d2fe',
          surface: '#eef2ff',
        },

        /* Borders */
        line: {
          DEFAULT: '#e5e7eb',
          strong: '#d1d5db',
        },

        /* Success */
        success: {
          DEFAULT: '#16a34a',
          surface: '#f0fdf4',
          text: '#065f46',
          border: '#86efac',
        },

        /* Warning */
        warning: {
          DEFAULT: '#eab308',
          surface: '#fffbeb',
          text: '#92400e',
          border: '#fbbf24',
        },

        /* Danger */
        danger: {
          DEFAULT: '#ef4444',
          strong: '#dc2626',
          surface: '#fef2f2',
          text: '#991b1b',
          border: '#fecaca',
        },
      },

      /* ---------------------------------------------------------------
         SPACING — mirrors --lockin-space-* scale
         --------------------------------------------------------------- */
      spacing: {
        'lockin-safe': '16px',
        'lockin-0-5': '2px',
        'lockin-1': '4px',
        'lockin-1-5': '6px',
        'lockin-2': '8px',
        'lockin-2-5': '10px',
        'lockin-3': '12px',
        'lockin-4': '16px',
        'lockin-5': '20px',
        'lockin-6': '24px',
        'lockin-8': '32px',
        'lockin-10': '40px',
        'lockin-12': '48px',
      },

      /* ---------------------------------------------------------------
         FONT SIZE — mirrors --lockin-text-* scale
         --------------------------------------------------------------- */
      fontSize: {
        'lockin-xs': ['11px', { lineHeight: '1.25' }],
        'lockin-sm': ['12px', { lineHeight: '1.4' }],
        'lockin-base': ['13px', { lineHeight: '1.5' }],
        'lockin-md': ['14px', { lineHeight: '1.5' }],
        'lockin-lg': ['16px', { lineHeight: '1.5' }],
        'lockin-xl': ['18px', { lineHeight: '1.4' }],
        'lockin-2xl': ['20px', { lineHeight: '1.3' }],
        'lockin-3xl': ['24px', { lineHeight: '1.25' }],
      },

      /* ---------------------------------------------------------------
         BORDER RADIUS — mirrors --lockin-radius-* scale
         --------------------------------------------------------------- */
      borderRadius: {
        'lockin-sm': '4px',
        'lockin-md': '6px',
        'lockin-lg': '8px',
        'lockin-xl': '10px',
        'lockin-2xl': '12px',
      },

      /* ---------------------------------------------------------------
         BOX SHADOW — semantic shadow tokens
         --------------------------------------------------------------- */
      boxShadow: {
        'lockin-xs': '0 1px 2px rgba(0,0,0,0.05)',
        'lockin-sm': '0 1px 3px rgba(0,0,0,0.08)',
        'lockin-md': '0 4px 12px rgba(0,0,0,0.1)',
        'lockin-focus': '0 0 0 2px rgba(102,126,234,0.1)',
        'lockin-focus-accent': '0 0 0 2px rgba(102,126,234,0.2)',
      },

      /* ---------------------------------------------------------------
         TRANSITION — timing presets
         --------------------------------------------------------------- */
      transitionDuration: {
        'lockin-fast': '120ms',
        'lockin-base': '150ms',
        'lockin-smooth': '200ms',
        'lockin-slow': '300ms',
      },
    },
  },
  plugins: [],
};
