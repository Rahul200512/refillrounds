import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { Screen, SectionTitle } from '@/components/Screen';
import { getAttentionItems, getDashboardCounts } from '@/domain/dashboard';
import { formatDate, toIso } from '@/domain/dates';
import { useNow } from '@/hooks/useNow';
import { usePharmacy } from '@/state/PharmacyProvider';
import { useSession } from '@/state/SessionProvider';
import { colors, fontSize, radius, spacing, toneColors, type Tone } from '@/theme';

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { state, reload } = usePharmacy();
  const { session } = useSession();
  const now = useNow(5000);
  const [refreshing, setRefreshing] = useState(false);

  const counts = getDashboardCounts(state, now);
  const attention = getAttentionItems(state, now);
  const firstName = session?.displayName.split(' ')[0] ?? 'there';

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const deliveryValue = counts.deliveryConfirmed ? 'Done' : `${counts.deliveryChecked}/${counts.deliveryItems}`;

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} testID="dashboard">
      <View>
        <Text style={styles.greeting}>
          {greeting(now)}, {firstName}
        </Text>
        <Text style={styles.sub}>
          {state.facility?.name} · {formatDate(toIso(now))}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <StatTile
            label="Refills due"
            value={String(counts.refillsDue)}
            icon="medkit-outline"
            tone={counts.refillsDue > 0 ? 'warning' : 'success'}
            href="/refills-due"
            testID="tile-refills"
          />
          <StatTile
            label="Orders on hold"
            value={String(counts.ordersOnHold)}
            icon="pause-circle-outline"
            tone={counts.ordersOnHold > 0 ? 'danger' : 'success'}
            href={{ pathname: '/approvals', params: { view: 'holds' } }}
            testID="tile-holds"
          />
        </View>
        <View style={styles.row}>
          <StatTile
            label="Approvals needed"
            value={String(counts.approvalsNeeded)}
            icon="shield-checkmark-outline"
            tone={counts.approvalsNeeded > 0 ? 'warning' : 'success'}
            href={{ pathname: '/approvals', params: { view: 'approvals' } }}
            testID="tile-approvals"
          />
          <StatTile
            label="Today's delivery"
            value={deliveryValue}
            icon="cube-outline"
            tone={counts.deliveryConfirmed ? 'success' : 'info'}
            href="/delivery"
            testID="tile-delivery"
          />
        </View>
      </View>

      <SectionTitle>Needs attention</SectionTitle>
      {attention.length === 0 ? (
        <Card>
          <EmptyState title="All caught up" message="No holds, approvals or refills need you right now." />
        </Card>
      ) : (
        attention.map((item) => (
          <Card
            key={item.id}
            onPress={() => router.push(item.href)}
            accessibilityLabel={`${item.badge}: ${item.title}. ${item.detail}`}
            testID={`attention-${item.id}`}>
            <View style={styles.attentionTop}>
              <Text style={styles.attentionTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Badge label={item.badge} tone={item.tone} />
            </View>
            <Text style={styles.attentionDetail}>{item.detail}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

interface StatTileProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
  href: Href;
  testID: string;
}

function StatTile({ label, value, icon, tone, href, testID }: StatTileProps) {
  const { fg, bg } = toneColors[tone];
  return (
    <Card onPress={() => router.push(href)} accessibilityLabel={`${label}: ${value}`} testID={testID} style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={fg} />
      </View>
      <Text style={styles.tileValue} testID={`${testID}-value`}>
        {value}
      </Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: fontSize.heading,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    marginTop: 2,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  grid: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    gap: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileValue: {
    fontSize: fontSize.display,
    fontWeight: '800',
    color: colors.text,
  },
  tileLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: '600',
  },
  attentionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  attentionTitle: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  attentionDetail: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
});
