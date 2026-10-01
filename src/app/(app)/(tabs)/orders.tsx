import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ListStates';
import { OrderRow } from '@/components/OrderRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { compareOrders, isOrderOpen } from '@/domain/orderStatus';
import { useNow } from '@/hooks/useNow';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, spacing } from '@/theme';

type Filter = 'open' | 'closed';

export default function OrdersScreen() {
  const { state, reload } = usePharmacy();
  const now = useNow(2000);
  const [filter, setFilter] = useState<Filter>('open');
  const [refreshing, setRefreshing] = useState(false);

  const open = state.orders.filter((o) => isOrderOpen(o, now));
  const closed = state.orders.filter((o) => !isOrderOpen(o, now));
  const visible = (filter === 'open' ? open : closed).slice().sort(compareOrders);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(o) => o.id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={
        <View>
          <SegmentedControl<Filter>
            options={[
              { value: 'open', label: `Open (${open.length})` },
              { value: 'closed', label: `Completed (${closed.length})` },
            ]}
            value={filter}
            onChange={setFilter}
            accessibilityLabel="Filter orders"
            testIDPrefix="orders-filter"
          />
        </View>
      }
      ListEmptyComponent={
        filter === 'open' ? (
          <EmptyState icon="receipt-outline" title="No open orders" message="Request a refill from a resident's profile." />
        ) : (
          <EmptyState icon="checkmark-done-outline" title="No completed orders yet" />
        )
      }
      renderItem={({ item }) => (
        <OrderRow
          order={item}
          medication={state.medications.find((m) => m.id === item.medicationId)}
          resident={state.residents.find((r) => r.id === item.residentId)}
          now={now}
        />
      )}
    />
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
});
