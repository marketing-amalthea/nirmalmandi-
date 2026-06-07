import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../../src/theme/ThemeContext';
import { useAuthStore } from '../../src/store/authStore';
import { NMTopbar } from '../../src/components/ui/NMTopbar';

const SELLER_GREEN = '#16a34a';
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const PERIODS = ['7d', '14d', '30d', '60d'];

interface KpiData {
  revenue: number; orders: number; avg_order_value: number; active_listings: number;
}
interface FunnelData { views: number; watchlists: number; orders: number; }
interface TopListing { id: string; title: string; views: number; orders: number; revenue: number; conversion_pct: number; }

function fmt(v: number) {
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K';
  return '₹' + v.toLocaleString('en-IN');
}

export default function SellerAnalytics() {
  const { tokens } = useTheme();
  const { accessToken } = useAuthStore();
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpis, setKpis] = useState<KpiData>({ revenue: 0, orders: 0, avg_order_value: 0, active_listings: 0 });
  const [funnel, setFunnel] = useState<FunnelData>({ views: 0, watchlists: 0, orders: 0 });
  const [topListings, setTopListings] = useState<TopListing[]>([]);
  const s = makeStyles(tokens);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/seller/analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      const d = json?.data;
      if (d) {
        setKpis(d.kpis ?? {});
        setFunnel(d.funnel ?? {});
        setTopListings(d.top_listings ?? []);
      }
    } catch { /* demo data stays */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [period, accessToken]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const convRate = funnel.views > 0 ? ((funnel.orders / funnel.views) * 100).toFixed(1) : '0';

  return (
    <View style={s.root}>
      <NMTopbar title="Analytics" subtitle={`${period} performance`} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SELLER_GREEN} />}
      >
        {/* Period selector */}
        <View style={s.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[s.periodBtn, period === p && s.periodActive]}
            >
              <Text style={[s.periodLabel, period === p && s.periodLabelActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={SELLER_GREEN} />
            <Text style={s.loaderText}>Loading analytics…</Text>
          </View>
        ) : (
          <>
            {/* KPI Grid */}
            <View style={s.kpiGrid}>
              {[
                { label: 'Revenue', value: fmt(kpis.revenue), icon: '💰' },
                { label: 'Orders', value: kpis.orders.toString(), icon: '📦' },
                { label: 'Avg Order', value: fmt(kpis.avg_order_value), icon: '📊' },
                { label: 'Listings', value: kpis.active_listings.toString(), icon: '🏷️' },
              ].map((k) => (
                <View key={k.label} style={s.kpiCard}>
                  <Text style={s.kpiIcon}>{k.icon}</Text>
                  <Text style={s.kpiValue}>{k.value}</Text>
                  <Text style={s.kpiLabel}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Conversion Funnel */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Conversion Funnel</Text>
              <View style={s.funnelRow}>
                <View style={s.funnelStep}>
                  <Text style={s.funnelNum}>{funnel.views.toLocaleString('en-IN')}</Text>
                  <Text style={s.funnelLabel}>Views</Text>
                </View>
                <Text style={s.funnelArrow}>→</Text>
                <View style={s.funnelStep}>
                  <Text style={s.funnelNum}>{funnel.watchlists.toLocaleString('en-IN')}</Text>
                  <Text style={s.funnelLabel}>Saves</Text>
                </View>
                <Text style={s.funnelArrow}>→</Text>
                <View style={s.funnelStep}>
                  <Text style={s.funnelNum}>{funnel.orders.toLocaleString('en-IN')}</Text>
                  <Text style={s.funnelLabel}>Orders</Text>
                </View>
                <View style={s.funnelCvr}>
                  <Text style={s.funnelCvrNum}>{convRate}%</Text>
                  <Text style={s.funnelLabel}>CVR</Text>
                </View>
              </View>
            </View>

            {/* Top Listings */}
            {topListings.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Top Listings</Text>
                {topListings.slice(0, 5).map((l, i) => (
                  <View key={l.id} style={s.listingRow}>
                    <View style={s.listingRank}>
                      <Text style={s.rankNum}>#{i + 1}</Text>
                    </View>
                    <View style={s.listingInfo}>
                      <Text style={s.listingTitle} numberOfLines={1}>{l.title}</Text>
                      <Text style={s.listingMeta}>
                        {l.views.toLocaleString('en-IN')} views · {l.orders} orders
                      </Text>
                    </View>
                    <View style={s.listingRight}>
                      <Text style={s.listingRevenue}>{fmt(l.revenue)}</Text>
                      <Text style={[s.listingConv, { color: l.conversion_pct >= 5 ? SELLER_GREEN : l.conversion_pct >= 2 ? '#d97706' : '#9ca3af' }]}>
                        {l.conversion_pct.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* AI Insight teaser */}
            <View style={s.aiCard}>
              <Text style={s.aiTitle}>🤖 AI Insight</Text>
              <Text style={s.aiBody}>
                {parseFloat(convRate) < 2 && funnel.views > 20
                  ? `CVR is ${convRate}% — try a price drop or Best Offer to convert your ${funnel.views.toLocaleString()} views into orders.`
                  : kpis.active_listings > 5 && parseFloat(convRate) < 1
                  ? `${kpis.active_listings} listings with near-zero sell-through. A flash sale this week can clear stuck stock.`
                  : `Good performance this ${period}. Add more inventory to capitalise on buyer demand.`}
              </Text>
              <Text style={s.aiCta}>Open web panel for full Claude analysis →</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(tokens: Record<string, string>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: tokens.background },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 32 },
    loader: { alignItems: 'center', paddingTop: 60, gap: 12 },
    loaderText: { color: tokens['text-muted'], fontSize: 13 },
    periodRow: { flexDirection: 'row', gap: 6, marginVertical: 14 },
    periodBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border },
    periodActive: { backgroundColor: SELLER_GREEN, borderColor: SELLER_GREEN },
    periodLabel: { fontSize: 12, fontWeight: '600', color: tokens['text-muted'] },
    periodLabelActive: { color: '#fff' },
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    kpiCard: { flex: 1, minWidth: '45%', backgroundColor: tokens.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: tokens.border, alignItems: 'flex-start' },
    kpiIcon: { fontSize: 22, marginBottom: 6 },
    kpiValue: { fontSize: 20, fontWeight: '800', color: tokens.text, marginBottom: 2 },
    kpiLabel: { fontSize: 11, color: tokens['text-muted'], fontWeight: '600' },
    section: { backgroundColor: tokens.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: tokens.border },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: tokens.text, marginBottom: 14 },
    funnelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    funnelStep: { alignItems: 'center', flex: 1 },
    funnelNum: { fontSize: 18, fontWeight: '800', color: tokens.text },
    funnelLabel: { fontSize: 10, color: tokens['text-muted'], marginTop: 2 },
    funnelArrow: { fontSize: 18, color: tokens['text-muted'], marginHorizontal: 4 },
    funnelCvr: { alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
    funnelCvrNum: { fontSize: 16, fontWeight: '800', color: SELLER_GREEN },
    listingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.border },
    listingRank: { width: 28, alignItems: 'center' },
    rankNum: { fontSize: 12, fontWeight: '700', color: tokens['text-muted'] },
    listingInfo: { flex: 1 },
    listingTitle: { fontSize: 13, fontWeight: '600', color: tokens.text },
    listingMeta: { fontSize: 11, color: tokens['text-muted'], marginTop: 2 },
    listingRight: { alignItems: 'flex-end' },
    listingRevenue: { fontSize: 13, fontWeight: '700', color: tokens.text },
    listingConv: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    aiCard: { backgroundColor: '#eef2ff', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#c7d2fe' },
    aiTitle: { fontSize: 14, fontWeight: '700', color: '#3730a3', marginBottom: 8 },
    aiBody: { fontSize: 13, color: '#4338ca', lineHeight: 20, marginBottom: 8 },
    aiCta: { fontSize: 11, fontWeight: '600', color: '#6366f1' },
  });
}
