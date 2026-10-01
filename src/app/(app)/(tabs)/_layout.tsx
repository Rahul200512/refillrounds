import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  const { state } = usePharmacy();
  const blocked = state.orders.filter((o) => o.hold || o.approval?.state === 'pending').length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: fontSize.caption, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.surface },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: tabIcon('home-outline'), tabBarButtonTestID: 'tab-home' }}
      />
      <Tabs.Screen
        name="residents"
        options={{ title: 'Residents', tabBarIcon: tabIcon('people-outline'), tabBarButtonTestID: 'tab-residents' }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: tabIcon('receipt-outline'), tabBarButtonTestID: 'tab-orders' }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Holds & Approvals',
          tabBarLabel: 'Approvals',
          tabBarIcon: tabIcon('alert-circle-outline'),
          tabBarBadge: blocked > 0 ? blocked : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: colors.textOnPrimary },
          tabBarAccessibilityLabel: `Holds and approvals, ${blocked} waiting`,
          tabBarButtonTestID: 'tab-approvals',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: tabIcon('settings-outline'), tabBarButtonTestID: 'tab-settings' }}
      />
    </Tabs>
  );
}
