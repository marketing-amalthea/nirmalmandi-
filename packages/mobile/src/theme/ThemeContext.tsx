/**
 * Theme context — provides dark/light mode to all screens.
 * Persists preference to AsyncStorage.
 * Respects system preference on first launch.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from './tokens';

type Mode = 'light' | 'dark';

interface ThemeContextType {
  mode: Mode;
  colors: typeof Colors.light;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors: Colors.light,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<Mode>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem('nm_theme').then(stored => {
      if (stored === 'dark' || stored === 'light') setMode(stored);
    });
  }, []);

  function toggleTheme() {
    const next: Mode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    AsyncStorage.setItem('nm_theme', next);
  }

  const isDark = mode === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
