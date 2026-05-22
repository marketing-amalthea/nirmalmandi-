import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

// Condition grades for inventory items
export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

// Verification tiers
export type VerificationTier = 'verified' | 'premium' | 'basic' | 'unverified';

// Order statuses
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'disputed';

export type BadgeType =
  | { kind: 'grade'; grade: ConditionGrade }
  | { kind: 'verification'; tier: VerificationTier }
  | { kind: 'order'; status: OrderStatus }
  | { kind: 'custom'; label: string; bg: string; text: string }
  | { kind: 'sector'; label: string };

export interface NMBadgeProps {
  badge: BadgeType;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

// ── Color resolution ──────────────────────────────────────────────────────────

function resolveGradeColors(grade: ConditionGrade): { bg: string; text: string; label: string } {
  switch (grade) {
    case 'A': return { bg: '#dcfce7', text: '#15803d', label: 'Grade A' };
    case 'B': return { bg: '#dbeafe', text: '#1d4ed8', label: 'Grade B' };
    case 'C': return { bg: '#fef9c3', text: '#a16207', label: 'Grade C' };
    case 'D': return { bg: '#fee2e2', text: '#b91c1c', label: 'Grade D' };
  }
}

function resolveVerificationColors(tier: VerificationTier): { bg: string; text: string; label: string } {
  switch (tier) {
    case 'premium':  return { bg: '#fef3c7', text: '#92400e', label: 'Premium' };
    case 'verified': return { bg: '#dcfce7', text: '#15803d', label: 'Verified' };
    case 'basic':    return { bg: '#dbeafe', text: '#1d4ed8', label: 'Basic' };
    case 'unverified': return { bg: '#f1f5f9', text: '#64748b', label: 'Unverified' };
  }
}

function resolveOrderColors(status: OrderStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'pending':    return { bg: '#fef9c3', text: '#a16207', label: 'Pending' };
    case 'confirmed':  return { bg: '#dbeafe', text: '#1d4ed8', label: 'Confirmed' };
    case 'processing': return { bg: '#ede9fe', text: '#6d28d9', label: 'Processing' };
    case 'shipped':    return { bg: '#fce7f3', text: '#9d174d', label: 'Shipped' };
    case 'delivered':  return { bg: '#dcfce7', text: '#15803d', label: 'Delivered' };
    case 'cancelled':  return { bg: '#fee2e2', text: '#b91c1c', label: 'Cancelled' };
    case 'disputed':   return { bg: '#ffedd5', text: '#9a3412', label: 'Disputed' };
  }
}

function resolveBadgeContent(badge: BadgeType): { bg: string; text: string; label: string } {
  switch (badge.kind) {
    case 'grade':
      return resolveGradeColors(badge.grade);
    case 'verification':
      return resolveVerificationColors(badge.tier);
    case 'order':
      return resolveOrderColors(badge.status);
    case 'sector':
      return { bg: '#e0f2fe', text: '#0369a1', label: badge.label };
    case 'custom':
      return { bg: badge.bg, text: badge.text, label: badge.label };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NMBadge({ badge, size = 'md', style }: NMBadgeProps) {
  const { tokens } = useTheme();
  const { bg, text, label } = resolveBadgeContent(badge);

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: tokens['btn-radius'],
          paddingHorizontal: isSmall ? 8 : 10,
          paddingVertical: isSmall ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: text,
            fontSize: isSmall ? 11 : 13,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
