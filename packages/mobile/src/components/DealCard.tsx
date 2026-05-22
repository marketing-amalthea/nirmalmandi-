/**
 * Deal card component — shown in the buyer home feed.
 * Shows urgency badge, discount %, condition grade, price type indicator.
 * Dark/light mode aware.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme/tokens';

interface Listing {
  id: string;
  title: string;
  asking_price: number;
  mrp: number;
  urgency_score: number;
  is_urgent_badge: boolean;
  condition_grade: string;
  dead_stock_type: string;
  sector_slug: string;
  seller_name: string;
  city: string;
  state: string;
  image_url?: string;
  price_type: string;
  flash_sale_ends_at?: string;
  auction_ends_at?: string;
}

interface Props {
  listing: Listing;
  onPress: () => void;
}

const GRADE_COLOR: Record<string, string> = {
  A: '#2e7d32', B: '#1565c0', C: '#e65100', D: '#c62828',
};

export function DealCard({ listing, onPress }: Props) {
  const { colors, isDark } = useTheme();
  const discount = listing.mrp > 0
    ? Math.round((1 - listing.asking_price / listing.mrp) * 100)
    : 0;

  const isFlash = listing.price_type === 'flash';
  const isAuction = listing.price_type === 'auction';

  const s = makeStyles(colors, isDark);

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.9}>
      {/* Image area */}
      <View style={s.imageContainer}>
        {listing.image_url ? (
          <Image source={{ uri: listing.image_url }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={s.imagePlaceholder}>
            <Text style={s.placeholderText}>{listing.sector_slug.toUpperCase()}</Text>
          </View>
        )}

        {/* Badges */}
        <View style={s.badges}>
          {listing.is_urgent_badge && (
            <View style={s.urgentBadge}><Text style={s.urgentText}>🔥 URGENT</Text></View>
          )}
          {isFlash && (
            <View style={[s.urgentBadge, { backgroundColor: Colors.accent }]}>
              <Text style={s.urgentText}>⚡ FLASH</Text>
            </View>
          )}
          {isAuction && (
            <View style={[s.urgentBadge, { backgroundColor: Colors.info }]}>
              <Text style={s.urgentText}>🔨 AUCTION</Text>
            </View>
          )}
        </View>

        {/* Discount chip */}
        {discount >= 10 && (
          <View style={s.discountChip}>
            <Text style={s.discountText}>{discount}% OFF</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={s.content}>
        <Text style={s.title} numberOfLines={2}>{listing.title}</Text>

        <View style={s.metaRow}>
          <Text style={s.seller}>{listing.seller_name}</Text>
          <View style={[s.grade, { backgroundColor: GRADE_COLOR[listing.condition_grade] + '20' }]}>
            <Text style={[s.gradeText, { color: GRADE_COLOR[listing.condition_grade] }]}>
              Grade {listing.condition_grade}
            </Text>
          </View>
        </View>

        <Text style={s.location}>📍 {listing.city}, {listing.state}</Text>

        <View style={s.priceRow}>
          <View>
            <Text style={s.price}>₹{listing.asking_price.toLocaleString('en-IN')}</Text>
            {listing.mrp > listing.asking_price && (
              <Text style={s.mrp}>MRP ₹{listing.mrp.toLocaleString('en-IN')}</Text>
            )}
          </View>
          <Text style={s.sector}>{listing.sector_slug}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(colors: typeof Colors.light, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      marginBottom: Spacing[4],
      overflow: 'hidden',
      ...Shadow.md,
    },
    imageContainer: {
      height: 180,
      position: 'relative',
    },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: {
      flex: 1,
      backgroundColor: Colors.primaryPale,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: Colors.primary,
      fontSize: Typography.sm,
      fontWeight: Typography.bold,
      letterSpacing: 2,
    },
    badges: {
      position: 'absolute',
      top: Spacing[2],
      left: Spacing[2],
      flexDirection: 'row',
      gap: Spacing[1],
    },
    urgentBadge: {
      backgroundColor: Colors.error,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing[2],
      paddingVertical: 3,
    },
    urgentText: { color: '#fff', fontSize: 10, fontWeight: Typography.bold },
    discountChip: {
      position: 'absolute',
      top: Spacing[2],
      right: Spacing[2],
      backgroundColor: Colors.accent,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing[2],
      paddingVertical: 3,
    },
    discountText: { color: '#fff', fontSize: 11, fontWeight: Typography.bold },
    content: { padding: Spacing[4] },
    title: {
      fontSize: Typography.base,
      fontWeight: Typography.semibold,
      color: colors.text,
      marginBottom: Spacing[2],
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing[1],
    },
    seller: { color: colors.textSecondary, fontSize: Typography.sm },
    grade: {
      borderRadius: Radius.full,
      paddingHorizontal: Spacing[2],
      paddingVertical: 2,
    },
    gradeText: { fontSize: 11, fontWeight: Typography.semibold },
    location: { color: colors.muted, fontSize: Typography.xs, marginBottom: Spacing[3] },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    price: {
      fontSize: Typography.xl,
      fontWeight: Typography.bold,
      color: Colors.primary,
    },
    mrp: {
      fontSize: Typography.xs,
      color: colors.muted,
      textDecorationLine: 'line-through',
    },
    sector: {
      fontSize: Typography.xs,
      color: colors.muted,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: Spacing[2],
      paddingVertical: 3,
      borderRadius: Radius.sm,
      textTransform: 'capitalize',
    },
  });
}
