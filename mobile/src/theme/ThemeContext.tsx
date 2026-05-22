import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { getCurrentTokens, TokenSet } from './tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

type Panel = 'buyer' | 'seller';
type ColorMode = 'light' | 'dark';

interface ThemeContextValue {
  currentPanel: Panel;
  colorMode: ColorMode;
  tokens: TokenSet;
  toggleColorMode: () => void;
  setPanel: (panel: Panel) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  initialPanel?: Panel;
}

export function ThemeProvider({
  children,
  initialPanel = 'buyer',
}: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();

  const [currentPanel, setCurrentPanel] = useState<Panel>(initialPanel);
  const [colorMode, setColorMode] = useState<ColorMode>(
    systemColorScheme === 'dark' ? 'dark' : 'light'
  );

  const toggleColorMode = useCallback(() => {
    setColorMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setPanel = useCallback((panel: Panel) => {
    setCurrentPanel(panel);
  }, []);

  const tokens = useMemo(
    () => getCurrentTokens(currentPanel, colorMode),
    [currentPanel, colorMode]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      currentPanel,
      colorMode,
      tokens,
      toggleColorMode,
      setPanel,
    }),
    [currentPanel, colorMode, tokens, toggleColorMode, setPanel]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
