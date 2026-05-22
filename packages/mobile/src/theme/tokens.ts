/**
 * NirmalMandi Design Token System.
 * CSS custom properties → React Native StyleSheet values.
 * NEVER hardcode colors — always reference tokens.
 * Dark mode supported on every screen.
 */

export const Colors = {
  // Brand
  primary: '#1a472a',       // Forest green
  primaryLight: '#2d6a4f',
  primaryPale: '#e8f5e9',
  accent: '#f9a825',        // Golden yellow — urgency, highlights
  accentLight: '#fff8e1',

  // Semantic
  success: '#2e7d32',
  warning: '#e65100',
  error: '#c62828',
  info: '#1565c0',

  // Light mode
  light: {
    background: '#f5f5f0',
    surface: '#ffffff',
    surfaceAlt: '#fafaf7',
    text: '#1a1a1a',
    textSecondary: '#555555',
    muted: '#888888',
    border: '#e0e0e0',
    divider: '#f0f0f0',
  },

  // Dark mode
  dark: {
    background: '#0f1a12',
    surface: '#1a2b1e',
    surfaceAlt: '#243329',
    text: '#e8f5e9',
    textSecondary: '#a5c8ae',
    muted: '#6b8f72',
    border: '#2d4a33',
    divider: '#1e3524',
  },
} as const;

export const Typography = {
  // Font families
  sans: 'System',       // Platform system font
  mono: 'Courier New',

  // Sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,

  // Weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const Spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16,
  5: 20, 6: 24, 8: 32, 10: 40, 12: 48,
} as const;

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
} as const;

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
