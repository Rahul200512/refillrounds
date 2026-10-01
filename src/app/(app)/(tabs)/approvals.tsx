import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { OrderActions } from '@/components/OrderActions';
import { SegmentedControl } from '@/components/SegmentedControl';
import { formatRelative } from '@/domain/dates';
import { fullName, medLabel } from '@/domain/format';
import { compareOrders, HOLD_REASON_LABELS } from '@/domain/orderStatus';
import { formatCurrency } from '@/domain/refills';
import { useNow } from '@/hooks/useNow';
import type { Order } from '@/models';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, spacing } from '@/theme';

type ApprovalView = 'approvals' | 'holds';

export default function ApprovalsScreen() {
  // The selected view lives in the URL (?view=holds) so dashboard tiles can deep-link to it.
  const params = useLocalSearchParams<{ view?: string }>();
  const view: ApprovalView = params.view === 'holds' ? 'holds' : 'approvals';
  const { state } = usePharmacy();
  const now = useNow(10000);

  const approvals = state.orders.filter((o) => !o.hold && o.approval?.state === 'pending').sort(compareOrders);
  const holds = state.orders.filter((o) => Boolean(o.hold)).sort(compareOrders);
  const visible = view === 'holds' ? holds : approvals;

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(o) => o.id}
      ListHeaderComponent={
        <SegmentedControl<ApprovalView>
          options={[
            { value: 'approvals', label: `Approvals (${approvals.length})` },
            { value: 'holds', label: `Holds (${holds.length})` },
          ]}
          value={view}
          onChange={(next) => router.setParams({ view: next })}
          accessibilityLabel="Show approvals or holds"
          testIDPrefix="approvals-view"
        />
      }
      ListEmptyComponent={
        view === 'holds' ? (
          <EmptyState title="No orders on hold" message="Held orders from the pharmacy will appear here." />
        ) : (
          <EmptyState title="No approvals waiting" message="High-cost medications that need facility sign-off appear here." />
        )
      }
      renderItem={({ item }) => <BlockedOrderCard order={item} now={now} />}
    />
  );
}

function BlockedOrderCard({ order, now }: { order: Order; now: number }) {
  const { state } = usePharmacy();
  const med = state.medications.find((m) => m.id === order.medicationId);
  const resident = state.residents.find((r) => r.id === order.residentId);

  return (
    <Card testID={`blocked-${order.id}`} style={styles.card}>
      <Pressable
        onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
        accessibilityRole="link"
        accessibilityLabel={`Open order for ${med ? medLabel(med) : 'medication'}`}>
        <View style={styles.top}>
          <Text style={styles.title}>{med ? medLabel(med) : 'Unknown medication'}</Text>
          {order.priority === 'stat' && <Badge label="STAT" tone="danger" icon="flash" />}
        </View>
        {resident && (
          <Text style={styles.sub}>
            {fullName(resident)} · Room {resident.room}
          </Text>
        )}
        {order.hold ? (
          <View style={styles.reason}>
            <Badge label={HOLD_REASON_LABELS[order.hold.reason]} tone="danger" icon="pause-circle" />
            <Text style={styles.detail}>{order.hold.detail}</Text>
            <Text style={styles.time}>Held {formatRelative(order.hold.since, now)}</Text>
          </View>
        ) : (
          <View style={styles.reason}>
            <Badge label={`High cost · ${formatCurrency(order.approval?.estimatedCost ?? 0)}`} tone="warning" icon="cash-outline" />
            {order.note && <Text style={styles.detail}>“{order.note}”</Text>}
            <Text style={styles.time}>
              Requested {formatRelative(order.submittedAt, now)} by {order.submittedBy}
            </Text>
          </View>
        )}
        <Text style={styles.link}>View order details ›</Text>
      </Pressable>
      <OrderActions order={order} medication={med} resident={resident} />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    marginTop: 2,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  reason: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  detail: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  time: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  link: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    fontWeight: '700',
    color: colors.primary,
  },
});
