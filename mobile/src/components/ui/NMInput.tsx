import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NMInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const NMInput = forwardRef<TextInput, NMInputProps>(function NMInput(
  {
    label,
    placeholder,
    error,
    helperText,
    secureTextEntry = false,
    leftIcon,
    rightIcon,
    disabled = false,
    ...rest
  },
  ref
) {
  const { tokens, colorMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const hasError = !!error;

  const borderColor = (() => {
    if (hasError) return tokens.danger;
    if (isFocused) return tokens.primary;
    return tokens.border;
  })();

  const backgroundColor = disabled
    ? colorMode === 'dark'
      ? '#1e293b'
      : '#f1f5f9'
    : tokens.surface;

  return (
    <View style={styles.wrapper}>
      {/* Label */}
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: hasError ? tokens.danger : tokens['text-secondary'],
            },
          ]}
        >
          {label}
        </Text>
      )}

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor,
            borderColor,
            borderRadius: tokens['btn-radius'],
            borderWidth: isFocused || hasError ? 2 : 1,
            minHeight: 44,
          },
        ]}
      >
        {/* Left icon */}
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        {/* Text input */}
        <TextInput
          ref={ref}
          placeholder={placeholder}
          placeholderTextColor={tokens['text-muted']}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          editable={!disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            {
              color: tokens['text-primary'],
              flex: 1,
            },
          ]}
          accessibilityLabel={label ?? placeholder}
          accessibilityState={{ disabled }}
          {...rest}
        />

        {/* Secure toggle icon */}
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecureVisible((v) => !v)}
            style={styles.iconRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isSecureVisible ? 'Hide password' : 'Show password'}
          >
            <Text style={{ color: tokens['text-muted'], fontSize: 13 }}>
              {isSecureVisible ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Right icon (only if not secure field) */}
        {rightIcon && !secureTextEntry && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>

      {/* Error / helper text */}
      {(error || helperText) && (
        <Text
          style={[
            styles.subText,
            {
              color: hasError ? tokens.danger : tokens['text-muted'],
            },
          ]}
        >
          {error ?? helperText}
        </Text>
      )}
    </View>
  );
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  iconLeft: {
    paddingLeft: 12,
  },
  iconRight: {
    paddingRight: 12,
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
  },
});
