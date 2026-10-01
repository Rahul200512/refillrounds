import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/ListStates';
import { OrderActions } from '@/components/OrderActions';
import { Screen, SectionTitle } from '@/components/Screen';
import { formatDateTime, formatTime, toIso } from '@/domain/dates';
import { fullName, medLabel } from '@/domain/format';
import {
  getDeliveredAt,
  getOrderStatus,
  getOrderTimeline,
  HOLD_REASON_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type TimelineEntry,
} from '@/domain/orderStatus';
import { formatCurrency } from '@/domain/refills';
import { useNow } from '@/hooks/useNow';
import { usePharmacy } from '@/state/PharmacyProvider';
import { colors, fontSize, radius, spacing } from '@/theme';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = usePharmacy();
  const now = useNow(1000);
  const order = state.orders.find((o) => o.id === id);

  if (!order) {
    return (
      <Screen>
        <EmptyState
          icon="receipt-outline"
          title="Order not found"
          message="It may have been removed when demo data was reset, or the link is incorrect."
        />
        <AppButton label="Go to orders" variant="secondary" onPress={() => router.replace('/orders')} />
      </Screen>
    );
  }

  const med = state.medications.find((m) => m.id === order.medicationId);
  const resident = state.residents.find((r) => r.id === order.residentId);
  const status = getOrderStatus(order, now);
  const timeline = getOrderTimeline(order, now);
  const deliveredAt = getDeliveredAt(order);

  return (
    <Screen testID="order-detail">
      <Card style={styles.summary}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {med ? medLabel(med) : 'Unknown medication'}
          </Text>
          {order.priority === 'stat' && <Badge label="STAT" tone="danger" icon="flash" />}
        </View>
        {med && <Text style={styles.meta}>{med.form} · {med.directions}</Text>}
        {resident && (
          <Pressable
            onPress={() => router.push({ pathname: '/resident/[id]', params: { id: resident.id } })}
            accessibilityRole="link"
            accessibilityLabel={`Open profile for ${fullName(resident)}`}
            style={styles.residentLink}>
            <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.residentText}>
              {fullName(resident)} · Room {resident.room}
            </Text>
          </Pressable>
        )}
        <View style={styles.statusRow}>
          <Badge label={STATUS_LABELS[status]} tone={STATUS_TONES[status]} testID="order-status" />
          {deliveredAt && status !== 'delivered' && (
            <Text style={styles.eta}>Estimated delivery {formatTime(toIso(deliveredAt))}</Text>
          )}
        </View>
        <Text style={styles.small}>
          Submitted {formatDateTime(order.submittedAt, now)} by {order.submittedBy}
        </Text>
        {order.note && <Text style={styles.note}>“{order.note}”</Text>}
      </Card>

      {order.hold && (
        <View style={[styles.callout, styles.calloutDanger]} testID="hold-callout">
          <Text style={[styles.calloutTitle, { color: colors.danger }]}>On hold · {HOLD_REASON_LABELS[order.hold.reason]}</Text>
          <Text style={styles.calloutText}>{order.hold.detail}</Text>
          <Text style={styles.small}>Since {formatDateTime(order.hold.since, now)}</Text>
          <OrderActions order={order} medication={med} resident={resident} />
        </View>
      )}

      {!order.hold && order.approval?.state === 'pending' && (
        <View style={[styles.callout, styles.calloutWarning]} testID="approval-callout">
          <Text style={[styles.calloutTitle, { color: colors.warning }]}>Facility approval needed</Text>
          <Text style={styles.calloutText}>
            Estimated cost {formatCurrency(order.approval.estimatedCost)} per fill. The pharmacy will not fill this until the
            facility approves it.
          </Text>
          <OrderActions order={order} medication={med} resident={resident} />
        </View>
      )}

      {order.approval?.state === 'denied' && (
        <View style={[styles.callout, styles.calloutNeutral]} testID="denied-callout">
          <Text style={styles.calloutTitle}>Denied</Text>
          <Text style={styles.calloutText}>{order.approval.denialReason}</Text>
          {order.approval.decidedAt && (
            <Text style={styles.small}>
              {order.approval.decidedBy} · {formatDateTime(order.approval.decidedAt, now)}
            </Text>
          )}
        </View>
      )}

      <SectionTitle>Status timeline</SectionTitle>
      <Card testID="order-timeline">
        {timeline.map((entry, index) => (
          <TimelineRow key={entry.key} entry={entry} isLast={index === timeline.length - 1} now={now} />
        ))}
      </Card>
    </Screen>
  );
}

const DOT: Record<TimelineEntry['state'], { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  done: { icon: 'checkmark-circle', color: colors.success },
  current: { icon: 'radio-button-on', color: colors.primary },
  upcoming: { icon: 'ellipse-outline', color: colors.border },
  blocked: { icon: 'pause-circle', color: colors.danger },
};

function TimelineRow({ entry, isLast, now }: { entry: TimelineEntry; isLast: boolean; now: number }) {
  const dot = DOT[entry.state];
  let timeText = '';
  if (entry.at && entry.state === 'upcoming') timeText = `Expected ${formatTime(entry.at)}`;
  else if (entry.at && entry.state !== 'upcoming') timeText = formatDateTime(entry.at, now);

  return (
    <View
      style={styles.timelineRow}
      accessibilityLabel={`${entry.label}, ${entry.state}${timeText ? `, ${timeText}` : ''}`}
      testID={`timeline-${entry.key}`}>
      <View style={styles.rail}>
        <Ionicons name={dot.icon} size={22} color={dot.color} />
        {!isLast && <View style={styles.line} />}
      </View>
      <View style={styles.timelineBody}>
        <Text style={[styles.timelineLabel, entry.state === 'upcoming' && styles.upcoming]}>{entry.label}</Text>
        {timeText ? <Text style={styles.small}>{timeText}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.heading,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  residentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  residentText: {
    fontSize: fontSize.body,
    color: colors.primary,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eta: {
    fontSize: fontSize.small,
    color: colors.text,
    fontWeight: '600',
  },
  small: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  note: {
    fontSize: fontSize.body,
    color: colors.text,
    fontStyle: 'italic',
  },
  callout: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  calloutDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  calloutWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
  },
  calloutNeutral: {
    backgroundColor: colors.neutralSoft,
    borderColor: colors.border,
  },
  calloutTitle: {
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.text,
  },
  calloutText: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 22,
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 18,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineBody: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  timelineLabel: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  upcoming: {
    color: colors.textMuted,
    fontWeight: '400',
  },
});
