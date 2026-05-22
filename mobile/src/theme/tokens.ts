// NirmalMandi CSS Token System
// NEVER hardcode a color. Always use this token system.
// Supports: buyer panel (blue) | seller panel (green), light/dark mode

export interface TokenSet {
  // Brand / Primary
  primary: string;
  'primary-mid': string;
  'primary-light': string;
  'primary-pale': string;
  'primary-dark': string;

  // Surfaces
  surface: string;
  'surface-elevated': string;

  // Borders
  border: string;

  // Text
  'text-primary': string;
  'text-secondary': string;
  'text-muted': string;

  // Topbar
  topbar: string;
  'topbar-text': string;

  // Semantic
  success: string;
  warning: string;
  danger: string;

  // Shape
  'card-radius': number;
  'btn-radius': number;
}

// ── Buyer tokens ──────────────────────────────────────────────────────────────

const buyerLight: TokenSet = {
  primary: '#2563eb',
  'primary-mid': '#3b82f6',
  'primary-light': '#93c5fd',
  'primary-pale': '#dbeafe',
  'primary-dark': '#1d4ed8',

  surface: '#ffffff',
  'surface-elevated': '#f8fafc',

  border: '#e2e8f0',

  'text-primary': '#0f172a',
  'text-secondary': '#475569',
  'text-muted': '#94a3b8',

  topbar: '#2563eb',
  'topbar-text': '#ffffff',

  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',

  'card-radius': 12,
  'btn-radius': 8,
};

const buyerDark: TokenSet = {
  primary: '#3b82f6',
  'primary-mid': '#60a5fa',
  'primary-light': '#1d4ed8',
  'primary-pale': '#1e3a5f',
  'primary-dark': '#93c5fd',

  surface: '#0f172a',
  'surface-elevated': '#1e293b',

  border: '#334155',

  'text-primary': '#f1f5f9',
  'text-secondary': '#94a3b8',
  'text-muted': '#64748b',

  topbar: '#1e293b',
  'topbar-text': '#f1f5f9',

  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',

  'card-radius': 12,
  'btn-radius': 8,
};

// ── Seller tokens ─────────────────────────────────────────────────────────────

const sellerLight: TokenSet = {
  primary: '#16a34a',
  'primary-mid': '#22c55e',
  'primary-light': '#86efac',
  'primary-pale': '#dcfce7',
  'primary-dark': '#15803d',

  surface: '#ffffff',
  'surface-elevated': '#f8fafc',

  border: '#e2e8f0',

  'text-primary': '#0f172a',
  'text-secondary': '#475569',
  'text-muted': '#94a3b8',

  topbar: '#16a34a',
  'topbar-text': '#ffffff',

  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',

  'card-radius': 12,
  'btn-radius': 8,
};

const sellerDark: TokenSet = {
  primary: '#22c55e',
  'primary-mid': '#4ade80',
  'primary-light': '#15803d',
  'primary-pale': '#14532d',
  'primary-dark': '#86efac',

  surface: '#0f172a',
  'surface-elevated': '#1e293b',

  border: '#334155',

  'text-primary': '#f1f5f9',
  'text-secondary': '#94a3b8',
  'text-muted': '#64748b',

  topbar: '#1e293b',
  'topbar-text': '#f1f5f9',

  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',

  'card-radius': 12,
  'btn-radius': 8,
};

// ── Resolver ──────────────────────────────────────────────────────────────────

const tokenMap: Record<string, Record<string, TokenSet>> = {
  buyer: {
    light: buyerLight,
    dark: buyerDark,
  },
  seller: {
    light: sellerLight,
    dark: sellerDark,
  },
};

export function getCurrentTokens(
  panel: 'buyer' | 'seller',
  mode: 'light' | 'dark'
): TokenSet {
  return tokenMap[panel][mode];
}
