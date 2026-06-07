import { Tabs } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { Text } from 'react-native';

export default function SellerLayout() {
  const { tokens } = useTheme();
  const sellerGreen = '#16a34a';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: tokens.surface, borderTopColor: tokens.border },
        tabBarActiveTintColor: sellerGreen,
        tabBarInactiveTintColor: tokens['text-muted'],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text> }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text> }} />
      <Tabs.Screen name="new-listing" options={{ title: 'Add Stock', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>➕</Text> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📦</Text> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text> }} />
    </Tabs>
  );
}
