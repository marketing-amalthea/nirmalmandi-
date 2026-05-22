/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'nm-primary': '#2563eb',
        'nm-primary-dark': '#1d4ed8',
        'nm-primary-light': '#3b82f6',
        'nm-accent': '#16a34a',
        'nm-accent-dark': '#15803d',
        'nm-accent-light': '#22c55e',
        'nm-warning': '#d97706',
        'nm-warning-dark': '#b45309',
        'nm-warning-light': '#f59e0b',
        'nm-danger': '#dc2626',
        'nm-danger-dark': '#b91c1c',
        'nm-danger-light': '#ef4444',
        'nm-surface': {
          DEFAULT: '#ffffff',
          dark: '#1e2130',
        },
        'nm-bg': {
          DEFAULT: '#f8fafc',
          dark: '#0f1117',
        },
        'nm-border': {
          DEFAULT: '#e2e8f0',
          dark: '#2d3148',
        },
        'nm-text': {
          DEFAULT: '#0f172a',
          muted: '#64748b',
          dark: '#e2e8f0',
          'dark-muted': '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'nm-card': '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'nm-card-dark': '0 1px 3px 0 rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
