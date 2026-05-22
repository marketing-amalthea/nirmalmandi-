import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface NMButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NMButton({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  onPress,
  ...rest
}: NMButtonProps) {
  const { tokens } = useTheme();

  const isDisabled = disabled || loading;

  // Resolve size dimensions — all sizes meet the 44px minimum tap target
  const sizeStyles = {
    sm: { height: 44, paddingHorizontal: 16, fontSize: 14 },
    md: { height: 52, paddingHorizontal: 20, fontSize: 16 },
    lg: { height: 60, paddingHorizontal: 28, fontSize: 18 },
  }[size];

  // Resolve variant colors from tokens
  const variantStyles = (() => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isDisabled
            ? tokens['primary-light']
            : tokens.primary,
          borderColor: 'transparent',
          textColor: '#ffffff',
        };
      case 'secondary':
        return {
          backgroundColor: isDisabled
            ? tokens['primary-pale']
            : tokens['primary-pale'],
          borderColor: 'transparent',
          textColor: isDisabled ? tokens['text-muted'] : tokens['primary-dark'],
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderColor: isDisabled ? tokens['text-muted'] : tokens.primary,
          textColor: isDisabled ? tokens['text-muted'] : tokens.primary,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderColor: 'transparent',
          textColor: isDisabled ? tokens['text-muted'] : tokens.primary,
        };
      case 'danger':
        return {
          backgroundColor: isDisabled ? '#fca5a5' : tokens.danger,
          borderColor: 'transparent',
          textColor: '#ffffff',
        };
    }
  })();

  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      activeOpacity={0.75}
      style={[
        styles.base,
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderRadius: tokens['btn-radius'],
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: isDisabled ? 0.6 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.textColor}
        />
      ) : (
        <View style={styles.inner}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <Text
            style={[
              styles.label,
              {
                fontSize: sizeStyles.fontSize,
                color: variantStyles.textColor,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
