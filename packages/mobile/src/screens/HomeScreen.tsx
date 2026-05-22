/**
 * Buyer Home Screen.
 * Deal feed: search bar, sector filters, deal cards ranked by urgency+discount.
 * NirmalMandi Agent FAB at bottom right.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme/tokens';
import { DealCard } from '../components/DealCard';
import { AgentFab } from '../components/AgentFab';
import { listingsApi } from '../services/api';

const SECTORS = [
  { slug: '', label: 'All' },
  { slug: 'fmcg', label: 'FMCG' },
  { slug: 'clothing', label: 'Clothing' },
  { slug: 'automobiles', label: 'Auto' },
  { slug: 'pharma', label: 'Pharma' },
  { slug: 'furniture', label: 'Furniture' },
  { slug: 'software', label: 'Software' },
  { slug: 'machinery', label: 'Machinery' },
];

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
  navigation: any;
}

export function HomeScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sector, setSector] = useState('');
  const [query, setQuery] = useState('');
  const [agentVisible, setAgentVisible] = useState(false);

  useEffect(() => { loadDeals(); }, [sector]);

  async function loadDeals(q = query) {
    setLoading(true);
    try {
      const params: any = { limit: 30 };
      if (sector) params.sector = sector;
      if (q) params.q = q;
      const res = await listingsApi.getDeals(params);
      setListings(res.data.data?.listings || res.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDeals();
  }, [sector]);

  function onSearch() { loadDeals(query); }

  const s = makeStyles(colors, isDark);

  return (
    <View style={s.container}>
      {/* Search Bar */}
      <View style={s.searchBar}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          placeholder="Search deals, sectors, brands..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
        />
        <TouchableOpacity style={s.searchBtn} onPress={onSearch}>
          <Text style={s.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Sector Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pills}
      >
        {SECTORS.map(sc => (
          <TouchableOpacity
            key={sc.slug}
            onPress={() => setSector(sc.slug)}
            style={[s.pill, sector === sc.slug && s.pillActive]}
          >
            <Text style={[s.pillText, sector === sc.slug && s.pillTextActive]}>
              {sc.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Deal Feed */}
      {loading && !refreshing ? (
        <View style={s.loader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <DealCard
              listing={item}
              onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
            />
          )}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>No deals found</Text>
              <Text style={{ color: colors.muted, fontSize: Typography.sm, textAlign: 'center' }}>
                Try a different sector or search term
              </Text>
            </View>
          }
        />
      )}

      {/* Agent FAB */}
      <AgentFab
        visible={agentVisible}
        onToggle={() => setAgentVisible(v => !v)}
        onClose={() => setAgentVisible(false)}
      />
    </View>
  );
}

function makeStyles(colors: typeof Colors.light, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    searchBar: {
      flexDirection: 'row',
      margin: Spacing[4],
      gap: Spacing[2],
    },
    searchInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing[4],
      paddingVertical: Spacing[3],
      color: colors.text,
      fontSize: Typography.base,
      ...Shadow.sm,
    },
    searchBtn: {
      backgroundColor: Colors.primary,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing[4],
      justifyContent: 'center',
    },
    searchBtnText: {
      color: '#fff',
      fontWeight: Typography.semibold,
      fontSize: Typography.sm,
    },
    pills: {
      paddingHorizontal: Spacing[4],
      paddingBottom: Spacing[3],
      gap: Spacing[2],
    },
    pill: {
      paddingHorizontal: Spacing[4],
      paddingVertical: Spacing[2],
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: Colors.primary,
      borderColor: Colors.primary,
    },
    pillText: {
      color: colors.textSecondary,
      fontSize: Typography.sm,
      fontWeight: Typography.medium,
    },
    pillTextActive: { color: '#fff' },
    list: { paddingHorizontal: Spacing[4], paddingBottom: 120 },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: {
      padding: Spacing[12],
      alignItems: 'center',
    },
    emptyText: {
      fontSize: Typography.lg,
      fontWeight: Typography.semibold,
      color: colors.text,
      marginBottom: Spacing[2],
    },
  });
}
