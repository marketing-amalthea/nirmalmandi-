import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NMTopbarProps {
  title: string;
  /** Show a back chevron on the left and call this on press */
  onBack?: () => void;
  /** Slot for icon buttons on the right (e.g. bell, search, menu) */
  rightActions?: React.ReactNode;
  /** Override subtitle under title */
  subtitle?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NMTopbar({
  title,
  onBack,
  rightActions,
  subtitle,
}: NMTopbarProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: tokens.topbar,
          paddingTop: insets.top + 4,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Back button */}
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={[styles.backChevron, { color: tokens['topbar-text'] }]}>
              ‹
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Title block */}
      <View style={styles.center}>
        <Text
          style={[styles.title, { color: tokens['topbar-text'] }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, { color: tokens['topbar-text'] + 'cc' }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right actions */}
      <View style={styles.right}>{rightActions ?? null}</View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
    marginTop: -4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
});
