/**
 * Seller Dashboard Screen.
 * Overview: active listings, pending orders, escrow balance, quick actions.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme/tokens';
import { api } from '../services/api';
import { useAppStore } from '../store';

interface SellerStats {
  active_listings: number;
  pending_orders: number;
  escrow_balance: number;
  total_earned: number;
  views_this_week: number;
  pending_kyc_step: string | null;
  verification_tier: number;
}

interface Props {
  navigation: any;
}

export function SellerDashboardScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const user = useAppStore(s => s.user);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get('/seller/dashboard/stats'),
        api.get('/orders/my?role=seller&limit=5'),
      ]);
      setStats(statsRes.data.data);
      setRecentOrders(ordersRes.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  const s = makeStyles(colors, isDark);

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const tierColors = ['#888', '#2e7d32', '#1565c0', '#7b1fa2'];
  const tierLabels = ['Unverified', 'Basic', 'Verified', 'Platinum'];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} />}
    >
      {/* Greeting */}
      <View style={s.greeting}>
        <Text style={s.greetingText}>नमस्ते, {user?.fullName?.split(' ')[0] || 'Seller'} 👋</Text>
        {stats && (
          <View style={[s.tierBadge, { backgroundColor: tierColors[stats.verification_tier] + '20' }]}>
            <Text style={[s.tierText, { color: tierColors[stats.verification_tier] }]}>
              ★ {tierLabels[stats.verification_tier]}
            </Text>
          </View>
        )}
      </View>

      {/* KYC Alert */}
      {stats?.pending_kyc_step && (
        <TouchableOpacity style={s.kycAlert} onPress={() => navigation.navigate('KYC')}>
          <Text style={s.kycAlertText}>
            ⚠️ Complete KYC: {stats.pending_kyc_step} →
          </Text>
        </TouchableOpacity>
      )}

      {/* Stats Grid */}
      {stats && (
        <View style={s.statsGrid}>
          <StatBox label="Active Listings" value={stats.active_listings} colors={colors} onPress={() => navigation.navigate('MyListings')} />
          <StatBox label="Pending Orders" value={stats.pending_orders} colors={colors} onPress={() => navigation.navigate('SellerOrders')} highlight={stats.pending_orders > 0} />
          <StatBox label="Escrow Balance" value={`₹${(stats.escrow_balance / 1000).toFixed(1)}K`} colors={colors} />
          <StatBox label="Total Earned" value={`₹${(stats.total_earned / 1000).toFixed(1)}K`} colors={colors} />
        </View>
      )}

      {/* Quick Actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actions}>
          <ActionBtn icon="📦" label="New Listing" onPress={() => navigation.navigate('CreateListing')} colors={colors} />
          <ActionBtn icon="🤖" label="AI Caption" onPress={() => navigation.navigate('AiMarketing')} colors={colors} />
          <ActionBtn icon="📊" label="My Orders" onPress={() => navigation.navigate('SellerOrders')} colors={colors} />
          <ActionBtn icon="💰" label="Payouts" onPress={() => navigation.navigate('Payouts')} colors={colors} />
        </View>
      </View>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SellerOrders')}>
              <Text style={s.viewAll}>View all →</Text>
            </TouchableOpacity>
          </View>
          {recentOrders.map((order: any) => (
            <TouchableOpacity
              key={order.id}
              style={s.orderRow}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.orderNum} numberOfLines={1}>{order.order_number}</Text>
                <Text style={s.orderMeta}>{order.buyer_name} · {order.quantity} units</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.orderAmount}>₹{order.total_amount?.toLocaleString('en-IN')}</Text>
                <View style={[s.statusDot, { backgroundColor: statusColor(order.status) }]}>
                  <Text style={s.statusText}>{order.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatBox({ label, value, colors, onPress, highlight }: any) {
  return (
    <TouchableOpacity
      style={[{
        flex: 1,
        minWidth: '45%',
        backgroundColor: highlight ? Colors.primary + '15' : colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing[4],
        margin: Spacing[1],
        ...Shadow.sm,
        borderWidth: highlight ? 1 : 0,
        borderColor: Colors.primary + '40',
      }]}
      onPress={onPress}
    >
      <Text style={{ fontSize: Typography['2xl'], fontWeight: Typography.bold, color: highlight ? Colors.primary : colors.text }}>
        {value}
      </Text>
      <Text style={{ fontSize: Typography.xs, color: colors.muted, marginTop: Spacing[1] }}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActionBtn({ icon, label, onPress, colors }: any) {
  return (
    <TouchableOpacity
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing[4],
        margin: Spacing[1],
        ...Shadow.sm,
      }}
      onPress={onPress}
    >
      <Text style={{ fontSize: 28, marginBottom: Spacing[2] }}>{icon}</Text>
      <Text style={{ fontSize: Typography.xs, color: colors.textSecondary, textAlign: 'center', fontWeight: Typography.medium }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return '#2e7d32';
    case 'shipped': return '#1565c0';
    case 'paid': return '#e65100';
    case 'disputed': return '#c62828';
    default: return '#888';
  }
}

function makeStyles(colors: typeof Colors.light, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: Spacing[4], paddingBottom: Spacing[12] },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    greeting: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing[4],
    },
    greetingText: {
      fontSize: Typography.xl,
      fontWeight: Typography.bold,
      color: colors.text,
    },
    tierBadge: {
      borderRadius: Radius.full,
      paddingHorizontal: Spacing[3],
      paddingVertical: Spacing[1],
    },
    tierText: { fontSize: Typography.xs, fontWeight: Typography.semibold },
    kycAlert: {
      backgroundColor: Colors.accent + '20',
      borderRadius: Radius.md,
      padding: Spacing[3],
      marginBottom: Spacing[4],
      borderWidth: 1,
      borderColor: Colors.accent,
    },
    kycAlertText: { color: Colors.warning, fontWeight: Typography.medium, fontSize: Typography.sm },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -Spacing[1],
      marginBottom: Spacing[6],
    },
    section: { marginBottom: Spacing[6] },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
    sectionTitle: {
      fontSize: Typography.md,
      fontWeight: Typography.bold,
      color: colors.text,
      marginBottom: Spacing[3],
    },
    viewAll: { color: Colors.primary, fontSize: Typography.sm },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -Spacing[1],
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      padding: Spacing[4],
      marginBottom: Spacing[2],
      ...Shadow.sm,
    },
    orderNum: { fontWeight: Typography.semibold, color: colors.text, fontSize: Typography.sm },
    orderMeta: { color: colors.muted, fontSize: Typography.xs, marginTop: 2 },
    orderAmount: { fontWeight: Typography.bold, color: Colors.primary, fontSize: Typography.base },
    statusDot: { borderRadius: Radius.sm, paddingHorizontal: Spacing[2], paddingVertical: 2, marginTop: 3 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: Typography.medium },
  });
}
