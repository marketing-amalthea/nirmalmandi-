import React from 'react';
import {
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CardVariant = 'default' | 'elevated' | 'outlined';

export interface NMCardProps extends ViewProps {
  variant?: CardVariant;
  children: React.ReactNode;
  padding?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NMCard({
  variant = 'default',
  children,
  padding = 16,
  style,
  ...rest
}: NMCardProps) {
  const { tokens, colorMode } = useTheme();

  const backgroundColor = (() => {
    switch (variant) {
      case 'elevated':
        return tokens['surface-elevated'];
      default:
        return tokens.surface;
    }
  })();

  const borderColor = variant === 'outlined' ? tokens.border : 'transparent';
  const borderWidth = variant === 'outlined' ? 1 : 0;

  // Elevation / shadow — only visible in light mode for default/elevated
  const shadowStyle =
    variant !== 'outlined' && colorMode === 'light'
      ? styles.shadow
      : {};

  return (
    <View
      style={[
        styles.base,
        shadowStyle,
        {
          backgroundColor,
          borderColor,
          borderWidth,
          borderRadius: tokens['card-radius'],
          padding,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
