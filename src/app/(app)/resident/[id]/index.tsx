import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { OrderRow } from '@/components/OrderRow';
import { Screen, SectionTitle } from '@/components/Screen';
import { formatDate } from '@/domain/dates';
import { fullName, initials, pluralize, unitName } from '@/domain/format';
import { compareOrders, getOrderStatus, STATUS_LABELS, STATUS_TONES } from '@/domain/orderStatus';
import {
  findOpenOrder,
  getDaysRemaining,
  getNextCycleDate,
  getRefillStatus,
  REFILL_LABELS,
  REFILL_TONES,
} from '@/domain/refills';
import { useNow } from '@/hooks/useNow';
import type { Medication, Order } from '@/models';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, radius, spacing } from '@/theme';

const FILL_TYPE_LABELS = { cycle: 'Cycle fill', prn: 'PRN (as needed)', course: 'Short course' } as const;

export default function ResidentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = usePharmacy();
  const now = useNow(5000);
  const resident = state.residents.find((r) => r.id === id);

  if (!resident) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Resident' }} />
        <EmptyState icon="person-outline" title="Resident not found" message="This resident may have been removed or the link is incorrect." />
        <AppButton label="Back to residents" variant="secondary" onPress={() => router.replace('/residents')} />
      </Screen>
    );
  }

  const meds = state.medications.filter((m) => m.residentId === resident.id);
  const orders = state.orders.filter((o) => o.residentId === resident.id).sort(compareOrders);

  return (
    <Screen testID="resident-profile">
      <Stack.Screen options={{ title: fullName(resident) }} />

      <Card style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(resident)}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name} accessibilityRole="header">
            {fullName(resident)}
          </Text>
          <Text style={styles.meta}>
            Room {resident.room} · {unitName(state.facility, resident.unitId)}
          </Text>
        </View>
      </Card>

      {resident.allergies.length > 0 ? (
        <View style={[styles.allergy, styles.allergyDanger]} accessibilityRole="alert" testID="allergy-banner">
          <Ionicons name="warning" size={22} color={colors.danger} />
          <View style={styles.allergyBody}>
            <Text style={styles.allergyTitle}>Allergies</Text>
            <Text style={styles.allergyText}>{resident.allergies.join(', ')}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.allergy, styles.allergyNone]} testID="allergy-banner">
          <Ionicons name="checkmark-circle-outline" size={22} color={colors.neutral} />
          <Text style={styles.allergyNoneText}>No known drug allergies (NKDA)</Text>
        </View>
      )}

      <AppButton
        label="Request refill"
        icon="add-circle-outline"
        onPress={() => router.push({ pathname: '/resident/[id]/refill', params: { id: resident.id } })}
        testID="request-refill-button"
      />

      <SectionTitle>{`Medications (${meds.length})`}</SectionTitle>
      {meds.map((med) => (
        <MedicationCard key={med.id} med={med} orders={state.orders} now={now} />
      ))}

      <SectionTitle>Orders</SectionTitle>
      {orders.length === 0 ? (
        <Card>
          <EmptyState icon="receipt-outline" title="No orders yet" />
        </Card>
      ) : (
        orders.map((order) => (
          <OrderRow
            key={order.id}
            order={order}
            medication={state.medications.find((m) => m.id === order.medicationId)}
            resident={resident}
            now={now}
            showResident={false}
          />
        ))
      )}
    </Screen>
  );
}

function MedicationCard({ med, orders, now }: { med: Medication; orders: Order[]; now: number }) {
  const status = getRefillStatus(med, orders, now);
  const openOrder = findOpenOrder(med.id, orders, now);
  const days = getDaysRemaining(med, orders, now);
  const orderStatus = openOrder ? getOrderStatus(openOrder, now) : null;

  let supplyText = `${pluralize(days, 'day')} of supply left`;
  if (med.fillType === 'cycle') supplyText = `Next cycle fill ${formatDate(getNextCycleDate(med, orders, now))}`;
  if (med.fillType === 'course') supplyText = days > 0 ? `${pluralize(days, 'day')} of therapy left` : 'Not yet dispensed';

  return (
    <Card testID={`med-${med.id}`}>
      <Text style={styles.medName}>
        {med.name} {med.strength}
      </Text>
      <Text style={styles.medForm}>{med.form}</Text>
      <Text style={styles.directions}>{med.directions}</Text>
      <Text style={styles.prescriber}>{med.prescriber}</Text>
      <View style={styles.medFooter}>
        <Badge label={FILL_TYPE_LABELS[med.fillType]} tone="neutral" />
        {orderStatus ? (
          <Badge label={`Order: ${STATUS_LABELS[orderStatus]}`} tone={STATUS_TONES[orderStatus]} testID={`med-status-${med.id}`} />
        ) : (
          // Cycle and course meds have no refill state beyond their fill type, so only PRN meds get a second badge.
          med.fillType === 'prn' && <Badge label={REFILL_LABELS[status]} tone={REFILL_TONES[status]} testID={`med-status-${med.id}`} />
        )}
      </View>
      <Text style={styles.supply}>{supplyText}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: fontSize.title,
  },
  headerBody: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.heading,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  allergy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
  },
  allergyDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  allergyNone: {
    backgroundColor: colors.neutralSoft,
    borderColor: colors.border,
  },
  allergyBody: {
    flex: 1,
  },
  allergyTitle: {
    fontSize: fontSize.small,
    fontWeight: '800',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  allergyText: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.danger,
  },
  allergyNoneText: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.neutral,
  },
  medName: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  medForm: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  directions: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.text,
    lineHeight: 20,
  },
  prescriber: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  medFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  supply: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
